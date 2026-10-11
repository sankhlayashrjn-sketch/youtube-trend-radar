import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { briefSchema, type Brief, type Settings } from "./types";

export const DEFAULT_CATEGORIES = ["AI tools", "productivity apps", "tech reviews", "smartphone review", "ChatGPT"];

export function weekIdFor(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Calendar date in IST, e.g. 2026-10-11 */
export function istDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

/** Bump when fetch/cluster logic changes so cached videos from older logic are never reused. */
const PIPELINE_VERSION = "v3";

export function settingsHash(s: Pick<Settings, "region" | "categories">): string {
  return createHash("sha1")
    .update(PIPELINE_VERSION + "|" + s.region + "|" + [...s.categories].map((c) => c.toLowerCase().trim()).sort().join(","))
    .digest("hex")
    .slice(0, 12);
}

export async function getSettings(): Promise<Settings> {
  const rows = await db().select().from(schema.settings).where(eq(schema.settings.id, 1));
  if (rows[0]) return { categories: rows[0].categories, region: rows[0].region, email: rows[0].email, minViews: rows[0].minViews };
  const def: Settings = {
    categories: DEFAULT_CATEGORIES,
    region: "IN",
    email: process.env.EMAIL_TO ?? "",
    minViews: 0,
  };
  await db().insert(schema.settings).values({ id: 1, ...def }).onConflictDoNothing();
  return def;
}

export async function saveSettings(s: Settings): Promise<void> {
  await db()
    .insert(schema.settings)
    .values({ id: 1, ...s })
    .onConflictDoUpdate({ target: schema.settings.id, set: { ...s, updatedAt: new Date() } });
}

export type StoredBrief = { id: string; createdAt: Date; status: string; brief: Brief };

function parse(row: typeof schema.briefs.$inferSelect): StoredBrief | null {
  const r = briefSchema.safeParse(row.json);
  return r.success ? { id: row.id, createdAt: row.createdAt, status: row.status, brief: r.data } : null;
}

export async function saveBrief(brief: Brief): Promise<string> {
  const [row] = await db()
    .insert(schema.briefs)
    .values({ weekOf: brief.weekOf, json: brief, status: "ok", dataSource: brief.meta.dataSource })
    .returning({ id: schema.briefs.id });
  return row.id;
}

export async function latestBrief(): Promise<StoredBrief | null> {
  const rows = await db().select().from(schema.briefs).orderBy(desc(schema.briefs.createdAt)).limit(5);
  for (const r of rows) {
    const p = parse(r);
    if (p) return p;
  }
  return null;
}

export async function listBriefs(limit = 50) {
  const rows = await db().select().from(schema.briefs).orderBy(desc(schema.briefs.createdAt)).limit(limit);
  return rows.map(parse).filter((x): x is StoredBrief => !!x);
}

export async function getBrief(id: string): Promise<StoredBrief | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db().select().from(schema.briefs).where(eq(schema.briefs.id, id));
  return rows[0] ? parse(rows[0]) : null;
}

export async function latestRun() {
  const rows = await db().select().from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(1);
  return rows[0] ?? null;
}
