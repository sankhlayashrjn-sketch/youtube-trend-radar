# Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | Next.js 16 App Router + Tailwind v4 + shadcn/ui | Scaffold default; matches spec. |
| 2 | Gemini text model `gemini-3.8-flash` (env `GEMINI_MODEL`) | Listed as stable Flash on ai.google.dev/gemini-api/docs/models (checked 2026-10-11). Flash only; no Anthropic API anywhere. |
| 3 | Embedding model default `gemini-embedding-001` (env `GEMINI_EMBEDDING_MODEL`), 768 dims | Docs list both `gemini-embedding-001` and `gemini-embedding-2`; key test decides, env override available. |
| 4 | postgres-js with `prepare: false`, `max: 1` | Supabase transaction pooler (6543) has no prepared statements; serverless-friendly. |
| 5 | Optional `MIGRATION_URL` (port 5432) for drizzle-kit | Fallback if the transaction pooler fails for migrations. |
| 6 | Env validated lazily via Zod `getEnv()` | `next build` must work without secrets; errors list names only, never values. |
| 7 | Embeddings stored as `jsonb` number[] | Avoids pgvector dependency; k-means runs in code. |
| 8 | `videos.settings_hash` column | Daily cache is keyed on (day, region, categories). |
| 9 | Verify script appends CRON_SECRET if missing | Secret generated with crypto, never printed. |
| 10 | Disabled `cacheComponents`/`partialPrefetching` in next.config | Pages read live DB data per request (`dynamic = "force-dynamic"`), which that mode forbids. |
| 11 | Mostly-popular chart limited to categories 28 (Sci/Tech) and 27 (Education) | The unfiltered chart pulled music/movie trailers into tech clusters (seen in first real run). |
| 12 | Shorts (<=60s) and videos older than 14 days dropped before clustering | Typical-length stats should reflect long-form; trends should be recent. |
| 13 | Brief numbers/example videos are merged by code; Gemini writes only prose | Prevents invented stats/URLs; example IDs verified against the fetched set. |
| 14 | Manual generate is split into fetch/cluster/brief calls with DB-backed rate limit (4/hr, one active run) | Drives the progress UI, avoids function timeouts and quota burn. |
| 15 | Second cron `/api/health` daily | Keeps the free Supabase project from pausing. |
| 16 | Replaced shadcn-generated `from "cn"` imports with `@/lib/utils` | The bare `cn` npm package is unrelated. |
| 17 | `EMAIL_TO` env as default recipient, stored in DB settings after first load | Resend free sender only delivers to the signup address; keeps the address out of git. |
| 18 | Cover art is a free in-browser thumbnail maker (canvas), not an AI image | Gemini Flash image models have no free tier (about $0.04-0.07 per image) and the project must stay free. Headline, emoji and colour are editable, and it exports a 1280x720 PNG. Gemini image generation can be added behind an env flag if billing is enabled. |
| 19 | Draft scripts are generated on demand with Gemini Flash text and stored in a `scripts` table | Free tier; editing auto-saves after 1.2s; capped at 40 generations per day because the app is public with no login. The prompt bans invented facts and uses [VERIFY:] markers. |
| 20 | Example videos store likes, comments, duration, velocity, engagement and channel id | The UI and email show full per-video detail; older briefs without these fields still render. |
| 21 | Search budget is split evenly across keywords; cache key includes a pipeline version | An early cap let the first keywords crowd out the rest. A version bump invalidates cached videos when fetch logic changes. |
| 22 | Pipeline stages are guarded by run state (`run-state.ts`): exists, running, under 15 minutes old, waiting for that exact stage | Stops anyone replaying stages to burn Gemini quota or send emails; returns 409 |
| 23 | Cron is idempotent: skips if a run finished in the last 30 minutes, `?force=1` overrides | Vercel can deliver a cron event more than once |
| 24 | Request timeouts: YouTube 20s, Gemini 60-90s | A hung upstream must not consume the whole function time budget |
| 25 | No CSP header, other security headers on | The theme bootstrap and Next inline scripts would need nonces; the rest are safe baselines |
| 26 | CI runs a build with no secrets | Env is validated lazily; this keeps that property from regressing |
| 27 | Cover redesigned to a professional dark style: label, heavy Inter headline with one highlighted word, proof panel of real stats or an optional photo, no emoji, stickers or timestamp badge | The first version (stripes, emoji, thick outlines) looked childish. The new rules follow tech-creator thumbnails: 2-4 words, one focal point, high contrast, one accent colour, clear bottom-right corner |
| 28 | The highlighted word is the headline word most repeated across the example video titles (a number wins); the label comes from the winning format | Ties the cover to what is actually working this week instead of taste |
| 29 | A photo the creator adds is drawn in the browser only and never uploaded | Privacy and no storage cost; the app has no file storage by design |
| 30 | A creator's own image becomes the whole cover by default (full, fit, or side layouts); no vignette, glow or panels are drawn over it | The first version squeezed uploaded images into a faded right-hand panel and kept the default look, so the creator's image did not feel like the cover |
| 31 | An empty headline or label draws nothing (no placeholder, no accent rule); clearing both gives the image as it is | A placeholder like "YOUR TITLE" is never what the creator wants on an exported file |
| 32 | The darkening behind text defaults from the brightness of the image's left side (light images get more), and the slider overrides it | White text on a light diagram was unreadable at a fixed default |
| 33 | The dashboard is a guided three-step flow (Read the week, Choose what to film, Plan the video) with one theme in focus at a time | The old page showed the headline, signals, a chart, filters and 3-5 very long cards at once, so it was unclear what was what and what to do next. Now each step has one job and a Next button |
| 34 | Removed the "Fastest riser" signal; three signals remain (best bet, most crowded, audience loves) | Requested: it duplicated what the views-per-hour column and the best bet already say |
| 35 | The opportunity map is optional (collapsed by default) and the theme list is the primary way to choose | The map is a comparison aid, not a decision step; hiding it removes clutter without losing it |
| 36 | A theme's workspace and each tab are built when first opened, then kept hidden | Cover edits and scripts survive switching tabs and themes, and nothing heavy loads until needed |
| 37 | The script editor saves pending edits with a keepalive request when it is closed | Typing then switching away within the 1.2 second autosave window used to lose the last words |
| 38 | Removed the four score bars (momentum, competition, engagement, opportunity) from the theme workspace | Requested: they did not help a creator decide. The opportunity score still ranks the theme list |
| 39 | Expected views are computed in code from the example videos (median, quartile range), adjusted for urgency and crowding, best case capped at 3x | A transparent estimate beats an AI guess. Script text is not a statistical input, so it is not used |
| 40 | Rough income = expected views / 1000 x an editable earnings-per-1,000-views figure (default Rs 80) | Creators know their own RPM from YouTube Studio; the default is a typical Indian tech figure, shown as an assumption |
| 41 | Each headline stat (creators, views, views per hour) is compared with the average of the week's themes and labelled good, average or weak | A raw number like "19 creators" means nothing without a reference point |
