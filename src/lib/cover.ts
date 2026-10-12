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
