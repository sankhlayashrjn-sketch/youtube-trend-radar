import { describe, expect, it } from "vitest";
import { computeInsights, computeSignals } from "../signals";
import type { Theme } from "../types";

const mk = (creatorCount: number, avgVelocity: number, avgEngagement: number): Theme => ({
  name: "t", summary: "s".repeat(12), whyNow: "w".repeat(12),
  stats: { creatorCount, videoCount: 5, totalViews: 1000, avgVelocity, avgEngagement },
  winningFormat: "fmt", typicalLengthMinutes: 5,
  exampleVideos: [{ id: "a", title: "t", channel: "c", url: "https://youtube.com/watch?v=a", views: 1 }],
  filmingAngle: { title: "title", angle: "a".repeat(12) },
  urgency: { level: "soon", reason: "r" }, saturation: "low",
});

describe("signals", () => {
  const themes = [mk(30, 1000, 0.02), mk(4, 28000, 0.05), mk(12, 3000, 0.1)];
  it("scores 15-100 relative to other themes and ranks low-competition fast themes best", () => {
    const s = computeSignals(themes);
    for (const x of s) for (const v of Object.values(x)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    expect(s[1].momentum).toBe(100);
    expect(s[0].competition).toBe(100);
    expect(s[1].opportunity).toBeGreaterThan(s[0].opportunity);
  });
  it("derives insights from real numbers", () => {
    const i = computeInsights(themes, computeSignals(themes));
    expect(i.find((x) => x.key === "bestBet")?.themeIndex).toBe(1);
    expect(i.find((x) => x.key === "crowded")?.themeIndex).toBe(0);
    expect(i.find((x) => x.key === "loved")?.themeIndex).toBe(2);
  });
  it("(regression) there are exactly three signals and no 'Fastest riser'", () => {
    const i = computeInsights(themes, computeSignals(themes));
    expect(i.map((x) => x.key)).toEqual(["bestBet", "crowded", "loved"]);
    expect(JSON.stringify(i)).not.toMatch(/fastest/i);
  });
  it("handles a single theme without NaN", () => {
    const s = computeSignals([mk(5, 100, 0.01)]);
    expect(Number.isNaN(s[0].opportunity)).toBe(false);
  });
});
