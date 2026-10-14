import type { Theme } from "@/lib/types";

/**
 * Expected-performance estimate, computed in code (no AI).
 *
 * Base: what the example videos in this theme actually reached (their median, with the 25th and 75th percentile
 * as the low and high case). Then two honest adjustments: how urgent the trend is, and how crowded the topic is.
 * It assumes a typical-size channel in this niche. A much bigger or smaller channel will land higher or lower.
 */
export type ViewForecast = { low: number; expected: number; high: number; basedOn: number; confidence: "rough" | "reasonable" };

export const URGENCY_FACTOR = { film_now: 1.15, soon: 1, skip: 0.8 } as const;
export const SATURATION_FACTOR = { low: 1.1, medium: 1, high: 0.85 } as const;

/** Linear-interpolated quantile of a list of numbers (q between 0 and 1). */
export function quantile(nums: number[], q: number): number {
  if (!nums.length) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

export function forecastViews(theme: Theme): ViewForecast {
  const views = theme.exampleVideos.map((v) => v.views).filter((v) => Number.isFinite(v) && v >= 0);
  const factor = URGENCY_FACTOR[theme.urgency.level] * SATURATION_FACTOR[theme.saturation];
  let p25: number, mid: number, p75: number;
  if (views.length >= 2) {
    p25 = quantile(views, 0.25);
    mid = quantile(views, 0.5);
    p75 = quantile(views, 0.75);
  } else {
    // Too few examples: fall back to the average video across the whole theme and widen the range.
    const avg = theme.stats.totalViews / Math.max(1, theme.stats.videoCount);
    mid = views[0] ?? avg;
    p25 = mid * 0.5;
    p75 = mid * 1.5;
  }
  const expected = Math.round(mid * factor);
  return {
    low: Math.min(Math.round(p25 * factor), expected),
    expected,
    // One viral outlier should not make the best case look normal: cap it at 3x the expected figure.
    high: Math.max(Math.min(Math.round(p75 * factor), expected * 3), expected),
    basedOn: Math.max(views.length, 1),
    confidence: views.length >= 5 ? "reasonable" : "rough",
  };
}

/** Typical YouTube ad revenue to the creator per 1,000 views for Indian tech audiences (rupees). Editable in the UI. */
export const DEFAULT_RPM_INR = 80;
export const RPM_MIN = 10;
export const RPM_MAX = 500;

export function clampRpm(n: number): number {
  return Number.isFinite(n) ? Math.min(RPM_MAX, Math.max(RPM_MIN, Math.round(n))) : DEFAULT_RPM_INR;
}

export const incomeFromViews = (views: number, rpm: number): number => (Math.max(0, views) / 1000) * clampRpm(rpm);

/** Round to a figure that doesn't pretend to be precise (2 significant digits). */
export function roughRupees(n: number): number {
  if (n <= 0) return 0;
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

export const fmtINR = (n: number): string => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(roughRupees(n))}`;

// ---------- reference points for the three stats shown under each theme ----------

export type StatKey = "creators" | "views" | "velocity";
export type Verdict = "good" | "average" | "weak";
export type StatBenchmark = { key: StatKey; value: number; avg: number; verdict: Verdict; ratio: number };

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

/** Compares a theme to the average of this week's themes. Fewer creators is good; more views and faster views are good. */
export function benchmarkTheme(theme: Theme, all: Theme[]): Record<StatKey, StatBenchmark> {
  const pool = all.length ? all : [theme];
  const make = (key: StatKey, value: number, vals: number[], lowerIsBetter: boolean): StatBenchmark => {
    const avg = mean(vals);
    const ratio = avg > 0 ? value / avg : 1;
    const better = lowerIsBetter ? ratio <= 0.8 : ratio >= 1.2;
    const worse = lowerIsBetter ? ratio >= 1.2 : ratio <= 0.8;
    return { key, value, avg, ratio, verdict: better ? "good" : worse ? "weak" : "average" };
  };
  return {
    creators: make("creators", theme.stats.creatorCount, pool.map((t) => t.stats.creatorCount), true),
    views: make("views", theme.stats.totalViews, pool.map((t) => t.stats.totalViews), false),
    velocity: make("velocity", theme.stats.avgVelocity, pool.map((t) => t.stats.avgVelocity), false),
  };
}
