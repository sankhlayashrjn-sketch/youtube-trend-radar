import { getEnv } from "./env";
import { engagementRate, parseIsoDuration, velocity } from "./metrics";
import type { VideoRow } from "./types";

const BASE = "https://www.googleapis.com/youtube/v3";
export const COST = { videosList: 1, search: 100 } as const;
export const MAX_SEARCHES = 10;
export const DAILY_QUOTA = 10_000;
/** Refuse to start a run if it could push the day's usage past this. */
export const QUOTA_GUARD = 9_000;

export class QuotaTracker {
  used = 0;
  constructor(public readonly budget = 1_500) {}
  charge(units: number) {
    if (this.used + units > this.budget) throw new Error(`Quota guard: run budget ${this.budget} exceeded`);
    this.used += units;
  }
}

async function yt<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  url.searchParams.set("key", getEnv().YOUTUBE_API_KEY);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    const reason = /quotaExceeded|rateLimitExceeded/.test(body) ? "YouTube quota exceeded" : `YouTube API ${res.status}`;
    throw new Error(reason);
  }
  return res.json() as Promise<T>;
}

type RawVideo = {
  id: string;
  snippet?: { title: string; channelTitle: string; channelId: string; publishedAt: string; tags?: string[] };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
};

export function toRow(v: RawVideo, now = new Date()): VideoRow | null {
  if (!v.snippet) return null;
  const views = Number(v.statistics?.viewCount ?? 0);
  const likes = Number(v.statistics?.likeCount ?? 0);
  const comments = Number(v.statistics?.commentCount ?? 0);
  const publishedAt = new Date(v.snippet.publishedAt);
  return {
    id: v.id,
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    channelId: v.snippet.channelId,
    views, likes, comments,
    durationSec: parseIsoDuration(v.contentDetails?.duration ?? ""),
    publishedAt,
    tags: (v.snippet.tags ?? []).slice(0, 15),
    velocity: velocity(views, publishedAt, now),
    engagement: engagementRate(likes, comments, views),
  };
}

export type FetchResult = { videos: VideoRow[]; quotaUsed: number; searches: number };

export async function fetchTrendingVideos(opts: {
  region: string;
  categories: string[];
  quota: QuotaTracker;
  target?: number;
}): Promise<FetchResult> {
  const { region, categories, quota, target = 100 } = opts;
  const ids = new Set<string>();

  // 1) Most popular (1 unit each), filtered to tech-relevant categories: Science & Technology (28), Education (27).
  for (const cat of ["28", "27"]) {
    quota.charge(COST.videosList);
    const r = await yt<{ items: { id: string }[] }>("videos", {
      part: "id", chart: "mostPopular", regionCode: region, videoCategoryId: cat, maxResults: 50,
    }).catch((e) => {
      // A category chart can be unsupported for some regions; searches still cover the topic.
      if (/quota/i.test(String(e))) throw e;
      return { items: [] };
    });
    r.items.forEach((i) => ids.add(i.id));
  }

  // 2) Keyword searches (100 units each, capped), recent 7 days.
  const publishedAfter = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const kws = categories.slice(0, MAX_SEARCHES);
  let searches = 0;
  for (const q of kws) {
    quota.charge(COST.search);
    searches++;
    const r = await yt<{ items: { id: { videoId?: string } }[] }>("search", {
      part: "id", q, type: "video", order: "date", publishedAfter, regionCode: region, maxResults: 15,
    });
    r.items.forEach((i) => i.id.videoId && ids.add(i.id.videoId));
    if (ids.size >= target * 2) break;
  }

  // 3) Details in batches of 50.
  const all = [...ids];
  const now = new Date();
  const rows: VideoRow[] = [];
  for (let i = 0; i < all.length; i += 50) {
    quota.charge(COST.videosList);
    const r = await yt<{ items: RawVideo[] }>("videos", {
      part: "snippet,statistics,contentDetails", id: all.slice(i, i + 50).join(","), maxResults: 50,
    });
    for (const v of r.items) {
      const row = toRow(v, now);
      if (row) rows.push(row);
    }
  }

  // Keep recent (<=14d), drop Shorts (<=60s) so length stats reflect real long-form, rank by velocity.
  const cutoff = Date.now() - 14 * 86_400_000;
  const kept = rows
    .filter((r) => r.publishedAt.getTime() >= cutoff && r.durationSec > 60 && r.views > 0)
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, target);
  return { videos: kept, quotaUsed: quota.used, searches };
}
