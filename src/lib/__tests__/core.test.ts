import { describe, expect, it } from "vitest";
import { durationBucket, engagementRate, median, parseIsoDuration, uniqueChannelCount, velocity } from "../metrics";
import { clusterVideos, filterMultiCreator, kmeans } from "../cluster";
import { aiBriefSchema, briefSchema } from "../types";
import { assembleBrief, verifyExamples, type ClusterFacts } from "../brief";

describe("metrics", () => {
  it("computes velocity per hour with a 1h floor", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    expect(velocity(1000, new Date("2026-01-01T00:00:00Z"), now)).toBeCloseTo(1000 / 24);
    expect(velocity(500, new Date("2026-01-01T23:59:00Z"), now)).toBe(500);
  });
  it("computes engagement and handles zero views", () => {
    expect(engagementRate(90, 10, 1000)).toBeCloseTo(0.1);
    expect(engagementRate(5, 5, 0)).toBe(0);
  });
  it("buckets durations", () => {
    expect(durationBucket(120)).toBe("short");
    expect(durationBucket(600)).toBe("medium");
    expect(durationBucket(1800)).toBe("long");
  });
  it("parses ISO durations, medians and unique channels", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(median([1, 3, 2, 10])).toBe(2.5);
    expect(uniqueChannelCount([{ channelId: "a" }, { channelId: "a" }, { channelId: "b" }])).toBe(2);
  });
});

describe("clustering multi-creator rule", () => {
  it("drops clusters with fewer than 3 distinct creators", () => {
    const items = [
      ...[0, 1, 2, 3].map((i) => ({ id: `a${i}`, channelId: `c${i}`, vec: [0, 0] })), // 4 creators
      ...[0, 1, 2, 3].map((i) => ({ id: `b${i}`, channelId: "same", vec: [5, 5] })), // 1 creator, 4 videos
      ...[0, 1].map((i) => ({ id: `d${i}`, channelId: `x${i}`, vec: [9, 9] })), // 2 creators
    ];
    const assign = items.map((it) => (it.id[0] === "a" ? 0 : it.id[0] === "b" ? 1 : 2));
    const out = filterMultiCreator(items, assign, 3);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(0);
    expect(out[0].creatorCount).toBe(4);
  });
  it("kmeans separates obvious groups and is deterministic", () => {
    const vecs = [[0, 0], [0.1, 0], [0, 0.1], [10, 10], [10.1, 10], [10, 10.1]];
    const a = kmeans(vecs, 2);
    expect(a[0]).toBe(a[1]);
    expect(a[3]).toBe(a[4]);
    expect(a[0]).not.toBe(a[3]);
    expect(kmeans(vecs, 2)).toEqual(a);
  });
  it("clusterVideos returns only multi-creator trends", () => {
    const items = [];
    for (let g = 0; g < 3; g++)
      for (let i = 0; i < 4; i++) items.push({ id: `g${g}v${i}`, channelId: `g${g}c${i}`, vec: [g * 10 + i * 0.01, g * 10] });
    const { clusters } = clusterVideos(items);
    expect(clusters.length).toBeGreaterThanOrEqual(3);
    clusters.forEach((c) => expect(c.creatorCount).toBeGreaterThanOrEqual(3));
  });
});

const facts: ClusterFacts[] = [1, 2, 3].map((n) => ({
  clusterId: n, videoCount: 5, creatorCount: 4, totalViews: 100000 * n, avgVelocity: 900, avgEngagement: 0.04,
  medianLengthMin: 11.5, topTags: ["ai"],
  topVideos: [{ id: `vid${n}`, title: `Video ${n}`, channel: "Ch", url: `https://www.youtube.com/watch?v=vid${n}`, views: 1000, lengthMin: 10 }],
}));
const aiTheme = (id: number) => ({
  clusterId: id, name: `Theme ${id}`, summary: "A summary of the theme.", whyNow: "4 creators, 100K views.",
  winningFormat: "tutorial", filmingTitle: "Film this", filmingAngle: "Take this specific angle now.",
  urgency: "film_now" as const, urgencyReason: "rising fast", saturation: "low" as const,
});
const meta = { weekOf: "2026-10-11", videoCount: 15, quotaUsed: 1000, dataSource: "live" as const };

describe("brief schema", () => {
  it("requires exactly 3 headline lines and 3-5 themes", () => {
    const ai = { headline: ["a one", "b two", "c three"], themes: [1, 2, 3].map(aiTheme) };
    expect(aiBriefSchema.safeParse(ai).success).toBe(true);
    expect(aiBriefSchema.safeParse({ ...ai, headline: ["a one", "b two"] }).success).toBe(false);
    const brief = assembleBrief(aiBriefSchema.parse(ai), facts, meta);
    expect(briefSchema.safeParse(brief).success).toBe(true);
    expect(() => assembleBrief(aiBriefSchema.parse({ ...ai, themes: [aiTheme(1)] }), facts, meta)).toThrow();
  });
  it("ignores unknown cluster ids and uses code numbers, not model numbers", () => {
    const ai = { headline: ["a one", "b two", "c three"], themes: [1, 2, 3, 99].map(aiTheme) };
    const brief = assembleBrief(aiBriefSchema.parse(ai), facts, meta);
    expect(brief.themes).toHaveLength(3);
    expect(brief.themes[0].stats.creatorCount).toBe(4);
  });
  it("rejects example videos not in the fetched set", () => {
    const ai = { headline: ["a one", "b two", "c three"], themes: [1, 2, 3].map(aiTheme) };
    const brief = assembleBrief(aiBriefSchema.parse(ai), facts, meta);
    expect(() => verifyExamples(brief, [{ id: "vid1" }, { id: "vid2" }, { id: "vid3" }])).not.toThrow();
    expect(() => verifyExamples(brief, [{ id: "vid1" }])).toThrow();
  });
});
