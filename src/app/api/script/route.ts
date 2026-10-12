import { NextResponse } from "next/server";
import { getBrief, getScript, getSettings, saveScriptEdit, scriptsGeneratedToday, upsertGeneratedScript } from "@/lib/repo";
import { generateScript } from "@/lib/script";
import { scriptRequestSchema, scriptSaveSchema } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Protects the free Gemini quota: this app is public and has no login. */
const DAILY_CAP = 40;

const UUID = /^[0-9a-f-]{36}$/i;

/** Load a saved script: GET /api/script?briefId=...&themeIndex=0 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const briefId = sp.get("briefId") ?? "";
  const rawIndex = sp.get("themeIndex");
  // A missing parameter must not be read as theme 0 (Number(null) === 0).
  const themeIndex = rawIndex === null || rawIndex.trim() === "" ? NaN : Number(rawIndex);
  if (!UUID.test(briefId) || !Number.isInteger(themeIndex) || themeIndex < 0 || themeIndex > 4) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const s = await getScript(briefId, themeIndex);
  if (!s) return NextResponse.json({ script: null });
  return NextResponse.json({ script: { content: s.content, language: s.language, updatedAt: s.updatedAt } });
}

/** Draft (or re-draft) a script with Gemini Flash. Replaces any existing script for that theme. */
export async function POST(req: Request) {
  const parsed = scriptRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { briefId, themeIndex, language } = parsed.data;

  try {
    const stored = await getBrief(briefId);
    const theme = stored?.brief.themes[themeIndex];
    if (!stored || !theme) return NextResponse.json({ error: "Brief or theme not found" }, { status: 404 });

    if ((await scriptsGeneratedToday()) >= DAILY_CAP) {
      return NextResponse.json({ error: "Daily script limit reached. Try again tomorrow." }, { status: 429 });
    }
    const categories = stored.brief.meta.categories ?? (await getSettings()).categories;
    const content = await generateScript(theme, { categories, language });
    await upsertGeneratedScript(briefId, themeIndex, language, content);
    return NextResponse.json({ script: { content, language, updatedAt: new Date().toISOString() } });
  } catch (e) {
    console.error("[script] generate failed:", String((e as Error).message).slice(0, 200));
    return NextResponse.json({ error: "Couldn't draft the script. Please try again in a moment." }, { status: 502 });
  }
}

/** Save the creator's edits. */
export async function PUT(req: Request) {
  const parsed = scriptSaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { briefId, themeIndex, content } = parsed.data;
  const ok = await saveScriptEdit(briefId, themeIndex, content);
  if (!ok) return NextResponse.json({ error: "No script to save" }, { status: 404 });
  return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
}
