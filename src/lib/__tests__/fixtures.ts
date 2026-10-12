import type { Brief, Theme } from "../types";

type Video = Theme["exampleVideos"][number];

export const fullVideo = (id: string, views: number, over: Partial<Video> = {}): Video => ({
  id, title: `Title ${id}`, channel: `Channel ${id}`, url: `https://www.youtube.com/watch?v=${id}`, views,
  publishedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  channelId: `UC${id}`, likes: 4_400, comments: 1_300, durationSec: 754, velocity: 8_100, engagement: 0.042, ...over,
});

export const legacyVideo = (id: string, views: number): Video => ({
  id, title: `Legacy ${id}`, channel: `Old ${id}`, url: `https://www.youtube.com/watch?v=${id}`, views,
});

export function mkTheme(name: string, level: Theme["urgency"]["level"], o: { creators?: number; velocity?: number; views?: number; videos?: Video[]; cover?: Theme["cover"]; engagement?: number } = {}): Theme {
  return {
    name,
    summary: `Summary of ${name}.`,
    whyNow: `Why now for ${name}.`,
    stats: { creatorCount: o.creators ?? 5, videoCount: 8, totalViews: o.views ?? 1_000_000, avgVelocity: o.velocity ?? 1_000, avgEngagement: o.engagement ?? 0.05 },
    winningFormat: "hands-on tutorial",
    typicalLengthMinutes: 8,
    exampleVideos: o.videos ?? [fullVideo(`${name[0]}1`, 2_000_000), fullVideo(`${name[0]}2`, 30_000), fullVideo(`${name[0]}3`, 900)],
    filmingAngle: { title: `Film: ${name}`, angle: `Angle for ${name} that is long enough.` },
    cover: o.cover,
    urgency: { level, reason: `Reason ${level}` },
    saturation: "medium",
  };
}

export const THEMES = [
  mkTheme("Alpha Theme", "film_now", { creators: 4, velocity: 20_000, views: 500_000 }),
  mkTheme("Bravo Theme", "soon", { creators: 20, velocity: 5_000, views: 9_000_000 }),
  mkTheme("Charlie Theme", "skip", { creators: 9, velocity: 800, views: 100_000, engagement: 0.2 }),
];

export const BRIEF: Brief = {
  weekOf: "2026-10-12",
  headline: ["Headline line one here", "Headline line two here", "Headline line three here"],
  themes: THEMES,
  meta: { videoCount: 53, quotaUsed: 806, generatedAt: "2026-10-12T00:00:00Z", dataSource: "live", categories: ["AI tools"] },
};
