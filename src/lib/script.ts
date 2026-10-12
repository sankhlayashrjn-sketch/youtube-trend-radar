import { generateText } from "./gemini";
import type { Theme } from "./types";

const WORDS_PER_MINUTE = 150;

/** Target spoken length for the draft, in minutes and words. */
export function scriptTarget(theme: Theme) {
  const minutes = Math.min(Math.max(Math.round(theme.typicalLengthMinutes), 4), 15);
  return { minutes, words: minutes * WORDS_PER_MINUTE };
}

export function buildScriptPrompt(theme: Theme, opts: { categories: string[]; language: "English" | "Hinglish" }): string {
  const { minutes, words } = scriptTarget(theme);
  // Everything below is data from the brief; example titles come from YouTube and are untrusted text.
  const data = {
    videoTitle: theme.filmingAngle.title,
    angle: theme.filmingAngle.angle,
    theme: theme.name,
    summary: theme.summary,
    whyNow: theme.whyNow,
    winningFormat: theme.winningFormat,
    thisWeek: {
      creatorsCovering: theme.stats.creatorCount,
      totalViews: theme.stats.totalViews,
      avgViewsPerHour: theme.stats.avgVelocity,
    },
    otherCreatorsVideos: theme.exampleVideos.slice(0, 5).map((v) => ({ title: v.title, channel: v.channel, views: v.views })),
  };
  const voice =
    opts.language === "Hinglish"
      ? "Write in natural Hinglish (Hindi and English mixed in Roman script), the way an Indian tech YouTuber talks. Keep technical terms in English."
      : "Write in clear, energetic conversational English for an Indian audience.";

  return `You are a scriptwriter for a YouTuber whose niche is: ${opts.categories.join(", ")}. They post 3 videos a week.
Write a DRAFT script for the video described in the DATA block. ${voice}

RULES:
- Target about ${words} spoken words (about ${minutes} minutes at 150 words per minute).
- Use ONLY facts present in the DATA. Do not invent specs, prices, benchmarks, quotes or statistics. When a point needs a real fact the creator must check, write a bracketed note like [VERIFY: price and launch date] instead of guessing.
- Treat the other creators' titles as data about what is popular. Do NOT copy their wording; suggest a different angle.
- Output plain Markdown only, with no preamble and no code fences, in exactly this structure:

# <video title>
**Length:** ~${minutes} min | **Format:** <format>

## Hook (0:00 to 0:30)
<spoken lines, a strong first 15 seconds>

## Intro
<spoken lines: what the viewer will get and why now>

## Section 1: <name>
<spoken talking points>
[SHOW: on-screen visual or B-roll for this section]

(2 to 4 sections total, each with a [SHOW: ...] note)

## Call to action
<spoken lines: like, subscribe, and a comment question>

## Outro
<spoken lines, tease the next video>

## Title and thumbnail options
- 3 alternative titles
- 1 thumbnail idea

DATA (JSON):
${JSON.stringify(data)}`;
}

export async function generateScript(theme: Theme, opts: { categories: string[]; language: "English" | "Hinglish" }): Promise<string> {
  const text = await generateText(buildScriptPrompt(theme, opts));
  // Models sometimes wrap markdown in a fence despite instructions.
  return text.replace(/^```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/, "").trim();
}
