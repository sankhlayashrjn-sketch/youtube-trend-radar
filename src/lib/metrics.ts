export type DurationBucket = "short" | "medium" | "long";

export function velocity(views: number, publishedAt: Date, now = new Date()): number {
  const hours = Math.max((now.getTime() - publishedAt.getTime()) / 3_600_000, 1);
  return views / hours;
}

export function engagementRate(likes: number, comments: number, views: number): number {
  if (views <= 0) return 0;
  return (likes + comments) / views;
}

/** short < 5 min, medium 5-15 min, long > 15 min */
export function durationBucket(sec: number): DurationBucket {
  if (sec < 300) return "short";
  if (sec <= 900) return "medium";
  return "long";
}

/** Parse ISO-8601 duration like PT1H2M3S into seconds. */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, mi, s] = m.map((x) => (x ? parseInt(x, 10) : 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

export function uniqueChannelCount(videos: { channelId: string }[]): number {
  return new Set(videos.map((v) => v.channelId)).size;
}
