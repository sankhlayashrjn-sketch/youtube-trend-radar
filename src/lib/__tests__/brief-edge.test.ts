import { afterEach, describe, expect, it, vi } from "vitest";
import { assembleBrief, buildFacts, buildPrompt, verifyExamples, type ClusterFacts } from "../brief";
import { aiBriefSchema, briefSchema, settingsSchema, themeSchema, type VideoRow } from "../types";

const vid = (i: number, over: Partial<VideoRow> = {}): VideoRow => ({
  id: `v${i}`, title: `Video ${i}`, channel: `Ch${i}`, channelId: `c${i}`, views: 1000 * (i + 1), likes: 10, comments: 1,
  durationSec: 600, publishedAt: new Date("2026-10-10T00:00:00Z"), tags: ["tag"], velocity: 10, engagement: 0.01, ...over,
});
const vids = Array.from({ length: 10 }, (_, i) => vid(i));

const aiTheme = (id: number, over: Record<string, unknown> = {}) => ({
  clusterId: id, onNiche: true, name: `Theme ${id}`, summary: "A summary of it.", whyNow: "4 creators here.", winningFormat: "tutorial",
  filmingTitle: "Make this video", filmingAngle: "Take this specific angle now.", coverText: "", coverEmoji: "",
  urgency: "soon" as const, urgencyReason: "rising fast", saturation: "low" as const, ...over,
});
const head = ["line one aa", "line two bb", "line three cc"];
const meta = { weekOf: "2026-10-12", videoCount: 10, quotaUsed: 0, dataSource: "live" as const };
const facts = (n: number): ClusterFacts[] =>
  Array.from({ length: n }, (_, i) => ({ ...buildFacts(vids, [{ id: i + 1, itemIds: vids.map((v) => v.id), creatorCount: 10 }])[0], clusterId: i + 1 }));

afterEach(() => vi.unstubAllEnvs());

describe("buildFacts", () => {
  it("ignores cluster members that are not in the video list and handles an empty cluster", () => {
    const f = buildFacts(vids, [{ id: 1, itemIds: ["v0", "ghost"], creatorCount: 1 }, { id: 2, itemIds: [], creatorCount: 0 }]);
    const withVideos = f.find((x) => x.clusterId === 1)!;
    expect(withVideos.videoCount).toBe(1);
    const empty = f.find((x) => x.clusterId === 2)!;
    expect(empty.videoCount).toBe(0);
    expect(Number.isNaN(empty.avgVelocity)).toBe(false);
    expect(empty.topVideos).toEqual([]);
  });
  it("orders themes by total views x creators and keeps at most 5", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: i, itemIds: [`v${i}`], creatorCount: 1 }));
    const f = buildFacts(vids, many);
    expect(f).toHaveLength(5);
    const scores = f.map((x) => x.totalViews * x.creatorCount);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
  it("shows one video per creator first so examples show breadth", () => {
    const same = [vid(0, { id: "a1", channelId: "same", views: 9000 }), vid(1, { id: "a2", channelId: "same", views: 8000 }), vid(2, { id: "b1", channelId: "other", views: 10 })];
    const f = buildFacts(same, [{ id: 1, itemIds: ["a1", "a2", "b1"], creatorCount: 2 }]);
    expect(f[0].topVideos.slice(0, 2).map((v) => v.id)).toEqual(["a1", "b1"]);
  });
  it("caps example videos at 8 and never leaks the full tag list into the prompt", () => {
    const f = buildFacts(vids, [{ id: 1, itemIds: vids.map((v) => v.id), creatorCount: 10 }]);
    expect(f[0].topVideos.length).toBeLessThanOrEqual(8);
    const prompt = buildPrompt(f, "IN", ["AI tools"]);
    expect(prompt).not.toContain("publishedAt");
    expect(prompt).not.toContain("channelId");
  });
});

describe("assembleBrief edge cases", () => {
  it("throws when fewer than 3 themes survive (caller then keeps the last brief)", () => {
    const ai = aiBriefSchema.parse({ headline: head, themes: [aiTheme(1), aiTheme(2)] });
    expect(() => assembleBrief(ai, facts(3), meta)).toThrow();
  });
  it("ignores unknown cluster ids and duplicate ids from the model", () => {
    const ai = aiBriefSchema.parse({ headline: head, themes: [aiTheme(1), aiTheme(1), aiTheme(2), aiTheme(3), aiTheme(99)] });
    const b = assembleBrief(ai, facts(3), meta);
    expect(b.themes.map((t) => t.name)).toEqual(["Theme 1", "Theme 2", "Theme 3"]);
  });
  it("caps the brief at 5 themes", () => {
    const ai = aiBriefSchema.parse({ headline: head, themes: [1, 2, 3, 4, 5].map((i) => aiTheme(i)) });
    expect(assembleBrief(ai, facts(5), meta).themes).toHaveLength(5);
    expect(() => aiBriefSchema.parse({ headline: head, themes: [1, 2, 3, 4, 5, 6].map((i) => aiTheme(i)) })).toThrow();
  });
  it("never trusts model-supplied numbers or URLs: stats and links come from the fetched data", () => {
    const ai = aiBriefSchema.parse({
      headline: head,
      themes: [1, 2, 3].map((i) => ({ ...aiTheme(i), stats: { creatorCount: 999 }, exampleVideos: [{ url: "https://evil.example" }] })),
    });
    const b = assembleBrief(ai, facts(3), meta);
    expect(b.themes[0].stats.creatorCount).toBe(10);
    expect(JSON.stringify(b)).not.toContain("evil.example");
    b.themes.forEach((t) => t.exampleVideos.forEach((v) => expect(v.url).toBe(`https://www.youtube.com/watch?v=${v.id}`)));
  });
  it("omits cover when the model gave no cover text", () => {
    const ai = aiBriefSchema.parse({ headline: head, themes: [1, 2, 3].map((i) => aiTheme(i)) });
    expect(assembleBrief(ai, facts(3), meta).themes[0].cover).toBeUndefined();
  });
  it("keeps all themes, forced to skip, when too few are on-niche (regression: off-niche filter)", () => {
    const ai = aiBriefSchema.parse({ headline: head, themes: [1, 2, 3, 4].map((i) => aiTheme(i, { onNiche: i === 1, urgency: "film_now" })) });
    const b = assembleBrief(ai, facts(4), meta);
    expect(b.themes).toHaveLength(4);
    expect(b.themes.filter((t) => t.urgency.level === "film_now")).toHaveLength(1);
  });
  it("drops off-niche themes when 3 or more on-niche themes remain", () => {
    const ai = aiBriefSchema.parse({ headline: head, themes: [1, 2, 3, 4, 5].map((i) => aiTheme(i, { onNiche: i <= 3 })) });
    expect(assembleBrief(ai, facts(5), meta).themes).toHaveLength(3);
  });
  it("a model that omits onNiche is treated as on-niche (backwards compatible)", () => {
    const t = { ...aiTheme(1) } as Record<string, unknown>;
    delete t.onNiche;
    const ai = aiBriefSchema.parse({ headline: head, themes: [t, aiTheme(2), aiTheme(3)] });
    expect(ai.themes[0].onNiche).toBe(true);
  });
});

describe("schemas reject malformed AI output", () => {
  it("headline must be exactly 3 non-trivial lines", () => {
    for (const h of [[], ["a long one", "b long two"], [...head, "four four"], ["", "x y z", "q r s"], head.slice(0, 1)]) {
      expect(aiBriefSchema.safeParse({ headline: h, themes: [aiTheme(1)] }).success).toBe(false);
    }
  });
  it("rejects bad urgency, bad saturation and non-numeric cluster ids", () => {
    expect(aiBriefSchema.safeParse({ headline: head, themes: [aiTheme(1, { urgency: "now" })] }).success).toBe(false);
    expect(aiBriefSchema.safeParse({ headline: head, themes: [aiTheme(1, { saturation: "huge" })] }).success).toBe(false);
    expect(aiBriefSchema.safeParse({ headline: head, themes: [aiTheme(1, { clusterId: "1" })] }).success).toBe(false);
  });
  it("rejects absurdly long names and cover text", () => {
    expect(aiBriefSchema.safeParse({ headline: head, themes: [aiTheme(1, { name: "x".repeat(81) })] }).success).toBe(false);
    expect(aiBriefSchema.safeParse({ headline: head, themes: [aiTheme(1, { coverText: "x".repeat(41) })] }).success).toBe(false);
  });
  it("the final brief schema needs 3 to 5 themes and valid example URLs", () => {
    const ai = aiBriefSchema.parse({ headline: head, themes: [1, 2, 3].map((i) => aiTheme(i)) });
    const b = assembleBrief(ai, facts(3), meta);
    expect(briefSchema.safeParse({ ...b, themes: b.themes.slice(0, 2) }).success).toBe(false);
    const bad = structuredClone(b);
    bad.themes[0].exampleVideos[0].url = "not a url";
    expect(themeSchema.safeParse(bad.themes[0]).success).toBe(false);
  });
  it("legacy briefs (no new optional fields) still validate", () => {
    const ai = aiBriefSchema.parse({ headline: head, themes: [1, 2, 3].map((i) => aiTheme(i)) });
    const b = assembleBrief(ai, facts(3), meta);
    for (const t of b.themes) {
      delete t.cover;
      t.exampleVideos = t.exampleVideos.map(({ id, title, channel, url, views }) => ({ id, title, channel, url, views }));
    }
    delete b.meta.categories;
    delete b.meta.settingsHash;
    expect(briefSchema.safeParse(b).success).toBe(true);
  });
});

describe("verifyExamples", () => {
  it("rejects an id that is not in the fetched set, and a url that does not match its id", () => {
    const ai = aiBriefSchema.parse({ headline: head, themes: [1, 2, 3].map((i) => aiTheme(i)) });
    const b = assembleBrief(ai, facts(3), meta);
    expect(() => verifyExamples(b, vids)).not.toThrow();
    expect(() => verifyExamples(b, vids.slice(5))).toThrow(/Unverified/);
    const tampered = structuredClone(b);
    tampered.themes[0].exampleVideos[0].url = "https://www.youtube.com/watch?v=other";
    expect(() => verifyExamples(tampered, vids)).toThrow(/Unverified/);
  });
});

describe("settings schema", () => {
  const ok = { categories: ["AI tools"], region: "in", email: "a@b.co" };
  it("normalises region to upper case and defaults minViews", () => {
    const r = settingsSchema.parse(ok);
    expect(r.region).toBe("IN");
    expect(r.minViews).toBe(0);
  });
  it("trims category text", () => {
    expect(settingsSchema.parse({ ...ok, categories: ["  AI tools  "] }).categories).toEqual(["AI tools"]);
  });
  it("rejects every unsupported region (regression)", () => {
    for (const r of ["ZZ", "XX", "", "IND", "1N"]) expect(settingsSchema.safeParse({ ...ok, region: r }).success, r).toBe(false);
  });
});

describe("environment validation", () => {
  const good = {
    YOUTUBE_API_KEY: "yt-key-for-tests", GEMINI_API_KEY: "gemini-key-for-tests", RESEND_API_KEY: "resend-key-for-tests",
    DATABASE_URL: "postgresql://u:p@localhost:6543/db", CRON_SECRET: "cron-secret-for-tests-1234567890",
  };
  const load = async (env: Record<string, string | undefined>) => {
    vi.resetModules();
    for (const k of Object.keys(good)) vi.stubEnv(k, env[k] ?? "");
    for (const k of ["EMAIL_FROM", "GEMINI_MODEL", "GEMINI_EMBEDDING_MODEL"]) vi.stubEnv(k, "");
    return (await import("../env")).getEnv;
  };
  it("accepts a complete environment and applies defaults", async () => {
    const getEnv = await load(good);
    const e = getEnv();
    expect(e.GEMINI_MODEL).toBeTruthy();
    expect(e.EMAIL_FROM).toContain("onboarding@resend.dev");
  });
  it("names the missing variables but never prints any secret value", async () => {
    const getEnv = await load({ ...good, GEMINI_API_KEY: undefined, CRON_SECRET: "short" });
    let message = "";
    try { getEnv(); } catch (e) { message = (e as Error).message; }
    expect(message).toContain("GEMINI_API_KEY");
    expect(message).toContain("CRON_SECRET");
    for (const v of Object.values(good)) expect(message).not.toContain(v);
  });
  it("rejects a malformed database URL", async () => {
    const getEnv = await load({ ...good, DATABASE_URL: "not a url" });
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });
});
