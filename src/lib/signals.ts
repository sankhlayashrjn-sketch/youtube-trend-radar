import type { Theme } from "@/lib/types";

/** Deterministic, code-computed signals (0-100) relative to the other themes in the same brief. */
export type ThemeSignals = {
  momentum: number; // views/hour vs the other themes
  competition: number; // creator count vs the other themes
  engagement: number; // (likes+comments)/views vs the other themes
  opportunity: number; // high momentum + low competition (+ a little engagement)
};

const scale = (v: number, min: number, max: number) => (max === min ? 50 : Math.round(15 + (85 * (v - min)) / (max - min)));

export function computeSignals(themes: Theme[]): ThemeSignals[] {
  const vel = themes.map((t) => t.stats.avgVelocity);
  const cre = themes.map((t) => t.stats.creatorCount);
  const eng = themes.map((t) => t.stats.avgEngagement);
  const r = (a: number[]) => [Math.min(...a), Math.max(...a)] as const;
  const [vMin, vMax] = r(vel), [cMin, cMax] = r(cre), [eMin, eMax] = r(eng);
  return themes.map((t) => {
    const momentum = scale(t.stats.avgVelocity, vMin, vMax);
    const competition = scale(t.stats.creatorCount, cMin, cMax);
    const engagement = scale(t.stats.avgEngagement, eMin, eMax);
    const opportunity = Math.round(0.5 * momentum + 0.35 * (100 - competition) + 0.15 * engagement);
    return { momentum, competition, engagement, opportunity };
  });
}

export type Insight = {
  key: "bestBet" | "fastest" | "crowded" | "loved";
  label: string;
  themeIndex: number;
  detail: string;
};

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));
const argmax = (a: number[]) => a.reduce((best, v, i) => (v > a[best] ? i : best), 0);

export function computeInsights(themes: Theme[], sig: ThemeSignals[]): Insight[] {
  if (!themes.length) return [];
  const best = argmax(sig.map((s) => s.opportunity));
  const fast = argmax(themes.map((t) => t.stats.avgVelocity));
  const crowd = argmax(themes.map((t) => t.stats.creatorCount));
  const loved = argmax(themes.map((t) => t.stats.avgEngagement));
  return [
    { key: "bestBet", label: "Best bet", themeIndex: best, detail: `${fmt(themes[best].stats.avgVelocity)} views/hr with only ${themes[best].stats.creatorCount} creators` },
    { key: "fastest", label: "Fastest riser", themeIndex: fast, detail: `${fmt(themes[fast].stats.avgVelocity)} views per hour on average` },
    { key: "crowded", label: "Most crowded", themeIndex: crowd, detail: `${themes[crowd].stats.creatorCount} creators already covering it` },
    { key: "loved", label: "Audience loves", themeIndex: loved, detail: `${(themes[loved].stats.avgEngagement * 100).toFixed(1)}% likes + comments per view` },
  ];
}

export function median(nums: number[]): number {
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : 0;
}
