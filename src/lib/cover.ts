/** Pure helpers for the thumbnail (cover) maker. Drawing itself happens in the browser canvas. */

export type CoverStyle = { id: string; label: string; from: string; to: string; accent: string; text: string; stroke: string };

export const COVER_STYLES: CoverStyle[] = [
  { id: "red", label: "Red hot", from: "#ff0000", to: "#7f0000", accent: "#ffe14d", text: "#ffffff", stroke: "#000000" },
  { id: "night", label: "Midnight", from: "#1e1b4b", to: "#020617", accent: "#38bdf8", text: "#ffffff", stroke: "#000000" },
  { id: "sun", label: "Sunny", from: "#fde047", to: "#f97316", accent: "#7f1d1d", text: "#111111", stroke: "#ffffff" },
  { id: "mint", label: "Mint", from: "#34d399", to: "#047857", accent: "#fef08a", text: "#ffffff", stroke: "#022c22" },
  { id: "pink", label: "Pop pink", from: "#f472b6", to: "#7e22ce", accent: "#fde047", text: "#ffffff", stroke: "#2e1065" },
];

const STOP = new Set(["the", "a", "an", "of", "to", "for", "and", "in", "on", "with", "my", "your", "is", "are", "how", "why", "i", "you", "this", "that", "it", "—", "-", "|"]);

/** Fallback headline for briefs created before cover text existed: up to 4 meaningful words, in caps. */
export function deriveCoverText(title: string, maxWords = 4): string {
  const clean = title.replace(/[^\p{L}\p{N}\s'₹$%+&-]/gu, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const picked = clean.filter((w) => !STOP.has(w.toLowerCase()));
  const words = (picked.length >= 2 ? picked : clean).slice(0, maxWords);
  return words.join(" ").toUpperCase();
}

/** Greedy word wrap using a measuring callback, so it works with any canvas font. */
export function wrapWords(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
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

export const defaultEmoji = (urgency: "film_now" | "soon" | "skip") => (urgency === "film_now" ? "🔥" : urgency === "soon" ? "⚡" : "🤔");
