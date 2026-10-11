import { median } from "./metrics";
import { generateJson } from "./gemini";
import { aiBriefSchema, briefSchema, type AiBrief, type Brief, type Theme, type VideoRow } from "./types";
import type { Cluster } from "./cluster";

export type ClusterFacts = {
  clusterId: number;
  videoCount: number;
  creatorCount: number;
  totalViews: number;
  avgVelocity: number;
  avgEngagement: number;
  medianLengthMin: number;
  topTags: string[];
  topVideos: { id: string; title: string; channel: string; url: string; views: number; lengthMin: number; publishedAt?: string }[];
};

const url = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export function buildFacts(videos: VideoRow[], clusters: Cluster[]): ClusterFacts[] {
  const byId = new Map(videos.map((v) => [v.id, v]));
  return clusters
    .map((c) => {
      const vs = c.itemIds.map((i) => byId.get(i)).filter((v): v is VideoRow => !!v);
      const tagCount = new Map<string, number>();
      vs.forEach((v) => v.tags.forEach((t) => tagCount.set(t.toLowerCase(), (tagCount.get(t.toLowerCase()) ?? 0) + 1)));
      const top = [...vs].sort((a, b) => b.views - a.views);
      // one example per channel first, so examples show breadth across creators
      const seen = new Set<string>();
      const diverse = [...top.filter((v) => !seen.has(v.channelId) && seen.add(v.channelId)), ...top].filter(
        (v, i, a) => a.indexOf(v) === i,
      );
      return {
        clusterId: c.id,
        videoCount: vs.length,
        creatorCount: new Set(vs.map((v) => v.channelId)).size,
        totalViews: vs.reduce((s, v) => s + v.views, 0),
        avgVelocity: Math.round(vs.reduce((s, v) => s + v.velocity, 0) / Math.max(vs.length, 1)),
        avgEngagement: +(vs.reduce((s, v) => s + v.engagement, 0) / Math.max(vs.length, 1)).toFixed(4),
        medianLengthMin: +(median(vs.map((v) => v.durationSec)) / 60).toFixed(1),
        topTags: [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t),
        topVideos: diverse.slice(0, 8).map((v) => ({
          id: v.id, title: v.title, channel: v.channel, url: url(v.id), views: v.views, publishedAt: v.publishedAt.toISOString(),
          lengthMin: +(v.durationSec / 60).toFixed(1),
        })),
      };
    })
    .sort((a, b) => b.totalViews * b.creatorCount - a.totalViews * a.creatorCount)
    .slice(0, 5);
}

export function buildPrompt(facts: ClusterFacts[], region: string, categories: string[]): string {
  return `You are a YouTube content strategist writing a weekly brief for a creator who posts 3 videos a week.
The creator's niche is defined ONLY by these tracked categories: ${categories.join(", ")}. Region: ${region}.
Tailor every name, angle and title to that niche. If a cluster is unrelated to the niche, mark it urgency "skip" and say so.

Below are topic clusters found this week. Each cluster has facts computed by code. STRICT RULES:
- Use ONLY numbers and video titles present in the data. Never invent statistics, channels, or URLs.
- Do not output URLs or video lists; the system attaches them.
- "whyNow" must cite real figures from the cluster (creator count, total views, average views/hour).
- Write for a creator: concrete, specific, no fluff.

DATA (JSON):
${JSON.stringify(facts.map((f) => ({ ...f, topVideos: f.topVideos.slice(0, 5).map((v) => ({ id: v.id, title: v.title, channel: v.channel, url: v.url, views: v.views, lengthMin: v.lengthMin })) })))}

Return JSON ONLY with this exact shape:
{
  "headline": ["line 1", "line 2", "line 3"],   // exactly 3 short lines: "This week in 3 lines"
  "themes": [ {
    "clusterId": <number from data>,
    "onNiche": true | false,   // true ONLY if this cluster is clearly about the tracked categories; false for general vlogs, entertainment, other topics
    "name": "short theme name",
    "summary": "1-2 sentences on what creators are covering",
    "whyNow": "1-2 sentences grounded in the cluster's numbers",
    "winningFormat": "format that is winning (e.g. hands-on tutorial, comparison, news reaction, listicle)",
    "filmingTitle": "a suggested video title for the creator",
    "filmingAngle": "1-2 sentences on the angle to take",
    "urgency": "film_now" | "soon" | "skip",
    "urgencyReason": "one line reason",
    "saturation": "low" | "medium" | "high"
  } ]
}
Include one theme per cluster provided (max 5). High velocity + few creators = low saturation, film_now. Many creators and high volume = higher saturation.`;
}

export function assembleBrief(
  ai: AiBrief,
  facts: ClusterFacts[],
  meta: { weekOf: string; videoCount: number; quotaUsed: number; dataSource: "live" | "cached" | "seed" },
): Brief {
  const byId = new Map(facts.map((f) => [f.clusterId, f]));
  const themes: Theme[] = [];
  // Prefer on-niche themes: drop off-niche ones when at least 3 on-niche themes remain, otherwise keep them (forced to "skip").
  const onNiche = ai.themes.filter((t) => t.onNiche);
  const keepOffNiche = onNiche.length < 3;
  for (const raw of keepOffNiche ? ai.themes : onNiche) {
    const t = keepOffNiche && !raw.onNiche ? { ...raw, urgency: "skip" as const } : raw;
    const f = byId.get(t.clusterId);
    if (!f) continue; // unknown cluster id from the model: ignore
    byId.delete(t.clusterId);
    // Example videos come only from the fetched set; URLs are rebuilt from the verified id.
    const exampleVideos = f.topVideos.slice(0, 8).map((v) => ({
      id: v.id, title: v.title, channel: v.channel, url: url(v.id), views: v.views, publishedAt: v.publishedAt,
    }));
    themes.push({
      name: t.name,
      summary: t.summary,
      whyNow: t.whyNow,
      stats: {
        creatorCount: f.creatorCount, videoCount: f.videoCount, totalViews: f.totalViews,
        avgVelocity: f.avgVelocity, avgEngagement: f.avgEngagement,
      },
      winningFormat: t.winningFormat,
      typicalLengthMinutes: Math.max(f.medianLengthMin, 0.1),
      exampleVideos,
      filmingAngle: { title: t.filmingTitle, angle: t.filmingAngle },
      urgency: { level: t.urgency, reason: t.urgencyReason },
      saturation: t.saturation,
    });
  }
  return briefSchema.parse({
    weekOf: meta.weekOf,
    headline: ai.headline,
    themes: themes.slice(0, 5),
    meta: { videoCount: meta.videoCount, quotaUsed: meta.quotaUsed, generatedAt: new Date().toISOString(), dataSource: meta.dataSource },
  });
}

/** Verify every example URL/id belongs to the fetched set. */
export function verifyExamples(brief: Brief, videos: { id: string }[]): void {
  const ids = new Set(videos.map((v) => v.id));
  for (const t of brief.themes)
    for (const v of t.exampleVideos)
      if (!ids.has(v.id) || v.url !== url(v.id)) throw new Error(`Unverified example video ${v.id}`);
}

export async function writeBrief(
  facts: ClusterFacts[],
  videos: VideoRow[],
  ctx: { region: string; categories: string[]; weekOf: string; quotaUsed: number; dataSource: "live" | "cached" | "seed"; settingsHash?: string },
): Promise<Brief> {
  const ai = await generateJson(buildPrompt(facts, ctx.region, ctx.categories), aiBriefSchema);
  const brief = assembleBrief(ai, facts, { ...ctx, videoCount: videos.length });
  brief.meta.categories = ctx.categories;
  brief.meta.region = ctx.region;
  brief.meta.settingsHash = ctx.settingsHash;
  verifyExamples(brief, videos);
  return brief;
}
