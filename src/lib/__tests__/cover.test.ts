import { describe, expect, it } from "vitest";
import {
  COVER_STYLES, autoDarken, averageLuminance, contrastRatio, coverChecks, deriveCoverText, headlineWords, kickerFor, luminance, pickAccentWord, withAlpha, worstBackground,
} from "../cover";

describe("palettes (regression: the old cover looked childish)", () => {
  it("every style is dark, with readable white text and a readable accent", () => {
    for (const s of COVER_STYLES) {
      expect(luminance(s.from), `${s.id} start`).toBeLessThan(0.05);
      expect(luminance(s.to), `${s.id} end`).toBeLessThan(0.12);
      expect(contrastRatio(s.text, worstBackground(s)), `${s.id} text`).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(s.accent, worstBackground(s)), `${s.id} accent`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("offers a restrained set with unique ids and one accent each (no rainbow stickers)", () => {
    expect(new Set(COVER_STYLES.map((s) => s.id)).size).toBe(COVER_STYLES.length);
    expect(COVER_STYLES.length).toBeGreaterThanOrEqual(4);
    expect(COVER_STYLES.length).toBeLessThanOrEqual(6);
  });
});

describe("contrast maths", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#000")).toBeCloseTo(0, 5);
  });
  it("is symmetric", () => {
    expect(contrastRatio("#4da3ff", "#070b16")).toBeCloseTo(contrastRatio("#070b16", "#4da3ff"), 8);
  });
  it("withAlpha converts hex to rgba, including short hex", () => {
    expect(withAlpha("#4da3ff", 0.3)).toBe("rgba(77,163,255,0.3)");
    expect(withAlpha("#fff", 0.5)).toBe("rgba(255,255,255,0.5)");
  });
});

describe("pickAccentWord: highlight what is already working", () => {
  const titles = ["Best phone deals today", "Phone deals compared", "Top phone picks", "Unrelated cooking video"];
  it("prefers a number in the headline", () => {
    expect(pickAccentWord("TOP 5 PHONES", titles)).toBe(1);
  });
  it("otherwise picks the headline word most repeated across the example titles", () => {
    expect(pickAccentWord("BEST PHONE DEALS", titles)).toBe(1); // "phone" is in 3 titles
  });
  it("needs a word to appear in at least two titles before trusting it", () => {
    expect(pickAccentWord("QUANTUM FRIDGE GUIDE", ["quantum computing intro", "unrelated"])).toBe(2); // falls back to the last word
  });
  it("falls back to the last word when there is no data", () => {
    expect(pickAccentWord("FREE AI STACK", [])).toBe(2);
  });
  it("ignores case and punctuation, and handles an empty headline or title list", () => {
    expect(pickAccentWord("Phone!", ["PHONE deals", "phone, again"])).toBe(0);
    expect(pickAccentWord("", titles)).toBe(-1);
    expect(pickAccentWord("   ", titles)).toBe(-1);
  });
  it("indexes match the words the canvas draws", () => {
    const text = "  BEST   PHONE  DEALS ";
    expect(headlineWords(text)).toEqual(["BEST", "PHONE", "DEALS"]);
    expect(pickAccentWord(text, titles)).toBe(1);
  });
});

describe("kickerFor: the label above the headline", () => {
  it("turns the winning format into a short caps label", () => {
    expect(kickerFor("buyer's guide listicle")).toBe("BUYER'S GUIDE LISTICLE");
    expect(kickerFor("hands-on tutorial and workflow audit")).toBe("HANDS-ON TUTORIAL AND");
  });
  it("copes with empty, punctuation-only and very long input", () => {
    expect(kickerFor("")).toBe("");
    expect(kickerFor("!!! ???")).toBe("");
    expect(kickerFor("a b c d e f g", 2)).toBe("A B");
  });
});

describe("coverChecks", () => {
  const style = COVER_STYLES[0];
  it("passes a 2-4 word headline on a dark style", () => {
    expect(coverChecks("FREE AI STACK", style).every((c) => c.ok)).toBe(true);
  });
  it("flags a single word and a six-word headline", () => {
    expect(coverChecks("FREE", style)[0].ok).toBe(false);
    expect(coverChecks("ONE TWO THREE FOUR FIVE SIX", style)[0].ok).toBe(false);
    expect(coverChecks("", style)[0].label).toBe("0 words");
  });
  it("flags a long headline", () => {
    const long = coverChecks("EXTRAORDINARILY LONG HEADLINES GET SMALL", style);
    expect(long[1].ok).toBe(false);
  });
  it("uses singular wording for one word, and always reports a contrast ratio", () => {
    expect(coverChecks("ONE", style)[0].label).toBe("1 word");
    expect(coverChecks("A B", style)[2].label).toMatch(/^Contrast \d+:1$/);
  });
  it("derives a clean fallback headline from a title", () => {
    expect(deriveCoverText("I Stopped Paying for Productivity Apps")).toBe("STOPPED PAYING PRODUCTIVITY APPS");
  });
});

describe("smart darkening for images behind text", () => {
  const px = (r: number, g: number, b: number, a = 255, n = 4) => Array.from({ length: n }).flatMap(() => [r, g, b, a]);
  it("measures brightness from pixel data", () => {
    expect(averageLuminance(px(255, 255, 255))).toBeCloseTo(1, 5);
    expect(averageLuminance(px(0, 0, 0))).toBeCloseTo(0, 5);
    expect(averageLuminance([...px(255, 255, 255, 255, 1), ...px(0, 0, 0, 255, 1)])).toBeCloseTo(0.5, 5);
  });
  it("ignores transparent pixels and returns NaN when there is nothing to measure", () => {
    expect(averageLuminance([...px(255, 255, 255, 255, 1), ...px(0, 0, 0, 0, 3)])).toBeCloseTo(1, 5);
    expect(Number.isNaN(averageLuminance([]))).toBe(true);
    expect(Number.isNaN(averageLuminance(px(10, 10, 10, 0)))).toBe(true);
    expect(Number.isNaN(averageLuminance([1, 2, 3]))).toBe(true); // an incomplete pixel is ignored
  });
  it("darkens bright images more than dark ones, in readable steps", () => {
    expect(autoDarken(0.05)).toBe(30);
    expect(autoDarken(0.3)).toBe(45);
    expect(autoDarken(0.5)).toBe(60);
    expect(autoDarken(0.9)).toBe(70);
    const steps = [0, 0.2, 0.3, 0.5, 0.7, 1].map(autoDarken);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps); // never darker for a darker image
  });
  it("falls back to the 45% default when brightness cannot be measured", () => {
    expect(autoDarken(NaN)).toBe(45);
    expect(autoDarken(Infinity)).toBe(45);
  });
  it("every result is a valid slider step (0 to 80 in steps of 5)", () => {
    for (const b of [0, 0.1, 0.25, 0.4, 0.45, 0.6, 0.65, 0.8, 1]) {
      const v = autoDarken(b);
      expect(v % 5).toBe(0);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(80);
    }
  });
});

import { BADGE_IDEAS, DEFAULT_STUDIO, FONTS, PATTERNS, TEMPLATES, clamp, headlineIdeas, hitTest, splitVersus, type Region } from "@/lib/cover";

describe("cover studio: defaults reproduce the plain cover", () => {
  it("starts as the Classic template with nothing extra switched on", () => {
    expect(DEFAULT_STUDIO).toMatchObject({ template: "classic", font: "inter", pattern: "gradient", outline: 0, highlight: "colour", textScale: 1, textDx: 0, textDy: 0, badgeOn: false, callout: "none", photoZoom: 1 });
  });
  it("offers distinct, labelled templates, fonts and backgrounds", () => {
    for (const list of [TEMPLATES, FONTS, PATTERNS]) {
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
      for (const x of list) expect(x.label.length).toBeGreaterThan(2);
    }
    expect(TEMPLATES.map((t) => t.id)).toEqual(["classic", "center", "number", "versus"]);
    expect(BADGE_IDEAS.length).toBeGreaterThanOrEqual(4);
  });
});

describe("splitVersus", () => {
  it("splits on vs, vs., versus and v/s in any case", () => {
    expect(splitVersus("iPhone vs Pixel")).toEqual(["iPhone", "Pixel"]);
    expect(splitVersus("FOLD VS. FLAGSHIP")).toEqual(["FOLD", "FLAGSHIP"]);
    expect(splitVersus("Mac versus PC")).toEqual(["Mac", "PC"]);
    expect(splitVersus("A v/s B")).toEqual(["A", "B"]);
  });
  it("returns null without a clear two-sided headline", () => {
    expect(splitVersus("Best phone deals")).toBeNull();
    expect(splitVersus("vs Pixel")).toBeNull();
    expect(splitVersus("iPhone vs")).toBeNull();
    expect(splitVersus("A vs B vs C")).toBeNull();
    expect(splitVersus("")).toBeNull();
    expect(splitVersus("canvas")).toBeNull(); // "vs" inside a word is not a split
  });
});

describe("hitTest", () => {
  const regions: Region[] = [
    { id: "photo", x: 0, y: 0, w: 1280, h: 720 },
    { id: "headline", x: 100, y: 100, w: 400, h: 200 },
    { id: "badge", x: 150, y: 120, w: 100, h: 50 },
  ];
  it("returns the topmost element under the point", () => {
    expect(hitTest(regions, 160, 130)).toBe("badge");
    expect(hitTest(regions, 300, 250)).toBe("headline");
    expect(hitTest(regions, 900, 600)).toBe("photo");
  });
  it("returns null outside everything and for an empty list", () => {
    expect(hitTest(regions, -5, 10)).toBeNull();
    expect(hitTest([], 10, 10)).toBeNull();
  });
  it("includes the edges", () => {
    expect(hitTest(regions, 100, 100)).toBe("headline");
    expect(hitTest(regions, 500, 300)).toBe("headline");
  });
});

describe("clamp", () => {
  it("keeps a value in range and survives NaN", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
    expect(clamp(NaN, 2, 9)).toBe(2);
  });
});

describe("headlineIdeas", () => {
  const titles = ["Pixel 10 Pro review", "Pixel 10 Pro camera test", "iPhone 17 review", "Best phone deals"];
  it("suggests alternatives, never the current headline, at most four, all within the length limit", () => {
    const ideas = headlineIdeas("PIXEL 10 PRO", "Is the Pixel 10 Pro worth it in India?", titles);
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.length).toBeLessThanOrEqual(4);
    expect(ideas).not.toContain("PIXEL 10 PRO");
    for (const i of ideas) { expect(i).toBe(i.toUpperCase()); expect(i.length).toBeLessThanOrEqual(40); }
    expect(new Set(ideas).size).toBe(ideas.length);
  });
  it("builds a versus headline when the idea compares two things", () => {
    expect(headlineIdeas("", "Xiaomi 18 Fold vs iPhone: best flagship?", [])).toContain("XIAOMI 18 VS IPHONE")
    expect(headlineIdeas("", "Pixel vs iPhone: which camera wins in India?", [])).toContain("PIXEL VS IPHONE"); // the subtitle is ignored;
  });
  it("uses the two-word phrase that appears in most example titles", () => {
    const ideas = headlineIdeas("X", "Q", ["Galaxy fold review", "Galaxy fold camera", "Galaxy fold battery"]);
    expect(ideas).toContain("GALAXY FOLD");
  });
  it("copes with empty input", () => {
    expect(headlineIdeas("", "", [])).toEqual([]);
  });
});
