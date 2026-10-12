/** Pure rules about pipeline runs. No database access here, so they are easy to test. */

export type Stage = "fetch" | "cluster" | "brief";

type RunLike = { status: string; stage: string; startedAt: Date; finishedAt?: Date | null };

/** A run must finish within this long; older "running" rows are treated as abandoned. */
export const RUN_TTL_MS = 15 * 60_000;

/** Vercel documents that a cron event can occasionally be delivered more than once. */
export const CRON_DEDUPE_MS = 30 * 60_000;

/**
 * Returns a message when the stage must not run, otherwise null.
 * A stage may only run for a run that exists, is still running, is not expired, and is waiting for exactly that stage.
 * Without this check anyone could replay "brief" for any run id and trigger Gemini and an email with no rate limit.
 */
export function checkRunnable(run: RunLike | undefined, stage: Stage, now = Date.now()): string | null {
  if (!run) return "Unknown run. Start a new one.";
  if (run.status !== "running") return "This run has already finished. Start a new one.";
  if (now - run.startedAt.getTime() > RUN_TTL_MS) return "This run has expired. Start a new one.";
  if (run.stage !== stage) return `This run is at the "${run.stage}" stage, not "${stage}".`;
  return null;
}

/** True when the newest run already completed successfully a moment ago, so a repeated cron delivery should do nothing. */
export function isDuplicateCronDelivery(last: RunLike | null | undefined, now = Date.now()): boolean {
  if (!last || last.status !== "done") return false;
  const finished = (last.finishedAt ?? last.startedAt).getTime();
  return now - finished >= 0 && now - finished < CRON_DEDUPE_MS;
}
