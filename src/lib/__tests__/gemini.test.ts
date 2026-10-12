import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const sdk = vi.hoisted(() => {
  process.env.YOUTUBE_API_KEY = "yt-key-for-tests";
  process.env.GEMINI_API_KEY = "gemini-key-for-tests";
  process.env.RESEND_API_KEY = "resend-key-for-tests";
  process.env.DATABASE_URL = "postgresql://u:p@localhost:6543/db";
  process.env.CRON_SECRET = "cron-secret-for-tests-1234567890";
  return { generateContent: vi.fn(), embedContent: vi.fn() };
});

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: sdk.generateContent, embedContent: sdk.embedContent };
  },
}));

import { EMBED_DIMS, embedTexts, generateJson, generateText, withBackoff } from "../gemini";

const rateLimit = () => Object.assign(new Error("429 RESOURCE_EXHAUSTED: quota"), { status: 429 });

beforeEach(() => vi.clearAllMocks());

describe("withBackoff", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await withBackoff(fn, 4, 1)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("retries on 429 and then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(rateLimit()).mockRejectedValueOnce(rateLimit()).mockResolvedValue("ok");
    expect(await withBackoff(fn, 4, 1)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it("retries on 503 UNAVAILABLE too", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("503 UNAVAILABLE")).mockResolvedValue("ok");
    expect(await withBackoff(fn, 3, 1)).toBe("ok");
  });
  it("does NOT retry on a non-rate-limit error (bad key, bad request)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("400 INVALID_ARGUMENT"));
    await expect(withBackoff(fn, 4, 1)).rejects.toThrow("INVALID_ARGUMENT");
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("gives up after the maximum tries and surfaces the last error", async () => {
    const fn = vi.fn().mockRejectedValue(rateLimit());
    await expect(withBackoff(fn, 3, 1)).rejects.toThrow("RESOURCE_EXHAUSTED");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("generateJson (validate, retry once with the error, then fail)", () => {
  const schema = z.object({ n: z.number() });
  const reply = (text: string | undefined) => sdk.generateContent.mockResolvedValueOnce({ text });

  it("parses valid JSON on the first try", async () => {
    reply('{"n": 1}');
    expect(await generateJson("p", schema)).toEqual({ n: 1 });
    expect(sdk.generateContent).toHaveBeenCalledTimes(1);
  });
  it("strips markdown code fences", async () => {
    reply('```json\n{"n": 2}\n```');
    expect(await generateJson("p", schema)).toEqual({ n: 2 });
  });
  it("retries once when the JSON is invalid and tells the model what was wrong", async () => {
    reply("not json at all");
    reply('{"n": 3}');
    expect(await generateJson("PROMPT", schema)).toEqual({ n: 3 });
    expect(sdk.generateContent).toHaveBeenCalledTimes(2);
    const second = sdk.generateContent.mock.calls[1][0].contents as string;
    expect(second).toContain("PROMPT");
    expect(second).toContain("rejected");
  });
  it("retries once when the JSON fails the schema", async () => {
    reply('{"n": "wrong type"}');
    reply('{"n": 4}');
    expect(await generateJson("p", schema)).toEqual({ n: 4 });
  });
  it("throws after two bad answers (so the pipeline can fall back to the last brief)", async () => {
    reply("nope");
    reply('{"n": "still wrong"}');
    await expect(generateJson("p", schema)).rejects.toThrow(/invalid brief JSON twice/);
    expect(sdk.generateContent).toHaveBeenCalledTimes(2);
  });
  it("treats an empty response as invalid and retries", async () => {
    reply(undefined);
    reply('{"n": 5}');
    expect(await generateJson("p", schema)).toEqual({ n: 5 });
  });
  it("asks Gemini for JSON output", async () => {
    reply('{"n": 6}');
    await generateJson("p", schema);
    expect(sdk.generateContent.mock.calls[0][0].config.responseMimeType).toBe("application/json");
  });
});

describe("embedTexts", () => {
  const embed = (n: number) => ({ embeddings: Array.from({ length: n }, () => ({ values: [3, 4] })) });

  it("returns nothing and makes no call for empty input", async () => {
    expect(await embedTexts([])).toEqual([]);
    expect(sdk.embedContent).not.toHaveBeenCalled();
  });
  it("batches 50 at a time and keeps the order", async () => {
    sdk.embedContent.mockImplementation(async ({ contents }: { contents: string[] }) => embed(contents.length));
    const out = await embedTexts(Array.from({ length: 120 }, (_, i) => `t${i}`));
    expect(out).toHaveLength(120);
    expect(sdk.embedContent).toHaveBeenCalledTimes(3);
    expect(sdk.embedContent.mock.calls.map((c) => c[0].contents.length)).toEqual([50, 50, 20]);
  });
  it("normalises vectors to unit length", async () => {
    sdk.embedContent.mockResolvedValueOnce(embed(1));
    const [v] = await embedTexts(["x"]);
    expect(Math.hypot(...v)).toBeCloseTo(1);
  });
  it("does not divide by zero for an all-zero vector", async () => {
    sdk.embedContent.mockResolvedValueOnce({ embeddings: [{ values: [0, 0] }] });
    const [v] = await embedTexts(["x"]);
    expect(v.every((x) => Number.isFinite(x))).toBe(true);
  });
  it("throws if Gemini returns a different number of vectors than texts", async () => {
    sdk.embedContent.mockResolvedValueOnce(embed(1));
    await expect(embedTexts(["a", "b"])).rejects.toThrow(/mismatch/);
  });
  it("requests the configured dimensionality", async () => {
    sdk.embedContent.mockResolvedValueOnce(embed(1));
    await embedTexts(["x"]);
    expect(sdk.embedContent.mock.calls[0][0].config.outputDimensionality).toBe(EMBED_DIMS);
  });
});

describe("generateText", () => {
  it("returns trimmed text and throws on an empty answer", async () => {
    sdk.generateContent.mockResolvedValueOnce({ text: "  hello  " });
    expect(await generateText("p")).toBe("hello");
    sdk.generateContent.mockResolvedValueOnce({ text: "   " });
    await expect(generateText("p")).rejects.toThrow(/empty/);
  });
});
