import { describe, expect, it } from "vitest";
import { durationBucket, engagementRate, median, parseIsoDuration, uniqueChannelCount, velocity } from "../metrics";
import { fmtDay, fmtDuration, fmtNum, fmtPct, timeAgo } from "../format";
import { toRow, planSearches, MAX_SEARCHES, QuotaTracker, COST } from "../youtube";
import { settingsHash, weekIdFor, istDate } from "../repo";
import { clusterVideos, filterMultiCreator, kmeans, silhouette } from "../cluster";
import { deriveCoverText, wrapWords } from "../cover";
import { renderEmail } from "../email";
import type { Brief } from "../types";

describe("metrics edge cases", () => {
  const now = new Date("2026-10-12T00:00:00Z");
  it("velocity never divides by less than one hour, even for future timestamps", () => {
    expect(velocity(500, new Date("2026-10-12T00:30:00Z"), now)).toBe(500);
    expect(velocity(500, new Date("2027-01-01T00:00:00Z"), now)).toBe(500);
    expect(velocity(0, new Date("2026-10-01T00:00:00Z"), now)).toBe(0);
  });
  it("engagement handles zero/negative views and likes above views", () => {
    expect(engagementRate(5, 5, 0)).toBe(0);
    expect(engagementRate(5, 5, -3)).toBe(0);
    expect(engagementRate(200, 0, 100)).toBe(2);
  });
  it("duration buckets at the exact boundaries", () => {
    expect(durationBucket(0)).toBe("short");
    expect(durationBucket(299)).toBe("short");
    expect(durationBucket(300)).toBe("medium");
    expect(durationBucket(900)).toBe("medium");
    expect(durationBucket(901)).toBe("long");
  });
  it("parses odd ISO durations safely", () => {
    expect(parseIsoDuration("")).toBe(0);
    expect(parseIsoDuration("garbage")).toBe(0);
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("PT0S")).toBe(0);
    expect(parseIsoDuration("P1DT2H")).toBe(86400 + 7200);
    expect(parseIsoDuration("PT10M")).toBe(600);
    expect(parseIsoDuration("PT1H")).toBe(3600);
  });
  it("median of empty, one and unsorted lists", () => {
    expect(median([])).toBe(0);
    expect(median([7])).toBe(7);
    expect(median([9, 1, 5])).toBe(5);
  });
  it("counts unique channels, including none", () => {
    expect(uniqueChannelCount([])).toBe(0);
  });
});

describe("formatting edge cases", () => {
  it("fmtNum at unit boundaries (Indian K / L / Cr)", () => {
    expect(fmtNum(0)).toBe("0");
    expect(fmtNum(999)).toBe("999");
    expect(fmtNum(1000)).toBe("1.0K");
    expect(fmtNum(99_999)).toBe("100.0K");
    expect(fmtNum(100_000)).toBe("1.0L");
    expect(fmtNum(10_000_000)).toBe("1.0Cr");
    expect(fmtNum(25_833_809)).toBe("2.6Cr");
  });
  it("timeAgo: today, singular, plural, weeks, future and missing", () => {
    const now = new Date("2026-10-12T12:00:00Z").getTime();
    expect(timeAgo(undefined, now)).toBe("");
    expect(timeAgo("2026-10-12T01:00:00Z", now)).toBe("today");
    expect(timeAgo("2026-10-11T01:00:00Z", now)).toBe("1 day ago");
    expect(timeAgo("2026-10-09T12:00:00Z", now)).toBe("3 days ago");
    expect(timeAgo("2026-09-28T12:00:00Z", now)).toBe("2 weeks ago");
    expect(timeAgo("2026-10-20T12:00:00Z", now)).toBe("today");
  });
  it("fmtDuration / fmtPct / fmtDay edge values", () => {
    expect(fmtDuration(undefined)).toBe("");
    expect(fmtDuration(-5)).toBe("");
    expect(fmtDuration(59)).toBe("0:59");
    expect(fmtDuration(60)).toBe("1:00");
    expect(fmtDuration(3600)).toBe("1:00:00");
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtPct(undefined)).toBe("");
    expect(fmtDay(undefined)).toBe("");
    expect(fmtDay("2026-10-08T00:00:00Z")).toBe("8 Oct 2026");
  });
});

describe("youtube row mapping", () => {
  const raw = {
    id: "abc",
    snippet: { title: "T", channelTitle: "C", channelId: "cid", publishedAt: "2026-10-10T00:00:00Z", tags: Array.from({ length: 40 }, (_, i) => `t${i}`) },
    statistics: { viewCount: "1000", likeCount: "50", commentCount: "5" },
    contentDetails: { duration: "PT12M34S" },
  };
  const now = new Date("2026-10-12T00:00:00Z");
  it("maps a normal video and caps tags at 15", () => {
    const r = toRow(raw, now)!;
    expect(r.views).toBe(1000);
    expect(r.durationSec).toBe(754);
    expect(r.tags).toHaveLength(15);
    expect(r.velocity).toBeCloseTo(1000 / 48);
  });
  it("survives hidden likes/comments, missing stats, missing tags and missing duration", () => {
    const r = toRow({ id: "x", snippet: { title: "T", channelTitle: "C", channelId: "c", publishedAt: "2026-10-11T00:00:00Z" } }, now)!;
    expect([r.views, r.likes, r.comments, r.durationSec, r.engagement]).toEqual([0, 0, 0, 0, 0]);
    expect(r.tags).toEqual([]);
  });
  it("returns null when the snippet is missing", () => {
    expect(toRow({ id: "nosnippet" }, now)).toBeNull();
  });
});

describe("search budget planning (regression: an early cap crowded out later keywords)", () => {
  it("always searches every keyword (up to the cap) and never exceeds MAX_SEARCHES", () => {
    for (let n = 1; n <= 20; n++) {
      const p = planSearches(n);
      expect(p.keywords).toBe(Math.min(n, MAX_SEARCHES));
      expect(p.pagesPerKw).toBeGreaterThanOrEqual(1);
      expect(p.totalSearches).toBeLessThanOrEqual(MAX_SEARCHES);
      expect(p.perPage).toBeGreaterThanOrEqual(10);
      expect(p.perPage).toBeLessThanOrEqual(50);
    }
  });
  it("gives few keywords extra pages and many keywords one page each", () => {
    expect(planSearches(1).pagesPerKw).toBe(4);
    expect(planSearches(2).pagesPerKw).toBe(4);
    expect(planSearches(5).pagesPerKw).toBe(2);
    expect(planSearches(8).pagesPerKw).toBe(1);
    expect(planSearches(8).totalSearches).toBe(8);
  });
  it("handles zero keywords without dividing by zero", () => {
    expect(planSearches(0)).toMatchObject({ keywords: 0, totalSearches: 0 });
  });
  it("a whole 8-keyword run stays inside the quota budget", () => {
    const q = new QuotaTracker();
    const p = planSearches(8);
    expect(() => {
      q.charge(COST.videosList * 2);
      for (let i = 0; i < p.totalSearches; i++) q.charge(COST.search);
      q.charge(COST.videosList * 3);
    }).not.toThrow();
    expect(q.used).toBeLessThan(1000);
  });
  it("QuotaTracker refuses to exceed its budget", () => {
    const q = new QuotaTracker(250);
    q.charge(100);
    q.charge(100);
    expect(() => q.charge(100)).toThrow(/Quota guard/);
  });
});

describe("repo pure helpers", () => {
  it("settingsHash ignores case, order and spaces but not region or keywords", () => {
    const a = settingsHash({ region: "IN", categories: ["AI tools", "ChatGPT"] });
    expect(settingsHash({ region: "IN", categories: [" chatgpt ", "ai TOOLS"] })).toBe(a);
    expect(settingsHash({ region: "US", categories: ["AI tools", "ChatGPT"] })).not.toBe(a);
    expect(settingsHash({ region: "IN", categories: ["AI tools"] })).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });
  it("weekIdFor handles ISO week boundaries and year rollover", () => {
    expect(weekIdFor(new Date("2026-10-12T00:00:00Z"))).toBe("2026-W42");
    expect(weekIdFor(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(weekIdFor(new Date("2024-12-30T00:00:00Z"))).toBe("2025-W01");
    expect(weekIdFor(new Date("2021-01-03T00:00:00Z"))).toBe("2020-W53");
  });
  it("istDate converts across the UTC midnight boundary", () => {
    expect(istDate(new Date("2026-10-10T20:00:00Z"))).toBe("2026-10-11");
    expect(istDate(new Date("2026-10-10T18:29:00Z"))).toBe("2026-10-10");
  });
});

describe("clustering edge cases", () => {
  it("empty input and fewer items than the minimum k", () => {
    expect(clusterVideos([]).clusters).toEqual([]);
    const two = [{ id: "a", channelId: "1", vec: [0, 0] }, { id: "b", channelId: "2", vec: [1, 1] }];
    expect(clusterVideos(two).clusters).toEqual([]);
  });
  it("one creator posting many videos is never a trend", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, channelId: "same", vec: [i % 3, 0] }));
    expect(clusterVideos(items).clusters).toEqual([]);
  });
  it("identical vectors do not crash or produce NaN", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ id: `v${i}`, channelId: `c${i}`, vec: [1, 1] }));
    const r = clusterVideos(items);
    expect(Number.isNaN(r.sil)).toBe(false);
    expect(r.clusters.reduce((s, c) => s + c.itemIds.length, 0)).toBeLessThanOrEqual(9);
  });
  it("kmeans with k larger than the number of points", () => {
    expect(kmeans([[0], [1]], 5)).toHaveLength(2);
  });
  it("silhouette of a single cluster is the sentinel -1", () => {
    expect(silhouette([[0], [1], [2]], [0, 0, 0])).toBe(-1);
  });
  it("filterMultiCreator respects a custom threshold", () => {
    const items = [{ id: "a", channelId: "1", vec: [0] }, { id: "b", channelId: "2", vec: [0] }];
    expect(filterMultiCreator(items, [0, 0], 2)).toHaveLength(1);
    expect(filterMultiCreator(items, [0, 0], 3)).toHaveLength(0);
  });
});

describe("cover helpers edge cases", () => {
  it("deriveCoverText copes with empty, symbol-only, non-Latin and very long titles", () => {
    expect(deriveCoverText("")).toBe("");
    expect(deriveCoverText("!!! ??? ---")).toBe("");
    expect(deriveCoverText("word ".repeat(50)).split(" ")).toHaveLength(4);
    expect(deriveCoverText("iPhone 18 बनाम Pixel 11 कौन बेहतर").length).toBeGreaterThan(0);
  });
  it("wrapWords with empty text and a word wider than the line", () => {
    expect(wrapWords("", 10, (s) => s.length)).toEqual([]);
    expect(wrapWords("SUPERCALIFRAGILISTIC OK", 5, (s) => s.length)).toEqual(["SUPERCALIFRAGILISTIC", "OK"]);
  });
});

describe("email safety", () => {
  const evil = '<script>alert(1)</script> "quoted" & <img src=x onerror=alert(2)>';
  const theme = (n: number) => ({
    name: `Theme ${n} ${evil}`, summary: `Summary ${evil}`, whyNow: `Why ${evil}`,
    stats: { creatorCount: 4, videoCount: 5, totalViews: 1e6, avgVelocity: 900, avgEngagement: 0.05 },
    winningFormat: `fmt ${evil}`, typicalLengthMinutes: 8,
    exampleVideos: [{ id: "a", title: evil, channel: evil, url: "https://www.youtube.com/watch?v=a", views: 10 }],
    filmingAngle: { title: evil, angle: `Angle text ${evil}` },
    urgency: { level: "film_now" as const, reason: evil }, saturation: "low" as const,
  });
  const brief: Brief = {
    weekOf: evil, headline: [evil, "line two", "line three"], themes: [theme(1), theme(2), theme(3)],
    meta: { videoCount: 9, quotaUsed: 0, generatedAt: "2026-10-12T00:00:00Z", dataSource: "live" },
  };
  it("escapes HTML from every untrusted field (titles, channels, AI text)", () => {
    const { html, subject } = renderEmail(brief);
    expect(html).not.toMatch(/<script>alert/);
    expect(html).not.toMatch(/<img src=x/);
    expect(html).toContain("&lt;script&gt;");
    expect(subject).toBeTruthy();
  });
  it("renders the stale notice only when asked", () => {
    expect(renderEmail(brief, { stale: true }).html).toContain("last saved brief");
    expect(renderEmail(brief).html).not.toContain("last saved brief");
  });
});
