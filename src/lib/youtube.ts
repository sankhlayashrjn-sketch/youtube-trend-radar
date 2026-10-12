import { getEnv } from "./env";
import { engagementRate, parseIsoDuration, velocity } from "./metrics";
import type { VideoRow } from "./types";

const BASE = "https://www.googleapis.com/youtube/v3";
export const COST = { videosList: 1, search: 100 } as const;
export const MAX_SEARCHES = 10;
export const DAILY_QUOTA = 10_000;
/** Refuse to start a run if it could push the day's usage past this. */
export const QUOTA_GUARD = 9_000;

/**
 * Keyword -> YouTube videoCategoryId, so the "most popular" chart matches what the user tracks.
 * Only topic-specific categories are listed. Generic ones (Howto & Style, Entertainment, People & Blogs)
 * mostly return general vlogs, so lifestyle niches such as fashion rely on keyword searches instead.
 */
const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/\b(ai|tech|technology|gadgets?|smartphones?|phones?|laptops?|software|apps?|coding|programming|chatgpt|gemini|productivity|science)\b/i, "28"],
  [/gaming|game|esports|minecraft|bgmi|valorant/i, "20"],
  [/music|song|singer|album|rap/i, "10"],
  [/education|learn|study|exam|tutorial|course|upsc|jee|neet/i, "27"],
  [/sport|cricket|football|fitness|workout|gym|ipl|soccer/i, "17"],
  [/travel|trip|vlog.*travel|tourism/i, "19"],
  [/\b(cars?|bikes?|autos?|motors?|ev)\b/i, "2"],
  [/comedy|standup|stand-up|prank|meme/i, "23"],
  [/news|politic|election/i, "25"],
  [/movie|film|trailer|cinema|bollywood|web series/i, "1"],
    [/\b(pets?|dogs?|cats?|animals?)\b/i, "15"],
  [/finance|invest|stock|crypto|business|startup/i, "28"],
];

/** Up to 2 category ids that match the tracked keywords. Empty means "skip the chart, rely on searches". */
export function chartCategoriesFor(categories: string[]): string[] {
  const ids: string[] = [];
  for (const [re, id] of CATEGORY_KEYWORDS) {
    if (categories.some((c) => re.test(c)) && !ids.includes(id)) ids.push(id);
    if (ids.length === 2) break;
  }
  return ids;
}

/**
 * How to spend the search budget. Every keyword is always searched at least once (so no category is crowded out),
 * few keywords get extra result pages, and the total never exceeds MAX_SEARCHES.
 */
export function planSearches(keywordCount: number, target = 100, max = MAX_SEARCHES) {
  const keywords = Math.min(Math.max(keywordCount, 0), max);
  const pagesPerKw = keywords === 0 ? 0 : Math.min(4, Math.max(1, Math.floor(max / keywords)));
  const perPage = Math.min(50, Math.max(10, Math.ceil((target * 1.6) / Math.max(keywords * pagesPerKw, 1))));
  return { keywords, pagesPerKw, perPage, totalSearches: keywords * pagesPerKw };
}

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

  // 1) Most popular (1 unit each), only for YouTube categories that match the tracked keywords.
  for (const cat of chartCategoriesFor(categories)) {
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
  const plan = planSearches(categories.length, target);
  const kws = categories.slice(0, plan.keywords);
  const { pagesPerKw, perPage } = plan;
  let searches = 0;
  for (const q of kws) {
    let pageToken: string | undefined;
    for (let p = 0; p < pagesPerKw; p++) {
      quota.charge(COST.search);
      searches++;
      const r: { items: { id: { videoId?: string } }[]; nextPageToken?: string } = await yt("search", {
        part: "id", q, type: "video", order: "date", publishedAfter, regionCode: region, maxResults: perPage, pageToken,
      });
      r.items.forEach((i) => i.id.videoId && ids.add(i.id.videoId));
      pageToken = r.nextPageToken;
      if (!pageToken) break;
    }
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
