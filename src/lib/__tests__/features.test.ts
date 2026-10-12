import { describe, expect, it } from "vitest";
import { deriveCoverText, wrapWords } from "../cover";
import { fmtDuration, fmtPct } from "../format";
import { buildScriptPrompt, scriptTarget } from "../script";
import { renderEmail } from "../email";
import { assembleBrief, buildFacts, type ClusterFacts } from "../brief";
import { aiBriefSchema, type VideoRow } from "../types";

const vids: VideoRow[] = [0, 1, 2, 3].map((i) => ({
  id: `vid${i}`, title: `Video ${i}`, channel: `Ch${i}`, channelId: `c${i}`, views: 1000 * (i + 1), likes: 90, comments: 10,
  durationSec: 754, publishedAt: new Date("2026-10-08T00:00:00Z"), tags: ["a"], velocity: 42.4, engagement: 0.1,
}));

const base = buildFacts(vids, [{ id: 1, itemIds: vids.map((v) => v.id), creatorCount: 4 }])[0];
const facts: ClusterFacts[] = [1, 2, 3].map((id) => ({ ...base, clusterId: id }));
const aiTheme = (id: number) => ({
  clusterId: id, onNiche: true, name: `Theme ${id}`, summary: "A summary of it.", whyNow: "4 creators here.", winningFormat: "tutorial",
  filmingTitle: "Make this video", filmingAngle: "Take this specific angle now.", coverText: "FREE AI STACK", coverEmoji: "🔥",
  urgency: "film_now" as const, urgencyReason: "rising", saturation: "low" as const,
});
const brief = assembleBrief(
  aiBriefSchema.parse({ headline: ["aaa one", "bbb two", "ccc three"], themes: [1, 2, 3].map(aiTheme) }),
  facts,
  { weekOf: "2026-10-12", videoCount: 4, quotaUsed: 0, dataSource: "live" },
);

describe("video details flow into the brief", () => {
  it("keeps likes, comments, duration, velocity, engagement and channel id on example videos", () => {
    const v = brief.themes[0].exampleVideos[0];
    expect(v.likes).toBe(90);
    expect(v.comments).toBe(10);
    expect(v.durationSec).toBe(754);
    expect(v.velocity).toBe(42);
    expect(v.engagement).toBe(0.1);
    expect(v.channelId).toMatch(/^c\d/);
    expect(v.publishedAt).toBe("2026-10-08T00:00:00.000Z");
  });
  it("carries the cover text and emoji, and shows the details in the email", () => {
    expect(brief.themes[0].cover).toEqual({ text: "FREE AI STACK", emoji: "🔥" });
    const { html } = renderEmail(brief);
    expect(html).toContain("12:34");
    expect(html).toContain("likes");
    expect(html).toContain("Draft the script and cover");
  });
  it("still works for older briefs without the new fields", () => {
    const old = structuredClone(brief);
    for (const t of old.themes) {
      delete t.cover;
      t.exampleVideos = t.exampleVideos.map(({ id, title, channel, url, views }) => ({ id, title, channel, url, views }));
    }
    expect(() => renderEmail(old)).not.toThrow();
  });
});

describe("formatting", () => {
  it("formats durations and percentages", () => {
    expect(fmtDuration(754)).toBe("12:34");
    expect(fmtDuration(3725)).toBe("1:02:05");
    expect(fmtDuration(0)).toBe("");
    expect(fmtPct(0.042)).toBe("4.2%");
    expect(fmtPct(0.266)).toBe("27%");
  });
});

describe("cover helpers", () => {
  it("derives a short caps headline without filler words", () => {
    expect(deriveCoverText("I Stopped Paying for Productivity Apps: Best Free AI Tools for 2026")).toBe("STOPPED PAYING PRODUCTIVITY APPS");
    expect(deriveCoverText("The", 4)).toBe("THE");
  });
  it("wraps words to a maximum width", () => {
    expect(wrapWords("ONE TWO THREE FOUR", 9, (s) => s.length)).toEqual(["ONE TWO", "THREE", "FOUR"]);
  });
});

describe("script prompt", () => {
  const theme = brief.themes[0];
  it("targets the theme length at 150 words per minute and clamps it", () => {
    expect(scriptTarget({ ...theme, typicalLengthMinutes: 10 })).toEqual({ minutes: 10, words: 1500 });
    expect(scriptTarget({ ...theme, typicalLengthMinutes: 1 }).minutes).toBe(4);
    expect(scriptTarget({ ...theme, typicalLengthMinutes: 40 }).minutes).toBe(15);
  });
  it("is grounded: bans invented facts and uses only the brief's data", () => {
    const p = buildScriptPrompt(theme, { categories: ["AI tools"], language: "English" });
    expect(p).toContain("Do not invent");
    expect(p).toContain("[VERIFY:");
    expect(p).toContain("Make this video");
    expect(p).toContain("AI tools");
  });
  it("switches to Hinglish", () => {
    expect(buildScriptPrompt(theme, { categories: ["x"], language: "Hinglish" })).toContain("Hinglish");
  });
});
