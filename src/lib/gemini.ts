import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import { getEnv } from "./env";

let client: GoogleGenAI | null = null;
const ai = () => (client ??= new GoogleGenAI({ apiKey: getEnv().GEMINI_API_KEY }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimit(e: unknown) {
  const s = String((e as { status?: number; message?: string })?.status ?? "") + String((e as Error)?.message ?? "");
  return /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE/.test(s);
}

/** Retry with exponential backoff on Gemini 429/503. */
export async function withBackoff<T>(fn: () => Promise<T>, tries = 4, baseMs = 1500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isRateLimit(e) || i === tries - 1) break;
      await sleep(baseMs * 2 ** i + Math.random() * 400);
    }
  }
  throw last;
}

function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export const EMBED_DIMS = 768;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 50) {
    const batch = texts.slice(i, i + 50);
    const res = await withBackoff(() =>
      ai().models.embedContent({
        model: getEnv().GEMINI_EMBEDDING_MODEL,
        contents: batch,
        config: { outputDimensionality: EMBED_DIMS },
      }),
    );
    const vals = res.embeddings ?? [];
    if (vals.length !== batch.length) throw new Error("Embedding count mismatch");
    vals.forEach((e) => out.push(normalize(e.values ?? [])));
  }
  return out;
}

/** Ask Gemini Flash for JSON, validate with Zod; on failure retry once with the validation error. */
export async function generateJson<T>(prompt: string, schema: ZodType<T>): Promise<T> {
  const run = async (p: string) => {
    const res = await withBackoff(() =>
      ai().models.generateContent({
        model: getEnv().GEMINI_MODEL,
        contents: p,
        config: { responseMimeType: "application/json", temperature: 0.4 },
      }),
    );
    return res.text ?? "";
  };
  const attempt = (raw: string) => {
    let json: unknown;
    try {
      json = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      return { ok: false as const, error: "Response was not valid JSON" };
    }
    const r = schema.safeParse(json);
    return r.success ? { ok: true as const, data: r.data } : { ok: false as const, error: r.error.message };
  };

  const first = attempt(await run(prompt));
  if (first.ok) return first.data;
  const second = attempt(
    await run(`${prompt}\n\nYour previous answer was rejected: ${first.error.slice(0, 1500)}\nReturn corrected JSON only.`),
  );
  if (second.ok) return second.data;
  throw new Error(`Gemini returned invalid brief JSON twice: ${second.error.slice(0, 300)}`);
}

/** Plain-text generation (e.g. a draft script) with the same 429 backoff. */
export async function generateText(prompt: string, temperature = 0.7): Promise<string> {
  const res = await withBackoff(() =>
    ai().models.generateContent({ model: getEnv().GEMINI_MODEL, contents: prompt, config: { temperature } }),
  );
  const text = (res.text ?? "").trim();
  if (!text) throw new Error("Gemini returned an empty script");
  return text;
}
