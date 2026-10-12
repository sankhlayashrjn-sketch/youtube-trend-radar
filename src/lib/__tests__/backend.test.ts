import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

const h = vi.hoisted(() => {
  process.env.YOUTUBE_API_KEY = "yt-key-for-tests";
  process.env.GEMINI_API_KEY = "gemini-key-for-tests";
  process.env.RESEND_API_KEY = "resend-key-for-tests";
  process.env.DATABASE_URL = "postgresql://u:p@localhost:6543/db";
  process.env.CRON_SECRET = "cron-secret-for-tests-1234567890";
  return {
    runRows: [] as unknown[],
    updates: [] as unknown[],
    getSettings: vi.fn(),
    embedTexts: vi.fn(),
    generateJson: vi.fn(),
    sendBriefEmail: vi.fn(),
    fetchTrendingVideos: vi.fn(),
  };
});

// A chainable stand-in for the Drizzle query builder: select().from().where() resolves to the run rows,
// update().set().where() records the patch.
vi.mock("../db", async (orig) => {
  const actual = await orig<typeof import("../db")>();
  const chain = (result: () => unknown) => {
    const p: Record<string, unknown> = {};
    for (const k of ["from", "where", "orderBy", "limit", "values", "returning"]) p[k] = () => p;
    p.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
    return p;
  };
  return {
    ...actual,
    db: () => ({
      select: () => chain(() => h.runRows),
      update: () => ({ set: (patch: unknown) => { h.updates.push(patch); return chain(() => []); } }),
      insert: () => chain(() => [{ id: 1 }]),
      delete: () => chain(() => []),
    }),
    sql: () => () => Promise.resolve([]),
  };
});
vi.mock("../repo", async (orig) => ({ ...(await orig<typeof import("../repo")>()), getSettings: h.getSettings }));
vi.mock("../gemini", () => ({ embedTexts: h.embedTexts, generateJson: h.generateJson }));
vi.mock("../email", () => ({ sendBriefEmail: h.sendBriefEmail }));
vi.mock("../youtube", async (orig) => ({ ...(await orig<typeof import("../youtube")>()), fetchTrendingVideos: h.fetchTrendingVideos }));

import { checkRunnable, isDuplicateCronDelivery, CRON_DEDUPE_MS, RUN_TTL_MS } from "../run-state";
import { RunStateError, runStage } from "../pipeline";
import { getDatabaseUrl } from "../env";
import { schema } from "../db";
import { securityHeaders } from "../../../next.config";

const NOW = new Date("2026-10-12T10:00:00Z").getTime();
const run = (over: Record<string, unknown> = {}) => ({ id: 7, status: "running", stage: "fetch", startedAt: new Date(NOW - 60_000), finishedAt: null, ...over });

describe("checkRunnable: a stage only runs for the right, live run (regression: any run id could replay any stage)", () => {
  it("allows a live run waiting for exactly that stage", () => {
    for (const stage of ["fetch", "cluster", "brief"] as const) expect(checkRunnable(run({ stage }), stage, NOW)).toBeNull();
  });
  it("rejects an unknown run", () => {
    expect(checkRunnable(undefined, "brief", NOW)).toMatch(/Unknown run/);
  });
  it("rejects runs that are done or failed (no replaying a finished run)", () => {
    expect(checkRunnable(run({ status: "done", stage: "done" }), "brief", NOW)).toMatch(/finished/);
    expect(checkRunnable(run({ status: "failed" }), "fetch", NOW)).toMatch(/finished/);
  });
  it("rejects stages out of order", () => {
    expect(checkRunnable(run({ stage: "fetch" }), "brief", NOW)).toMatch(/"fetch" stage, not "brief"/);
    expect(checkRunnable(run({ stage: "cluster" }), "brief", NOW)).not.toBeNull();
    expect(checkRunnable(run({ stage: "brief" }), "fetch", NOW)).not.toBeNull();
  });
  it("rejects repeating a stage that already advanced", () => {
    expect(checkRunnable(run({ stage: "cluster" }), "fetch", NOW)).not.toBeNull();
  });
  it("rejects expired runs, and accepts one just inside the limit", () => {
    expect(checkRunnable(run({ startedAt: new Date(NOW - RUN_TTL_MS - 1) }), "fetch", NOW)).toMatch(/expired/);
    expect(checkRunnable(run({ startedAt: new Date(NOW - RUN_TTL_MS + 1000) }), "fetch", NOW)).toBeNull();
  });
});

describe("runStage guard (regression: POST /api/generate {stage:'brief', runId:<anything>} used to run Gemini and send email)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.runRows = [];
    h.updates = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  const untouched = () => {
    expect(h.getSettings).not.toHaveBeenCalled();
    expect(h.embedTexts).not.toHaveBeenCalled();
    expect(h.generateJson).not.toHaveBeenCalled();
    expect(h.sendBriefEmail).not.toHaveBeenCalled();
    expect(h.fetchTrendingVideos).not.toHaveBeenCalled();
  };

  it("an unknown run id does nothing: no YouTube, no Gemini, no email", async () => {
    for (const stage of ["fetch", "cluster", "brief"] as const) {
      await expect(runStage(999_999, stage)).rejects.toBeInstanceOf(RunStateError);
    }
    untouched();
  });
  it("a finished run cannot be replayed", async () => {
    h.runRows = [run({ status: "done", stage: "done" })];
    await expect(runStage(7, "brief")).rejects.toBeInstanceOf(RunStateError);
    untouched();
  });
  it("jumping straight to 'brief' on a fresh run is refused", async () => {
    h.runRows = [run({ stage: "fetch" })];
    await expect(runStage(7, "brief")).rejects.toBeInstanceOf(RunStateError);
    untouched();
  });
  it("a refused request does not mark the (legitimate) run as failed", async () => {
    h.runRows = [run({ status: "done", stage: "done" })];
    await expect(runStage(7, "fetch")).rejects.toBeInstanceOf(RunStateError);
    expect(h.updates).toEqual([]);
  });
  it("a valid run passes the guard and reaches the stage, and a stage failure marks the run failed", async () => {
    h.runRows = [run({ stage: "fetch" })];
    h.getSettings.mockRejectedValueOnce(new Error("stop here"));
    const err = await runStage(7, "fetch").catch((e) => e);
    expect(err).not.toBeInstanceOf(RunStateError);
    expect(String(err.message)).toContain("stop here");
    expect(h.getSettings).toHaveBeenCalledTimes(1);
    expect(h.updates.some((u) => (u as { status?: string }).status === "failed")).toBe(true);
  });
});

describe("isDuplicateCronDelivery (regression: a repeated cron event could email twice)", () => {
  const done = (minsAgo: number, extra: Record<string, unknown> = {}) => ({
    status: "done", stage: "done", startedAt: new Date(NOW - (minsAgo + 1) * 60_000), finishedAt: new Date(NOW - minsAgo * 60_000), ...extra,
  });
  it("skips when a run succeeded within the dedupe window", () => {
    expect(isDuplicateCronDelivery(done(0.5), NOW)).toBe(true);
    expect(isDuplicateCronDelivery(done(29), NOW)).toBe(true);
  });
  it("does not skip after the window, for failed runs, or when there is no run", () => {
    expect(isDuplicateCronDelivery(done(CRON_DEDUPE_MS / 60_000 + 1), NOW)).toBe(false);
    expect(isDuplicateCronDelivery(done(1, { status: "failed" }), NOW)).toBe(false);
    expect(isDuplicateCronDelivery(done(1, { status: "running" }), NOW)).toBe(false);
    expect(isDuplicateCronDelivery(null, NOW)).toBe(false);
    expect(isDuplicateCronDelivery(undefined, NOW)).toBe(false);
  });
  it("falls back to the start time when there is no finish time, and ignores clock skew into the future", () => {
    expect(isDuplicateCronDelivery({ status: "done", stage: "done", startedAt: new Date(NOW - 60_000), finishedAt: null }, NOW)).toBe(true);
    expect(isDuplicateCronDelivery(done(-10), NOW)).toBe(false);
  });
});

describe("database config is independent of unrelated secrets", () => {
  it("getDatabaseUrl needs only DATABASE_URL", () => {
    const keep = { ...process.env };
    for (const k of ["RESEND_API_KEY", "GEMINI_API_KEY", "YOUTUBE_API_KEY", "CRON_SECRET"]) delete process.env[k];
    expect(getDatabaseUrl()).toContain("localhost:6543");
    Object.assign(process.env, keep);
  });
  it("rejects a missing or malformed URL without echoing it", () => {
    const keep = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "definitely not a url";
    let msg = "";
    try { getDatabaseUrl(); } catch (e) { msg = (e as Error).message; }
    expect(msg).toContain("DATABASE_URL");
    expect(msg).not.toContain("definitely not a url");
    delete process.env.DATABASE_URL;
    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL/);
    process.env.DATABASE_URL = keep;
  });
});

describe("schema integrity", () => {
  it("scripts cascade-delete with their brief (foreign key)", () => {
    const fks = getTableConfig(schema.scripts).foreignKeys;
    expect(fks).toHaveLength(1);
    expect(fks[0].onDelete).toBe("cascade");
  });
  it("one script per (brief, theme) is enforced by a unique index", () => {
    const idx = getTableConfig(schema.scripts).indexes.find((i) => i.config.name === "scripts_brief_theme_uq");
    expect(idx?.config.unique).toBe(true);
  });
  it("the videos table is indexed for the hot lookup (settings hash + week)", () => {
    expect(getTableConfig(schema.videos).indexes.some((i) => i.config.name === "videos_week_idx")).toBe(true);
  });
});

describe("security headers", () => {
  const get = (k: string) => securityHeaders.find((x) => x.key === k)?.value;
  it("sets the baseline hardening headers", () => {
    expect(get("X-Content-Type-Options")).toBe("nosniff");
    expect(get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(get("Permissions-Policy")).toContain("camera=()");
    expect(get("Strict-Transport-Security")).toContain("max-age=");
  });
});

describe("YouTube request timeout (regression: a hung connection used to eat the whole function time budget)", async () => {
  const { fetchTrendingVideos: realFetch, QuotaTracker } = await vi.importActual<typeof import("../youtube")>("../youtube");
  it("turns an aborted request into a clear error instead of hanging", async () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    await expect(realFetch({ region: "IN", categories: ["AI tools"], quota: new QuotaTracker() })).rejects.toThrow(/timed out/);
    vi.unstubAllGlobals();
  });
  it("reports an unreachable API distinctly, and never leaks the request URL or key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed: https://www.googleapis.com/youtube/v3/search?key=SECRETKEY")));
    const err = await realFetch({ region: "IN", categories: ["AI tools"], quota: new QuotaTracker() }).catch((e) => e);
    expect(String(err.message)).toMatch(/unreachable/);
    expect(String(err.message)).not.toContain("SECRETKEY");
    vi.unstubAllGlobals();
  });
});
