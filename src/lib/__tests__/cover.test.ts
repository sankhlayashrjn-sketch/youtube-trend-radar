import { describe, expect, it } from "vitest";
import {
  COVER_STYLES, contrastRatio, coverChecks, deriveCoverText, headlineWords, kickerFor, luminance, pickAccentWord, withAlpha, worstBackground,
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
