import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- mocks (hoisted) -------------------------------------------------------
const repo = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  getBrief: vi.fn(),
  getScript: vi.fn(),
  saveScriptEdit: vi.fn(),
  scriptsGeneratedToday: vi.fn(),
  upsertGeneratedScript: vi.fn(),
  latestBrief: vi.fn(),
  latestRun: vi.fn(),
}));
vi.mock("@/lib/repo", () => repo);

const scriptLib = vi.hoisted(() => ({ generateScript: vi.fn() }));
vi.mock("@/lib/script", () => scriptLib);

const pipeline = vi.hoisted(() => {
  class RateLimitError extends Error {}
  class RunStateError extends Error {}
  return { RateLimitError, RunStateError, runStage: vi.fn(), startRun: vi.fn(), STAGES: ["fetch", "cluster", "brief"], runFullPipeline: vi.fn() };
});
vi.mock("@/lib/pipeline", () => pipeline);

const emailLib = vi.hoisted(() => ({ sendBriefEmail: vi.fn() }));
vi.mock("@/lib/email", () => emailLib);

const dbLib = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("@/lib/db", () => dbLib);

const latestLib = vi.hoisted(() => ({ getLatest: vi.fn() }));
vi.mock("@/lib/latest", () => latestLib);

import * as settingsRoute from "@/app/api/settings/route";
import * as scriptRoute from "@/app/api/script/route";
import * as generateRoute from "@/app/api/generate/route";
import * as cronRoute from "@/app/api/cron/weekly-brief/route";
import * as healthRoute from "@/app/api/health/route";
import * as latestRoute from "@/app/api/brief/latest/route";

const json = (body: unknown, method = "POST", url = "http://x/api") =>
  new Request(url, { method, headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
const UUID = "11111111-1111-4111-8111-111111111111";
const goodSettings = { categories: ["AI tools"], region: "IN", email: "a@b.co", minViews: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  repo.latestRun.mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("PUT /api/settings validation", () => {
  const put = (b: unknown) => settingsRoute.PUT(json(b, "PUT"));

  it("accepts a valid payload and saves it once", async () => {
    const res = await put(goodSettings);
    expect(res.status).toBe(200);
    expect(repo.saveSettings).toHaveBeenCalledTimes(1);
  });
  it("rejects empty and over-long category lists", async () => {
    expect((await put({ ...goodSettings, categories: [] })).status).toBe(400);
    expect((await put({ ...goodSettings, categories: Array.from({ length: 13 }, (_, i) => `cat ${i}`) })).status).toBe(400);
    expect(repo.saveSettings).not.toHaveBeenCalled();
  });
  it("rejects blank / one-character / 61-character categories", async () => {
    for (const c of ["", "   ", "a", "x".repeat(61)]) {
      expect((await put({ ...goodSettings, categories: [c] })).status, `category "${c.slice(0, 5)}"`).toBe(400);
    }
  });
  it("rejects bad emails", async () => {
    for (const e of ["", "nope", "a@", "@b.co", "a b@c.co"]) expect((await put({ ...goodSettings, email: e })).status, e).toBe(400);
  });
  it("rejects minViews that are negative, fractional, above 20M, or not numbers", async () => {
    for (const v of [-1, 1.5, 20_000_001, "5000", null, NaN]) expect((await put({ ...goodSettings, minViews: v })).status, String(v)).toBe(400);
  });
  it("accepts the exact limits for minViews", async () => {
    expect((await put({ ...goodSettings, minViews: 0 })).status).toBe(200);
    expect((await put({ ...goodSettings, minViews: 20_000_000 })).status).toBe(200);
  });
  it("defaults minViews to 0 when omitted", async () => {
    await put({ categories: ["AI tools"], region: "IN", email: "a@b.co" });
    expect(repo.saveSettings.mock.calls[0][0].minViews).toBe(0);
  });
  it("de-duplicates repeated categories", async () => {
    await put({ ...goodSettings, categories: ["AI tools", "AI tools", "ChatGPT"] });
    expect(repo.saveSettings.mock.calls[0][0].categories).toEqual(["AI tools", "ChatGPT"]);
  });
  it("handles malformed, empty and non-object bodies without crashing", async () => {
    for (const b of ["{not json", "", "null", "[]", '"str"', "123"]) expect((await put(b)).status, b).toBe(400);
  });
  it("stores script-like and SQL-like category text as plain data", async () => {
    const res = await put({ ...goodSettings, categories: ["<script>alert(1)</script>", "x'; DROP TABLE settings;--"] });
    expect(res.status).toBe(200);
    expect(repo.saveSettings.mock.calls[0][0].categories).toContain("x'; DROP TABLE settings;--");
  });
  it("accepts unicode and emoji categories", async () => {
    expect((await put({ ...goodSettings, categories: ["फैशन ट्रेंड्स", "AI 🤖 tools"] })).status).toBe(200);
  });
  it("rejects a region that is not a supported code (regression: any two letters used to pass)", async () => {
    expect((await put({ ...goodSettings, region: "ZZ" })).status).toBe(400);
    expect((await put({ ...goodSettings, region: "I" })).status).toBe(400);
    expect((await put({ ...goodSettings, region: "IND" })).status).toBe(400);
    expect((await put({ ...goodSettings, region: "us" })).status).toBe(200); // case-insensitive
  });
});

describe("GET /api/settings", () => {
  it("returns settings, and a 503 (not a crash) when the database fails", async () => {
    repo.getSettings.mockResolvedValueOnce(goodSettings);
    expect((await settingsRoute.GET()).status).toBe(200);
    repo.getSettings.mockRejectedValueOnce(new Error("db down"));
    expect((await settingsRoute.GET()).status).toBe(503);
  });
});

describe("/api/script guards", () => {
  const get = (qs: string) => scriptRoute.GET(new Request(`http://x/api/script?${qs}`));

  it("GET validates the brief id and theme index", async () => {
    for (const qs of ["", "briefId=nope&themeIndex=0", `briefId=${UUID}&themeIndex=9`, `briefId=${UUID}&themeIndex=-1`, `briefId=${UUID}&themeIndex=1.5`, `briefId=${UUID}&themeIndex=abc`, `briefId=${UUID}`]) {
      expect((await get(qs)).status, qs).toBe(400);
    }
  });
  it("GET returns null when nothing is saved and the content when it is", async () => {
    repo.getScript.mockResolvedValueOnce(null);
    expect(await (await get(`briefId=${UUID}&themeIndex=0`)).json()).toEqual({ script: null });
    repo.getScript.mockResolvedValueOnce({ content: "hello", language: "English", updatedAt: new Date() });
    expect((await (await get(`briefId=${UUID}&themeIndex=0`)).json()).script.content).toBe("hello");
  });
  it("POST validates body, language and theme index", async () => {
    for (const b of [{}, { briefId: "x", themeIndex: 0 }, { briefId: UUID, themeIndex: 7 }, { briefId: UUID, themeIndex: 0, language: "Klingon" }, "oops"]) {
      expect((await scriptRoute.POST(json(b))).status, JSON.stringify(b)).toBe(400);
    }
  });
  it("POST returns 404 for an unknown brief or a theme that does not exist", async () => {
    repo.getBrief.mockResolvedValueOnce(null);
    expect((await scriptRoute.POST(json({ briefId: UUID, themeIndex: 0 }))).status).toBe(404);
    repo.getBrief.mockResolvedValueOnce({ brief: { themes: [{}], meta: {} } });
    expect((await scriptRoute.POST(json({ briefId: UUID, themeIndex: 3 }))).status).toBe(404);
  });
  it("POST enforces the daily cap and does not call Gemini when over it", async () => {
    repo.getBrief.mockResolvedValueOnce({ brief: { themes: [{ name: "t" }], meta: { categories: ["x"] } } });
    repo.scriptsGeneratedToday.mockResolvedValueOnce(40);
    const res = await scriptRoute.POST(json({ briefId: UUID, themeIndex: 0 }));
    expect(res.status).toBe(429);
    expect(scriptLib.generateScript).not.toHaveBeenCalled();
  });
  it("POST turns a Gemini failure into a friendly 502 without leaking the error", async () => {
    repo.getBrief.mockResolvedValueOnce({ brief: { themes: [{ name: "t" }], meta: { categories: ["x"] } } });
    repo.scriptsGeneratedToday.mockResolvedValueOnce(0);
    scriptLib.generateScript.mockRejectedValueOnce(new Error("secret internal stack AIzaSy..."));
    const res = await scriptRoute.POST(json({ briefId: UUID, themeIndex: 0 }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("AIzaSy");
    expect(repo.upsertGeneratedScript).not.toHaveBeenCalled();
  });
  it("POST stores the generated script on success", async () => {
    repo.getBrief.mockResolvedValueOnce({ brief: { themes: [{ name: "t" }], meta: { categories: ["x"] } } });
    repo.scriptsGeneratedToday.mockResolvedValueOnce(0);
    scriptLib.generateScript.mockResolvedValueOnce("# script");
    const res = await scriptRoute.POST(json({ briefId: UUID, themeIndex: 0, language: "Hinglish" }));
    expect(res.status).toBe(200);
    expect(repo.upsertGeneratedScript).toHaveBeenCalledWith(UUID, 0, "Hinglish", "# script");
  });
  it("PUT validates input, caps content at 60,000 chars, and 404s when there is no script", async () => {
    const put = (b: unknown) => scriptRoute.PUT(json(b, "PUT"));
    expect((await put({ briefId: UUID, themeIndex: 0, content: "x".repeat(60_001) })).status).toBe(400);
    expect((await put({ briefId: "bad", themeIndex: 0, content: "x" })).status).toBe(400);
    expect((await put({ briefId: UUID, themeIndex: 0 })).status).toBe(400);
    repo.saveScriptEdit.mockResolvedValueOnce(false);
    expect((await put({ briefId: UUID, themeIndex: 0, content: "x" })).status).toBe(404);
    repo.saveScriptEdit.mockResolvedValueOnce(true);
    expect((await put({ briefId: UUID, themeIndex: 0, content: "x".repeat(60_000) })).status).toBe(200);
    repo.saveScriptEdit.mockResolvedValueOnce(true);
    expect((await put({ briefId: UUID, themeIndex: 0, content: "" })).status).toBe(200); // clearing the text is allowed
  });
});

describe("POST /api/generate", () => {
  const post = (b: unknown) => generateRoute.POST(json(b));
  it("rejects invalid stages, bad run ids and junk bodies", async () => {
    for (const b of [{}, { stage: "nope" }, { stage: "cluster", runId: -1 }, { stage: "cluster", runId: 1.5 }, { stage: "cluster", runId: "1" }, "{bad"]) {
      expect((await post(b)).status, JSON.stringify(b)).toBe(400);
    }
  });
  it("requires a run id for every stage except the first", async () => {
    expect((await post({ stage: "cluster" })).status).toBe(400);
    expect((await post({ stage: "brief" })).status).toBe(400);
    expect(pipeline.startRun).not.toHaveBeenCalled();
  });
  it("(regression) a run-state problem (unknown, finished or out-of-order run) is a 409, not a 500 or a silent success", async () => {
    pipeline.runStage.mockRejectedValueOnce(new pipeline.RunStateError("This run has already finished."));
    const res = await post({ stage: "brief", runId: 123 });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already finished/);
  });
  it("starting a run is rate limited with a 429", async () => {
    pipeline.startRun.mockRejectedValueOnce(new pipeline.RateLimitError("slow down"));
    expect((await post({ stage: "fetch" })).status).toBe(429);
  });
  it("other pipeline failures become 500 with the message, and never include the brief body", async () => {
    pipeline.startRun.mockResolvedValueOnce(7);
    pipeline.runStage.mockRejectedValueOnce(new Error("Only 3 videos found"));
    const res = await post({ stage: "fetch" });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("Only 3 videos");
  });
  it("strips the full brief from the stage response", async () => {
    pipeline.startRun.mockResolvedValueOnce(9);
    pipeline.runStage.mockResolvedValueOnce({ briefId: "b", brief: { huge: true }, emailSent: true });
    const body = await (await post({ stage: "fetch" })).json();
    expect(body).toMatchObject({ runId: 9, stage: "fetch", briefId: "b" });
    expect(body.brief).toBeUndefined();
  });
});

describe("GET /api/cron/weekly-brief security", () => {
  const call = (auth?: string) =>
    cronRoute.GET(new Request("http://x/api/cron/weekly-brief", { headers: auth === undefined ? {} : { authorization: auth } }));

  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret-value-for-tests-1234567890abcd";
  });

  it("rejects missing, wrong, partial, differently-cased and empty credentials", async () => {
    const secret = process.env.CRON_SECRET!;
    for (const a of [undefined, "", "Bearer ", "Bearer nope", secret, `bearer ${secret}`, `Bearer ${secret.slice(0, -1)}`, `Bearer ${secret}x`]) {
      expect((await call(a)).status, String(a)).toBe(401);
    }
    expect(pipeline.runFullPipeline).not.toHaveBeenCalled();
  });
  it("(regression) a duplicate delivery right after a successful run does nothing and sends no second email", async () => {
    repo.latestRun.mockResolvedValueOnce({ status: "done", stage: "done", startedAt: new Date(Date.now() - 120_000), finishedAt: new Date(Date.now() - 60_000) });
    const res = await call(`Bearer ${process.env.CRON_SECRET}`);
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBeTruthy();
    expect(pipeline.runFullPipeline).not.toHaveBeenCalled();
  });
  it("?force=1 overrides the duplicate guard for manual testing", async () => {
    repo.latestRun.mockResolvedValue({ status: "done", stage: "done", startedAt: new Date(), finishedAt: new Date() });
    pipeline.runFullPipeline.mockResolvedValueOnce({ runId: 9, brief: { themes: [1, 2, 3] } });
    const res = await cronRoute.GET(new Request("http://x/api/cron/weekly-brief?force=1", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    expect(res.status).toBe(200);
    expect(pipeline.runFullPipeline).toHaveBeenCalledTimes(1);
  });
  it("still runs when the last run failed or is old, and when the run lookup itself fails", async () => {
    pipeline.runFullPipeline.mockResolvedValue({ runId: 10, brief: { themes: [1, 2, 3] } });
    repo.latestRun.mockResolvedValueOnce({ status: "failed", stage: "fetch", startedAt: new Date(), finishedAt: new Date() });
    expect((await call(`Bearer ${process.env.CRON_SECRET}`)).status).toBe(200);
    repo.latestRun.mockResolvedValueOnce({ status: "done", stage: "done", startedAt: new Date(Date.now() - 7 * 86_400_000), finishedAt: new Date(Date.now() - 7 * 86_400_000) });
    expect((await call(`Bearer ${process.env.CRON_SECRET}`)).status).toBe(200);
    repo.latestRun.mockRejectedValueOnce(new Error("db blip"));
    expect((await call(`Bearer ${process.env.CRON_SECRET}`)).status).toBe(200);
    expect(pipeline.runFullPipeline).toHaveBeenCalledTimes(3);
  });
  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call("Bearer undefined")).status).toBe(401);
  });
  it("runs the pipeline with the right secret", async () => {
    pipeline.runFullPipeline.mockResolvedValueOnce({ runId: 3, brief: { themes: [1, 2, 3] } });
    const res = await call(`Bearer ${process.env.CRON_SECRET}`);
    expect(res.status).toBe(200);
    expect(pipeline.runFullPipeline).toHaveBeenCalledWith({ manual: false, email: true });
  });
  it("on failure emails the last brief marked stale, and still reports the failure", async () => {
    pipeline.runFullPipeline.mockResolvedValueOnce({ runId: 4, error: "YouTube quota exceeded" });
    repo.latestBrief.mockResolvedValueOnce({ brief: { themes: [] } });
    repo.getSettings.mockResolvedValueOnce({ email: "me@x.co" });
    const res = await call(`Bearer ${process.env.CRON_SECRET}`);
    expect(res.status).toBe(500);
    expect(emailLib.sendBriefEmail).toHaveBeenCalledWith({ themes: [] }, "me@x.co", { stale: true });
    expect((await res.json()).staleEmailed).toBe(true);
  });
  it("on failure with no saved brief or no email, it does not try to send and does not crash", async () => {
    pipeline.runFullPipeline.mockResolvedValue({ runId: 5, error: "boom" });
    repo.latestBrief.mockResolvedValueOnce(null);
    repo.getSettings.mockResolvedValueOnce({ email: "me@x.co" });
    expect((await call(`Bearer ${process.env.CRON_SECRET}`)).status).toBe(500);
    repo.latestBrief.mockResolvedValueOnce({ brief: {} });
    repo.getSettings.mockResolvedValueOnce({ email: "" });
    expect((await call(`Bearer ${process.env.CRON_SECRET}`)).status).toBe(500);
    expect(emailLib.sendBriefEmail).not.toHaveBeenCalled();
  });
  it("survives the stale email itself failing", async () => {
    pipeline.runFullPipeline.mockResolvedValueOnce({ runId: 6, error: "boom" });
    repo.latestBrief.mockResolvedValueOnce({ brief: {} });
    repo.getSettings.mockResolvedValueOnce({ email: "me@x.co" });
    emailLib.sendBriefEmail.mockRejectedValueOnce(new Error("resend down"));
    const res = await call(`Bearer ${process.env.CRON_SECRET}`);
    expect(res.status).toBe(500);
    expect((await res.json()).staleEmailed).toBe(false);
  });
});

describe("GET /api/health and /api/brief/latest", () => {
  it("health reports up, and 503 when the database is unreachable (without leaking details)", async () => {
    dbLib.sql.mockReturnValueOnce(() => Promise.resolve([{ "?column?": 1 }]));
    expect((await healthRoute.GET()).status).toBe(200);
    dbLib.sql.mockReturnValueOnce(() => Promise.reject(new Error("password authentication failed for user postgres")));
    const res = await healthRoute.GET();
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("password");
  });
  it("latest returns whatever getLatest gives", async () => {
    latestLib.getLatest.mockResolvedValueOnce({ brief: null, stale: false });
    expect((await latestRoute.GET()).status).toBe(200);
  });
});
