import { and, eq, gte, sql as dsql } from "drizzle-orm";
import { db, schema, sql } from "./db";
import { getSettings, istDate, latestBrief, saveBrief, settingsHash, weekIdFor } from "./repo";
import { fetchTrendingVideos, QuotaTracker, QUOTA_GUARD } from "./youtube";
import { embedTexts } from "./gemini";
import { clusterVideos } from "./cluster";
import { buildFacts, writeBrief } from "./brief";
import { sendBriefEmail } from "./email";
import type { Brief, VideoRow } from "./types";

export type Stage = "fetch" | "cluster" | "brief";
export const STAGES: Stage[] = ["fetch", "cluster", "brief"];

export class RateLimitError extends Error {}

const MIN_VIDEOS = 12;

function startOfUtcDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Create a run row. Manual runs are rate limited to protect YouTube quota. */
export async function startRun(opts: { manual: boolean }): Promise<number> {
  const d = db();
  if (opts.manual) {
    const recent = await d.select().from(schema.runs).where(gte(schema.runs.startedAt, new Date(Date.now() - 3_600_000)));
    if (recent.some((r) => r.status === "running" && Date.now() - r.startedAt.getTime() < 180_000))
      throw new RateLimitError("A run is already in progress. Please wait a minute.");
    if (recent.length >= 4) throw new RateLimitError("Rate limit: max 4 runs per hour. Try again later.");
  }
  const [row] = await d.insert(schema.runs).values({ status: "running", stage: "fetch" }).returning({ id: schema.runs.id });
  return row.id;
}

async function setRun(id: number, patch: Partial<typeof schema.runs.$inferInsert>) {
  await db().update(schema.runs).set(patch).where(eq(schema.runs.id, id));
}

function safeMessage(e: unknown): string {
  return String((e as Error)?.message ?? e)
    .replace(/(key|token|secret)=[^&\s]+/gi, "$1=***")
    .replace(/postgres(ql)?:\/\/\S+/gi, "postgres://***")
    .slice(0, 400);
}

async function loadVideos(hash: string, weekId: string) {
  return db()
    .select()
    .from(schema.videos)
    .where(and(eq(schema.videos.settingsHash, hash), eq(schema.videos.weekId, weekId)));
}

async function stageFetch(runId: number) {
  const s = await getSettings();
  const hash = settingsHash(s);
  const weekId = weekIdFor();
  const d = db();

  // Daily cache: fresh data for the same settings fetched today => skip YouTube entirely.
  const cached = await d
    .select({ n: dsql<number>`count(*)::int` })
    .from(schema.videos)
    .where(and(eq(schema.videos.settingsHash, hash), gte(schema.videos.fetchedAt, startOfUtcDay())));
  if ((cached[0]?.n ?? 0) >= MIN_VIDEOS) {
    await setRun(runId, { stage: "cluster", quotaUsed: 0 });
    return { cached: true, videos: cached[0].n, quotaUsed: 0 };
  }

  // Daily quota guard across runs.
  const used = await d
    .select({ q: dsql<number>`coalesce(sum(quota_used),0)::int` })
    .from(schema.runs)
    .where(gte(schema.runs.startedAt, new Date(Date.now() - 86_400_000)));
  if ((used[0]?.q ?? 0) + 1_300 > QUOTA_GUARD) throw new Error("Daily YouTube quota guard reached; using last saved brief.");

  const quota = new QuotaTracker();
  let result;
  try {
    result = await fetchTrendingVideos({ region: s.region, categories: s.categories, quota });
  } catch (e) {
    await setRun(runId, { quotaUsed: quota.used });
    throw e;
  }
  if (result.videos.length < MIN_VIDEOS) throw new Error(`Only ${result.videos.length} videos found; need at least ${MIN_VIDEOS}.`);

  await d.delete(schema.videos).where(and(eq(schema.videos.settingsHash, hash), eq(schema.videos.weekId, weekId)));
  const now = new Date();
  const rows = result.videos.map((v) => ({
    ...v, weekId, region: s.region, settingsHash: hash, fetchedAt: now,
  }));
  for (let i = 0; i < rows.length; i += 50) await d.insert(schema.videos).values(rows.slice(i, i + 50));
  await setRun(runId, { stage: "cluster", quotaUsed: result.quotaUsed });
  return { cached: false, videos: rows.length, quotaUsed: result.quotaUsed };
}

async function stageCluster(runId: number) {
  const s = await getSettings();
  const hash = settingsHash(s);
  const rows = await loadVideos(hash, weekIdFor());
  const todo = rows.filter((r) => !r.embedding);
  if (todo.length) {
    const vecs = await embedTexts(todo.map((v) => `${v.title}. ${v.tags.slice(0, 8).join(", ")}`));
    const ids = todo.map((v) => v.id);
    const payload = vecs.map((v) => JSON.stringify(v));
    const c = sql();
    await c`update videos set embedding = d.e::jsonb
            from unnest(${c.array(ids, 25)}, ${c.array(payload, 25)}) as d(id, e)
            where videos.id = d.id and videos.settings_hash = ${hash} and videos.week_id = ${weekIdFor()}`;
  }
  await setRun(runId, { stage: "brief" });
  return { embedded: todo.length, total: rows.length };
}

async function stageBrief(runId: number, opts: { email: boolean }) {
  const s = await getSettings();
  const hash = settingsHash(s);
  const rows = await loadVideos(hash, weekIdFor());
  const withVec = rows.filter((r) => r.embedding);
  if (withVec.length < MIN_VIDEOS) throw new Error("Not enough embedded videos to cluster.");

  const { clusters } = clusterVideos(withVec.map((r) => ({ id: r.id, channelId: r.channelId, vec: r.embedding! })));
  if (clusters.length < 3)
    throw new Error(`Only ${clusters.length} multi-creator trends found this week (need 3); keeping the last brief.`);

  const videos: VideoRow[] = withVec.map((r) => ({
    id: r.id, title: r.title, channel: r.channel, channelId: r.channelId, views: r.views, likes: r.likes,
    comments: r.comments, durationSec: r.durationSec, publishedAt: r.publishedAt, tags: r.tags,
    velocity: r.velocity, engagement: r.engagement,
  }));
  const facts = buildFacts(videos, clusters);
  const run = (await db().select().from(schema.runs).where(eq(schema.runs.id, runId)))[0];
  const quotaUsed = run?.quotaUsed ?? 0;
  const brief = await writeBrief(facts, videos, {
    region: s.region, categories: s.categories, weekOf: istDate(), quotaUsed,
    dataSource: quotaUsed === 0 ? "cached" : "live", settingsHash: hash,
  });
  const briefId = await saveBrief(brief);

  let emailError: string | null = null;
  if (opts.email && s.email) {
    try {
      await sendBriefEmail(brief, s.email);
    } catch (e) {
      emailError = safeMessage(e);
    }
  }
  await setRun(runId, { stage: "done", status: "done", finishedAt: new Date(), error: emailError ? `Brief saved; email failed: ${emailError}` : null });
  return { briefId, brief, emailSent: opts.email && !!s.email && !emailError, emailError };
}

/** Run a single stage; on failure, mark the run failed (last saved brief stays visible as stale). */
export async function runStage(runId: number, stage: Stage, opts: { email?: boolean } = {}) {
  try {
    if (stage === "fetch") return await stageFetch(runId);
    if (stage === "cluster") return await stageCluster(runId);
    return await stageBrief(runId, { email: opts.email ?? true });
  } catch (e) {
    const msg = safeMessage(e);
    console.error(`[pipeline] stage ${stage} failed:`, msg);
    await setRun(runId, { status: "failed", error: msg, finishedAt: new Date() });
    throw new Error(msg);
  }
}

/** All stages in one call (cron). Each stage persists, so a retry resumes from the daily cache. */
export async function runFullPipeline(opts: { manual: boolean; email?: boolean }): Promise<{ runId: number; brief?: Brief; error?: string }> {
  const runId = await startRun({ manual: opts.manual });
  try {
    await runStage(runId, "fetch");
    await runStage(runId, "cluster");
    const r = (await runStage(runId, "brief", { email: opts.email })) as { brief: Brief };
    return { runId, brief: r.brief };
  } catch (e) {
    const stale = await latestBrief();
    return { runId, brief: stale?.brief, error: (e as Error).message };
  }
}
