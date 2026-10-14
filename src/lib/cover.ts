/**
 * Pure helpers for the thumbnail (cover) maker. Drawing itself happens in the browser canvas.
 *
 * Design rules, taken from what performs on tech channels:
 *  - one focal point and very little text (2 to 4 words)
 *  - a dark, high-contrast background with ONE accent colour
 *  - one highlighted keyword instead of an outline on everything
 *  - clean heavy sans-serif, soft shadow, no emoji, no stickers
 *  - the bottom-right corner stays clear (YouTube puts the timestamp there)
 */

export type CoverStyle = { id: string; label: string; from: string; to: string; accent: string; text: string };

export const COVER_STYLES: CoverStyle[] = [
  { id: "midnight", label: "Midnight", from: "#070b16", to: "#0d2150", accent: "#4da3ff", text: "#ffffff" },
  { id: "graphite", label: "Graphite", from: "#0c0c0e", to: "#2a2a30", accent: "#ff8a1f", text: "#ffffff" },
  { id: "ember", label: "Ember", from: "#0b0b0c", to: "#3b0b0b", accent: "#ff4d3d", text: "#ffffff" },
  { id: "emerald", label: "Emerald", from: "#041210", to: "#0a3b30", accent: "#2ee6a6", text: "#ffffff" },
  { id: "violet", label: "Violet", from: "#0b0618", to: "#2a1558", accent: "#b794ff", text: "#ffffff" },
];

const STOP = new Set(["the", "a", "an", "of", "to", "for", "and", "in", "on", "with", "my", "your", "is", "are", "how", "why", "i", "you", "this", "that", "it", "—", "-", "|", "new", "best", "vs"]);

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
/** The headline split exactly as the canvas draws it, so word indexes match. */
export const headlineWords = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** Fallback headline for briefs created before cover text existed: up to 4 meaningful words, in caps. */
export function deriveCoverText(title: string, maxWords = 4): string {
  const clean = title.replace(/[^\p{L}\p{N}\s'₹$%+&-]/gu, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const picked = clean.filter((w) => !STOP.has(w.toLowerCase()));
  const chosen = (picked.length >= 2 ? picked : clean).slice(0, maxWords);
  return chosen.join(" ").toUpperCase();
}

/**
 * Which word of the headline to highlight, using what is already working this week:
 * a number first (numbers attract clicks), otherwise the headline word that appears most often in the example
 * video titles, otherwise the last word. Returns an index into the headline's words, or -1 for an empty headline.
 */
export function pickAccentWord(headline: string, exampleTitles: string[]): number {
  const hw = headlineWords(headline);
  if (!hw.length) return -1;
  const num = hw.findIndex((w) => /\d/.test(w));
  if (num >= 0) return num;
  const freq = new Map<string, number>();
  for (const t of exampleTitles) {
    for (const w of new Set(words(t).map(norm))) if (w.length >= 3 && !STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  let best = -1, bestCount = 1; // a word must appear in at least two titles to count as "working"
  hw.forEach((w, i) => {
    const c = freq.get(norm(w)) ?? 0;
    if (c > bestCount) { best = i; bestCount = c; }
  });
  return best >= 0 ? best : hw.length - 1;
}

/** "#4da3ff" with 0.3 becomes "rgba(77,163,255,0.3)". */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** A short label above the headline, taken from the theme's winning format (for example "BUYER'S GUIDE"). */
export function kickerFor(format: string, maxWords = 3): string {
  const w = words(format.replace(/[^\p{L}\p{N}\s'&-]/gu, " "));
  return w.slice(0, maxWords).join(" ").toUpperCase();
}

/** Greedy word wrap using a measuring callback, so it works with any canvas font. */
export function wrapWords(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const ws = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of ws) {
    const next = line ? `${line} ${w}` : w;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ---- readability checks (WCAG relative luminance) --------------------------------------------------

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** The lightest of the background's two stops is where text is hardest to read, so test against that. */
export function worstBackground(style: CoverStyle): string {
  return luminance(style.from) > luminance(style.to) ? style.from : style.to;
}

export type CoverCheck = { ok: boolean; label: string; hint: string };

/** Quick, honest checks shown under the preview. */
export function coverChecks(text: string, style: CoverStyle): CoverCheck[] {
  const n = words(text).length;
  const textRatio = contrastRatio(style.text, worstBackground(style));
  const accentRatio = contrastRatio(style.accent, worstBackground(style));
  return [
    {
      ok: n >= 2 && n <= 4,
      label: `${n} word${n === 1 ? "" : "s"}`,
      hint: n >= 2 && n <= 4 ? "Short text is read at a glance" : "Aim for 2 to 4 words so it reads on a phone",
    },
    {
      ok: text.length <= 28,
      label: `${text.length} characters`,
      hint: text.length <= 28 ? "Fits large without shrinking" : "Long headlines get small; trim it",
    },
    {
      ok: textRatio >= 7 && accentRatio >= 4.5,
      label: `Contrast ${textRatio.toFixed(0)}:1`,
      hint: textRatio >= 7 && accentRatio >= 4.5 ? "Text and highlight stand out from the background" : "Pick a darker style",
    },
  ];
}

// ---- smart default for darkening an image behind the text -------------------------------------------

/** Mean brightness (0 to 1) of RGBA pixel data, using the standard perceived-brightness weights. */
export function averageLuminance(rgba: ArrayLike<number>): number {
  let sum = 0, n = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue; // fully transparent pixels say nothing about brightness
    sum += (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
    n++;
  }
  return n ? sum / n : NaN;
}

/** Default darkening (percent) so white text stays readable: the brighter the image behind it, the more. */
export function autoDarken(brightness: number): number {
  if (!Number.isFinite(brightness)) return 45;
  if (brightness < 0.25) return 30;
  if (brightness < 0.45) return 45;
  if (brightness < 0.65) return 60;
  return 70;
}

// ---- cover studio: templates, fonts, backgrounds, movable elements ---------------------------------

export type TemplateId = "classic" | "center" | "number" | "versus";
export const TEMPLATES: { id: TemplateId; label: string; hint: string }[] = [
  { id: "classic", label: "Classic", hint: "Headline on the left, this week's numbers on the right" },
  { id: "center", label: "Centred", hint: "One huge centred headline. Best for a single bold claim" },
  { id: "number", label: "Big number", hint: "A giant number is the hero. Best when the numbers are the story" },
  { id: "versus", label: "Versus", hint: "Two sides split by VS. Write the headline as \"A vs B\"" },
];

export type FontId = "inter" | "display" | "impact";
export const FONTS: { id: FontId; label: string; weight: number; css: string | null; tracking: number }[] = [
  { id: "inter", label: "Modern", weight: 900, css: null, tracking: -0.025 },
  { id: "display", label: "Editorial", weight: 800, css: "var(--font-fraunces)", tracking: -0.02 },
  { id: "impact", label: "Impact", weight: 400, css: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif', tracking: 0.005 },
];

export type PatternId = "gradient" | "spotlight" | "split" | "grid";
export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: "gradient", label: "Soft" },
  { id: "spotlight", label: "Spotlight" },
  { id: "split", label: "Diagonal" },
  { id: "grid", label: "Grid" },
];

export type CalloutKind = "none" | "arrow" | "circle";
export type HighlightMode = "colour" | "box";
export type Pt = { x: number; y: number };

/** Everything the studio adds on top of the basic cover. The defaults reproduce the plain Classic cover. */
export type Studio = {
  template: TemplateId;
  font: FontId;
  pattern: PatternId;
  outline: number; // 0 to 12 px of dark outline around the headline
  highlight: HighlightMode;
  textScale: number; // 0.6 to 1.3, multiplies the automatic headline size
  textDx: number; // headline offset in canvas pixels (drag it)
  textDy: number;
  badgeOn: boolean;
  badgeText: string;
  badgePos: Pt; // centre, as a fraction of the canvas
  callout: CalloutKind;
  calloutPos: Pt;
  calloutSize: number; // 0.6 to 2
  calloutRot: number; // degrees, arrow only
  photoZoom: number; // 1 to 3
  photoDx: number;
  photoDy: number;
  blurBackdrop: boolean;
};

export const DEFAULT_STUDIO: Studio = {
  template: "classic", font: "inter", pattern: "gradient", outline: 0, highlight: "colour", textScale: 1, textDx: 0, textDy: 0,
  badgeOn: false, badgeText: "NEW", badgePos: { x: 0.86, y: 0.12 },
  callout: "none", calloutPos: { x: 0.62, y: 0.55 }, calloutSize: 1, calloutRot: 150,
  photoZoom: 1, photoDx: 0, photoDy: 0, blurBackdrop: false,
};

export const BADGE_IDEAS = ["NEW", "LEAKED", "TESTED", "FREE", "2026", "TRUTH"];

/** "A vs B" becomes ["A", "B"]. Returns null when there is no "vs" or one side is empty. */
export function splitVersus(text: string): [string, string] | null {
  const m = text.trim().split(/\s+(?:vs\.?|versus|v\/s)\s+/i);
  if (m.length !== 2) return null;
  const [a, b] = [m[0].trim(), m[1].trim()];
  return a && b ? [a, b] : null;
}

export type RegionId = "headline" | "badge" | "callout" | "photo";
export type Region = { id: RegionId; x: number; y: number; w: number; h: number };

/** The topmost element under a point (later regions are drawn on top), or null. */
export function hitTest(regions: Region[], px: number, py: number): RegionId | null {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r.id;
  }
  return null;
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

/** Alternative headlines worth trying, built from the idea and from what is working in the example titles. */
export function headlineIdeas(current: string, filmTitle: string, exampleTitles: string[]): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const t = s.trim().toUpperCase();
    if (t.length >= 3 && t.length <= 40 && !out.includes(t) && t !== current.trim().toUpperCase()) out.push(t);
  };
  // "A vs B: which is better?" compares A and B; whatever follows the colon is the subtitle
  const vs = splitVersus(filmTitle.split(/[:?|!]/)[0]);
  if (vs) add(`${deriveCoverText(vs[0], 2)} vs ${deriveCoverText(vs[1], 2)}`);
  add(deriveCoverText(filmTitle, 3));
  add(deriveCoverText(filmTitle, 2));
  // the two-word phrase that appears in the most example titles (at least two)
  const counts = new Map<string, number>();
  for (const t of exampleTitles) {
    const ws = words(t).map(norm).filter(Boolean);
    const seen = new Set<string>();
    for (let i = 0; i + 1 < ws.length; i++) {
      if (STOP.has(ws[i]) || STOP.has(ws[i + 1]) || ws[i].length < 3 || ws[i + 1].length < 3) continue;
      seen.add(`${ws[i]} ${ws[i + 1]}`);
    }
    for (const p of seen) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const top = [...counts.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1])[0];
  if (top) add(top[0]);
  return out.slice(0, 4);
}
