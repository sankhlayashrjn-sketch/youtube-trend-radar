import { latestBrief, latestRun } from "./repo";
import { seedBrief } from "./seed";
import type { Brief } from "./types";

export type LatestPayload = {
  brief: Brief | null;
  briefId: string | null;
  createdAt: string | null;
  stale: boolean;
  staleReason: string | null;
};

/** Latest saved brief (or the committed seed), flagged stale if the last run failed or it's old. */
export async function getLatest(): Promise<LatestPayload> {
  let stored = null;
  let run = null;
  try {
    [stored, run] = await Promise.all([latestBrief(), latestRun()]);
  } catch (e) {
    console.error("[latest] db unavailable:", (e as Error).message.slice(0, 200));
    const seed = seedBrief();
    return { brief: seed, briefId: null, createdAt: null, stale: true, staleReason: "Database unreachable: showing the bundled sample brief." };
  }
  if (!stored) {
    const seed = seedBrief();
    return { brief: seed, briefId: null, createdAt: null, stale: false, staleReason: null };
  }
  let staleReason: string | null = null;
  if (run && run.status === "failed" && run.startedAt > stored.createdAt) {
    staleReason = `The latest refresh failed (${run.error ?? "unknown error"}). Showing the last saved brief.`;
  } else if (Date.now() - stored.createdAt.getTime() > 8 * 86_400_000) {
    staleReason = "This brief is more than a week old.";
  }
  return {
    brief: stored.brief, briefId: stored.id, createdAt: stored.createdAt.toISOString(),
    stale: !!staleReason, staleReason,
  };
}
