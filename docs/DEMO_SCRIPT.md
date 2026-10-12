# Demo video script (target 3:00, hard limit 4:00)

**Goal:** show that it works end to end on the live URL, that the output is useful for a creator, and that the engineering is solid. Record the browser at 1080p, mic on, no background music.

## Before you hit record (5 minutes)

- [ ] Open the live URL. Settings should show Ishaan's 8 categories, region India, your email.
- [ ] Minimum views in Settings: set to **0 ("Any")** so every card has examples.
- [ ] A fresh brief exists (dashboard says "Tracking" with the 8 chips, not "Your settings changed").
- [ ] Draft **one** script before recording (so "Open draft script" is instant), but leave another theme empty to show drafting live.
- [ ] Have your inbox open in a second tab with the latest brief email.
- [ ] **Do not click Generate more than once**: manual runs are limited to 4 per hour and use about 800 YouTube quota units.
- [ ] Close notifications. Zoom the browser to 110% so text is readable.

## Shot list

| Time | On screen | Say |
|---|---|---|
| 0:00 | Dashboard top (hero) | "This is YouTube Trend Radar. Every Sunday morning, Ishaan, a tech creator in India, gets patterns instead of a list of videos: which topics several creators are riding, which formats win, and what to film." |
| 0:15 | Read the 3 headline lines | "The headline is exactly three lines. Everything under it is computed from real YouTube data, not invented." |
| 0:25 | Scroll to Signals tiles, hover one, click it | "These signals are calculated in code: best bet, fastest riser, most crowded, audience loves. Clicking one jumps to that theme." |
| 0:40 | Opportunity map | "Each bubble is a theme. Left and up is the sweet spot: fast growing with few creators. Size is total views, colour is urgency." |
| 0:55 | Click "Film now" chip, then Sort by Momentum | "I can filter by urgency and sort by momentum or views." |
| 1:05 | One theme card: stats chips, why now, meters | "Each theme needs at least three different creators, so one channel can't fake a trend. Why-now cites real numbers." |
| 1:20 | Example video cards (scroll the strip) | "Every example shows views, how old it is, duration, likes, comments, views per hour and engagement. Links go straight to YouTube." |
| 1:35 | Cover maker: change headline, pick a colour, Download PNG | "For the suggested video there's a thumbnail maker. Edit the text, pick a style, download a ready 1280 by 720 PNG." |
| 1:50 | Open a script (already drafted) then "Draft with Gemini" on another theme | "Gemini Flash drafts a script with hook, sections, visual notes and facts to verify. It's editable, auto-saves, and I can copy it or download it." |
| 2:10 | Settings: add a category, show the minimum-views slider, Save toast | "Categories, region and email are configurable. Changing them changes the next brief." |
| 2:20 | Back to dashboard: "Your settings changed" notice | "The app won't show an old niche's brief as current. I'd click Generate now to build the new one." *(Don't click it on camera; say: "It fetches live data, clusters it, and writes the brief in about a minute.")* |
| 2:30 | Switch to the email tab | "Every Sunday at about 4:30 AM IST, Vercel Cron triggers the pipeline and this email arrives, same structure as the dashboard." |
| 2:42 | Archive page, open one | "Past briefs are saved so he can compare weeks." |
| 2:50 | README or the Components Map image, then the test summary | "Under the hood: Next.js on Vercel, Supabase Postgres, Gemini Flash only, YouTube Data API, Resend, all on free tiers. 204 automated tests and a live smoke test pass." |
| 3:00 | End card with the Vercel URL and GitHub URL | "Thanks." |

## If something goes wrong while recording

- **Generate/Draft is slow:** talk over it ("about 20 seconds for a script"), or cut the wait in editing.
- **Rate-limit message:** that is a feature; say "manual runs are limited to protect the free quota."
- **Cover looks off:** hit Reset, then choose the Red hot style.
- **Email missing:** show the previous brief email; check spam.

## Do not say

- "Production-ready for many users": it has no login (single-user tool). Say "single-user, public URL".
- Any claim about exact quota you haven't checked. Safe: "about 800 units per run of 10,000 per day."
