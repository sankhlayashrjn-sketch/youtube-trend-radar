import { getSettings, latestBrief, latestRun, settingsHash } from "./repo";
import { seedBrief } from "./seed";
import type { Brief, Settings } from "./types";

export type LatestPayload = {
  brief: Brief | null;
  briefId: string | null;
  createdAt: string | null;
  stale: boolean;
  staleReason: string | null;
  /** The newest brief was built for different categories/region than the current settings. */
  settingsMismatch: boolean;
  /** Categories the newest brief was built for (when known). */
  briefCategories: string[] | null;
  settings: Settings | null;
};

const base = { stale: false, staleReason: null, settingsMismatch: false, briefCategories: null, settings: null } as const;

/** Latest saved brief (or the committed seed), flagged stale if the last run failed or it's old. */
export async function getLatest(): Promise<LatestPayload> {
  let stored = null;
  let run = null;
  let settings: Settings | null = null;
  try {
    [stored, run, settings] = await Promise.all([latestBrief(), latestRun(), getSettings()]);
  } catch (e) {
    console.error("[latest] db unavailable:", (e as Error).message.slice(0, 200));
    return { ...base, brief: seedBrief(), briefId: null, createdAt: null, stale: true, staleReason: "Database unreachable: showing the bundled sample brief." };
  }
  if (!stored) return { ...base, brief: seedBrief(), briefId: null, createdAt: null, settings };

  // A brief made for other categories/region must not be presented as this week's brief for the current settings.
  const m = stored.brief.meta;
  const settingsMismatch = m.settingsHash ? m.settingsHash !== settingsHash(settings) : true;

  let staleReason: string | null = null;
  if (run && run.status === "failed" && run.startedAt > stored.createdAt) {
    staleReason = `The latest refresh failed (${run.error ?? "unknown error"}). Showing the last saved brief.`;
  } else if (Date.now() - stored.createdAt.getTime() > 8 * 86_400_000) {
    staleReason = "This brief is more than a week old.";
  }
  return {
    brief: stored.brief, briefId: stored.id, createdAt: stored.createdAt.toISOString(),
    stale: !!staleReason, staleReason, settingsMismatch, briefCategories: m.categories ?? null, settings,
  };
}
