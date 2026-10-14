import { describe, expect, it } from "vitest";
import { benchmarkTheme, clampRpm, fmtINR, forecastViews, incomeFromViews, quantile, roughRupees, DEFAULT_RPM_INR } from "@/lib/forecast";
import { fullVideo, mkTheme, THEMES } from "./fixtures";

const vids = (...v: number[]) => v.map((n, i) => fullVideo(`v${i}`, n));

describe("quantile", () => {
  it("interpolates and handles edge cases", () => {
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([7], 0.5)).toBe(7);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([4, 1, 3, 2], 0)).toBe(1);
    expect(quantile([4, 1, 3, 2], 1)).toBe(4);
  });
});

describe("forecastViews", () => {
  it("uses the median of the example videos with the quartiles as the range", () => {
    const t = mkTheme("Even", "soon", { videos: vids(1000, 2000, 3000, 4000, 5000) });
    const f = forecastViews(t);
    expect(f).toMatchObject({ low: 2000, expected: 3000, high: 4000, basedOn: 5, confidence: "reasonable" });
  });
  it("is higher for a film-now trend and lower for a skip trend, same videos", () => {
    const v = vids(1000, 2000, 3000);
    const now = forecastViews(mkTheme("A", "film_now", { videos: v })).expected;
    const soon = forecastViews(mkTheme("B", "soon", { videos: v })).expected;
    const skip = forecastViews(mkTheme("C", "skip", { videos: v })).expected;
    expect(now).toBeGreaterThan(soon);
    expect(soon).toBeGreaterThan(skip);
    expect(soon).toBe(2000);
  });
  it("a crowded topic gets a lower estimate than an empty one", () => {
    const base = mkTheme("D", "soon", { videos: vids(1000, 2000, 3000) });
    expect(forecastViews({ ...base, saturation: "high" }).expected).toBeLessThan(forecastViews({ ...base, saturation: "low" }).expected);
  });
  it("always keeps low <= expected <= high", () => {
    for (const lvl of ["film_now", "soon", "skip"] as const) {
      const f = forecastViews(mkTheme("E", lvl, { videos: vids(10, 10, 5_000_000) }));
      expect(f.low).toBeLessThanOrEqual(f.expected);
      expect(f.expected).toBeLessThanOrEqual(f.high);
    }
  });
  it("caps the best case at 3x the expected figure so one viral video does not inflate it", () => {
    const f = forecastViews(mkTheme("H", "soon", { videos: vids(1000, 1000, 1000, 9_000_000, 9_000_000) }));
    expect(f.expected).toBe(1000);
    expect(f.high).toBe(3000);
  });
  it("with a single example it widens the range and says it is rough", () => {
    const f = forecastViews(mkTheme("F", "soon", { videos: vids(10_000) }));
    expect(f).toMatchObject({ low: 5000, expected: 10_000, high: 15_000, confidence: "rough" });
  });
  it("never produces NaN or negatives", () => {
    const f = forecastViews(mkTheme("G", "skip", { videos: vids(0, 0) }));
    expect(f).toMatchObject({ low: 0, expected: 0, high: 0 });
  });
});

describe("income", () => {
  it("is views / 1000 x earnings per 1,000 views", () => {
    expect(incomeFromViews(100_000, 80)).toBe(8000);
    expect(incomeFromViews(0, 80)).toBe(0);
    expect(incomeFromViews(-5, 80)).toBe(0);
  });
  it("clamps nonsense earnings and falls back to the default for NaN", () => {
    expect(clampRpm(0)).toBe(10);
    expect(clampRpm(99999)).toBe(500);
    expect(clampRpm(NaN)).toBe(DEFAULT_RPM_INR);
  });
  it("rounds to a believable figure and uses Indian digit grouping", () => {
    expect(roughRupees(2760)).toBe(2800);
    expect(roughRupees(0)).toBe(0);
    expect(roughRupees(7)).toBe(7);
    expect(fmtINR(1_234_567)).toBe("₹12,00,000");
    expect(fmtINR(0)).toBe("₹0");
  });
});

describe("benchmarkTheme", () => {
  it("labels fewer creators and faster views as good, and the opposite as weak", () => {
    const [alpha, bravo] = THEMES; // Alpha: 4 creators, 20K/hr. Bravo: 20 creators, 5K/hr. Average creators 11
    const a = benchmarkTheme(alpha, THEMES);
    expect(a.creators.verdict).toBe("good");
    expect(a.velocity.verdict).toBe("good");
    expect(a.creators.avg).toBeCloseTo(11, 5);
    const b = benchmarkTheme(bravo, THEMES);
    expect(b.creators.verdict).toBe("weak");
    expect(b.views.verdict).toBe("good");
  });
  it("calls a figure within 20% of the average 'average'", () => {
    const same = [mkTheme("X", "soon", { creators: 10 }), mkTheme("Y", "soon", { creators: 11 }), mkTheme("Z", "soon", { creators: 12 })];
    expect(benchmarkTheme(same[1], same).creators.verdict).toBe("average");
  });
  it("copes with a single theme", () => {
    expect(benchmarkTheme(THEMES[0], [THEMES[0]]).creators.verdict).toBe("average");
    expect(benchmarkTheme(THEMES[0], []).views.ratio).toBe(1);
  });
});
