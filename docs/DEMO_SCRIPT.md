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

The dashboard is a three-step flow (the step bar at the top shows it): **1 Read the week, 2 Choose what to film, 3 Plan the video.** Narrate it in that order.

| Time | On screen | Say |
|---|---|---|
| 0:00 | Dashboard top: title, tracking chips, the step bar | "This is YouTube Trend Radar. Every Sunday morning, Ishaan, a tech creator in India, gets patterns instead of a list of videos. The dashboard has three steps: read the week, choose what to film, plan the video." |
| 0:15 | Step 1: the three headline lines, then click "Next: choose what to film" | "Step one: the week in exactly three lines, built from real YouTube data, not invented." |
| 0:28 | Step 2: the three signal tiles, hover and click "Best bet" | "Step two. Three signals, calculated in code: best bet, most crowded, audience loves. Clicking one picks that theme." |
| 0:42 | The theme list: point at a row (creators, views, views per hour, opportunity bar); click the "Film now" filter, then clear it | "Each row has what I need to compare: how many creators, views, views per hour, urgency and an opportunity score. Each theme needs at least three different creators, so one channel can't fake a trend." |
| 0:55 | Click "Compare all themes on a map" | "If I want the big picture there's an optional map: left and up is the sweet spot, fast growing with few creators." |
| 1:05 | Click "Plan <theme> →" | "Step three: the workspace for just the theme I picked. It has four tabs in order, and each ends with a Next button." |
| 1:12 | Tab "Why it works": the "Film this" box, why now, the meters | "First, why it works: the suggested video, the reason it's urgent, and the numbers behind it." |
| 1:25 | Click Next, tab "Examples" | "Next, the real videos behind the theme. Each shows views, age, duration, likes, comments, views per hour and engagement, and links to YouTube." |
| 1:40 | Click Next, tab "Cover": change the headline, pick a style, (optionally add a photo), Download PNG | "Then the cover. A professional thumbnail with a highlighted keyword taken from what's trending. I can edit it, add my own photo, and download a ready 1280 by 720 PNG." |
| 1:58 | Click Next, tab "Script": open a drafted script, then "Draft with Gemini" on another theme | "And the script. Gemini Flash drafts it with a hook, sections, visual notes and facts to verify. It's editable, auto-saves, and I can copy or download it." |
| 2:20 | Settings: add a category, show the minimum-views slider, Save toast | "Categories, region and email are configurable. Changing them changes the next brief." |
| 2:30 | Back to dashboard: "Your settings changed" notice | "The app won't show an old niche's brief as current. I'd click Generate now to build the new one." *(Don't click it on camera; say: "It fetches live data, clusters it, and writes the brief in about a minute.")* |
| 2:40 | Switch to the email tab | "Every Sunday at about 4:30 AM IST, Vercel Cron triggers the pipeline and this email arrives, same structure as the dashboard." |
| 2:50 | The Components Map image, then the test summary | "Under the hood: Next.js on Vercel, Supabase Postgres, Gemini Flash only, YouTube Data API, Resend, all on free tiers. 307 automated tests, CI on every push, and a live smoke test." |
| 3:00 | End card with the Vercel URL and GitHub URL | "Thanks." |

## If something goes wrong while recording

- **Generate/Draft is slow:** talk over it ("about 20 seconds for a script"), or cut the wait in editing.
- **Rate-limit message:** that is a feature; say "manual runs are limited to protect the free quota."
- **Cover looks off:** hit Reset, then choose the Red hot style.
- **Email missing:** show the previous brief email; check spam.

## Do not say

- "Production-ready for many users": it has no login (single-user tool). Say "single-user, public URL".
- Any claim about exact quota you haven't checked. Safe: "about 800 units per run of 10,000 per day."
