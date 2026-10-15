# Viva prep (15 Oct, 2:00-8:00 PM): 40% of your total

Answer in this order: **what it does, how it works, why I chose it, what I'd improve.** Keep answers under 45 seconds. When unsure, say what the code does, not what you hope it does. Honest limits score better than bluffing.

## 30-second pitch

"Ishaan makes 3 videos a week and doesn't want a list of trending videos; he wants patterns. Every Sunday morning my app fetches live YouTube data for his topics, measures every video in code, groups them by topic using Gemini, keeps only topics that at least three different creators are covering, and has Gemini Flash write the explanation and filming advice. For each theme it also estimates the views and the rough rupee income, so he can pick what to film by money, then plan the video: script first, then cover. It saves the brief and emails it. It's free-tier end to end."

## Numbers to know

| Fact | Value |
|---|---|
| AI provider | Gemini Flash only (`gemini-3.8-flash`), embeddings `gemini-embedding-001` (768 numbers per title). No Claude/Anthropic. |
| Schedule | `0 23 * * 6` = Sat 23:00 UTC = Sun 04:30 IST (Hobby cron can fire anywhere in that hour) |
| YouTube quota | 10,000 units/day free; a search costs 100, a details call costs 1; one run is about 800 units |
| Search cap | max 10 searches per run, split evenly across keywords |
| Videos per run | 50 to 100 target; Shorts (60s or less) and videos older than 14 days dropped |
| Grouping | 3 to 6 groups, a group needs 3+ different creators |
| Themes in brief | 3 to 5 |
| Manual limits | 4 runs/hour, 40 scripts/day |
| Expected income | expected views / 1,000 x earnings per 1,000 views (default ₹80, editable in Settings) |
| Tests | 369 automated tests, 70 live smoke checks, GitHub Actions on every push |
| Stack | Next.js 16, Tailwind, shadcn/ui, Drizzle + postgres-js, Supabase (database only), Zod, Recharts, Resend, Vercel |

## The user journey in one breath

Settings (topics, country, email, minimum views, ₹ per 1,000 views) → Sunday timer or "Generate now" → live YouTube videos → measured in code → grouped by topic → AI writes the brief → saved and emailed → dashboard: **1 Read the week, 2 Choose a theme, 3 Plan the video** (Why it works, Examples, Script, Cover).

## Part A: Product and design questions

**1. Who is this for and what problem does it solve?**
A tech creator in India posting 3 videos a week. Scrolling YouTube to guess what to film wastes hours and is biased by his own feed. The app reads the whole niche for him and says what is rising, how crowded it is, what to film, and roughly what it could earn.

**2. Why "patterns" and not a list of trending videos?**
A list tells you what already blew up; a pattern (several different creators covering the same idea) tells you what the audience wants now. The brief shows 3 to 5 themes, never a raw video list. Example videos are evidence under each theme.

**3. Why did you restructure the dashboard into three steps?**
The first version showed everything at once (headline, chart, filters, long cards) and the user said it was confusing: no flow, unclear next step. Now each step has one job and a Next button: read the week, choose a theme, plan the video. One theme is in focus at a time, and tabs are built only when opened, so edits are never lost.

**4. Why is the Script before the Cover?**
The script decides what the video says; the cover should promise exactly that. Requested by the user and it matches how a creator works.

**5. How does the app help me pick between themes?**
Each theme row shows creators, total views, views per hour, urgency (Film now / Soon / Skip), plus **expected views and rough income**. The list can be sorted by rough income. The "Best bet" signal points at the strongest theme and is pre-selected.

**6. What do the numbers like "19 creators" mean, and is that good?**
Each number is compared with the average of that week's themes and labelled Good, Average or Weak (within 20% of the average is Average). Fewer creators is good (less competition); more views and faster views are good. The comparison is only against this week's other themes. I have no outside benchmark data, and I say so.

**7. How do you estimate expected views?**
In code, no AI. I take the views of the example videos in that theme: the middle value is the expected figure and the lower and upper quarter give the range. Then I adjust for urgency (Film now x1.15, Soon x1, Skip x0.8) and crowding (low x1.1, medium x1, high x0.85). The best case is capped at 3x the expected figure so one viral video cannot inflate it.

**8. How do you get income in rupees? Is it accurate?**
Income = expected views / 1,000 x earnings per 1,000 views. The default is ₹80, a typical figure for Indian tech channels, and the creator sets their real figure in Settings (from YouTube Studio). It's ad income only, before sponsorships, for regular videos not Shorts, and it assumes a typical-size channel. It is an estimate for comparing themes, not a promise, and I have not validated it against real channel results. That is the honest limit.

**9. Why doesn't the estimate use the script?**
Nothing in a script's wording predicts views in a way I can measure honestly. A number built on it would be made up. The estimate rests on what similar videos actually achieved. Future work: learn from the creator's own past videos.

**10. Why did you remove the "Opportunity" score and the four score bars?**
The user found them unhelpful: a 0-100 score compared only with this week's other themes means little on its own. They are replaced by concrete things: expected views, rupee income and good/average/weak labels. The score is still used inside the code to pick "Best bet" but is never shown as a number.

**11. Tell me about the cover maker.**
A free thumbnail studio that runs in the browser. Four templates (Classic, Centred, Big number, Versus for "A vs B"), headline ideas from what is trending, three fonts, outline or boxed highlight, background patterns, a badge, an arrow or circle, your own photo (full, fit, side, or a framed tilted photo with zoom), drag to move anything, a phone-size preview, a timestamp safe zone, copy or download as a 1280x720 PNG. Your photo never leaves the browser.

**12. Why no AI-generated cover images or background removal?**
Gemini image models have no free tier and the brief requires free tier. In-browser background removal needs a very large model (tens of MB) or a paid service. I chose layout tools that are free and private. Both are possible additions if billing is enabled.

**13. How do you know the cover rules are good?**
They come from what performs on tech channels: very few words (2 to 4), one highlighted word, high contrast, clear bottom-right corner for the timestamp. The maker shows live checks (word count, length, contrast) and a phone preview so the creator can judge at small size. I did not A/B test these on real viewers.

**14. Why no login?**
The brief didn't require it and it's a single-user tool. It is a real weakness: anyone with the URL can change settings. Next step would be a simple password or sign-in.

## Part B: How it works (pipeline)

**15. Walk me through the pipeline.**
Fetch (popular videos for matching YouTube categories plus capped keyword searches, then batched details) → measure in code (views per hour, likes ratio, length, creators) → turn titles into numbers with Gemini embeddings → group them (k-means) → drop groups with fewer than 3 creators → Gemini Flash writes JSON → Zod checks it → code adds the real numbers back and verifies every link → save → email. Each stage saves its result, so a timeout never loses work.

**16. Why embeddings and k-means instead of keywords or asking the AI to group?**
Titles that mean the same use different words ("free AI stack" vs "stop paying for apps"). Embeddings capture meaning. k-means is simple, repeatable (seeded), cheap and testable. Asking an LLM to group 100 videos is slower, uses quota and gives different answers each run.

**17. How do you choose the number of groups?**
I try 3 to 6, keep the one that leaves the most groups passing the 3-creator rule (capped at 5), and break ties with the silhouette score.

**18. What is the multi-creator rule?**
A trend means several creators independently covering something. One creator posting 10 videos is a series, not a trend. Groups with fewer than 3 distinct channels are dropped.

**19. How do you stop the AI inventing stats or links?**
Gemini only writes the words. All numbers are computed in code and merged in afterwards. Example videos come from the fetched set, URLs are rebuilt from the verified video ID, and `verifyExamples` rejects anything not in the data. The output is Zod-validated; if invalid I retry once with the error, then fall back to the last brief. There is also an on-topic flag so off-niche themes are dropped.

**20. What if YouTube or Gemini fails?**
The run is marked failed with a safe error message and the dashboard keeps showing the last saved brief with a "stale" banner. The cron emails the last brief marked stale. Gemini 429 and 503 errors retry with exponential backoff, with timeouts of 20 seconds for YouTube and 60 to 90 for Gemini.

**21. How do you protect the YouTube quota?**
Daily cache (same settings and day = no refetch), a per-run budget guard, a hard cap of 10 searches, and a rate limit on manual runs. The cache key includes a pipeline version so old data from older logic is never reused.

**22. Why is the cron at 23:00 UTC Saturday?**
That is 04:30 IST Sunday, safely before noon. Vercel Hobby crons run once a day in UTC and may fire anywhere in that hour, so I leave a margin. The route requires `Authorization: Bearer CRON_SECRET`, compared with `timingSafeEqual`, and ignores a duplicate delivery.

**23. Why split into stages?**
Serverless functions have time limits and the dashboard needs a progress indicator. Each stage persists to the database so it can be retried. The cron runs all three in one call with `maxDuration = 300`. A run-state guard (HTTP 409) stops anyone replaying a stage on a run that isn't in the right state.

**24. Why Supabase only as a database, and what is `prepare: false`?**
The brief says no Supabase Auth, Storage or client. I use the transaction pooler (port 6543), which doesn't support prepared statements, so postgres-js is set to `prepare: false`. Drizzle gives typed queries and migrations. I added one migration for the earnings setting this week.

**25. Why store embeddings as JSON, not pgvector?**
I group in application code, not SQL, and a run has about 100 vectors. pgvector adds setup with no benefit here. I'd add it for similarity search across weeks.

**26. How do you rank themes?**
Surviving groups are sorted by total views x creators and the top 5 kept. Weakness: it favours big mainstream topics over small fast-rising ones. Improvement: rank by momentum.

**27. Are you covering Indian or global creators?**
Both. Every call uses `regionCode=IN`, meaning "viewable in India", not "creator is from India". I saw Indian channels (Technical Dost, Tech Burner) and international ones (MKBHD). Next step: tag creators by country and language.

**28. How are the signals computed?**
In code, relative to the other themes in the same brief: momentum from views per hour, competition from creator count, engagement from (likes+comments)/views. "Best bet" = highest of 50% momentum + 35% low competition + 15% engagement. They are my own weights, easy to change and unit-tested. Gemini decides urgency and saturation from the same facts, so that part is AI judgement.

## Part C: Build quality, testing, security

**29. How did you test it?**
369 automated tests (units, edge cases, regressions, components) run in GitHub Actions on every push; a read-only 70-check smoke test against the live URL; a responsive check at 5 screen widths; keyboard and screen-reader labels checked. This session's additions each came with tests (forecast maths, benchmarks, cover studio, the settings field).

**30. What bugs did testing find?**
Unsupported regions were accepted; a blank env var overrode defaults; a missing theme index meant theme 0; the script editor vanished when emptied; unknown archive pages returned 200 instead of 404; overflow on small phones; a "search budget" bug where early keywords used up the cap so later ones were never searched; typing a script then switching away lost the last words (now saved on exit); and the opportunity-map tooltip jumped because bubbles animated under the cursor.

**31. Security?**
Secrets only in env vars, validated at first use, never logged. The cron route is secret-protected and fails closed. All untrusted text in the email is HTML-escaped. External links use `rel="noopener"`. SQL is parameterised (Drizzle). Public routes that call limited APIs are rate limited. Security headers are set. **Weakness:** no login and no strict content policy.

**32. Did you expose any keys?**
The keys were pasted into chat during the build, so I recommend rotating them after the exam. They are in `.env.local` (git-ignored) and Vercel's env settings, never in the repo or the browser bundle (the smoke test checks the bundles).

**33. What is the hardest decision you made?**
Keeping numbers in code and using AI only for words. It makes the output trustworthy and testable, at the cost of some richness. The second is not using AI to forecast views: I'd rather show a simple, explainable estimate with its limits.

**34. How does deployment work?**
Push to GitHub, CI runs lint, typecheck, tests and a secret-free build, and Vercel serves the app. I deploy with the Vercel CLI; the occasional "error" status on deploy is transient and a retry succeeds.

## Part D: Honesty and improvement

**35. What are the known limitations?**
Resend's free sender only emails the account owner and may land in spam; keyword search is loose so a few examples are weakly on-topic; Gemini free tier has per-minute limits; views per hour favours very new uploads; single user, no login; income and views are estimates not validated against real results.

**36. What would you improve with more time?**
Login; learn the creator's own channel size and past results to make the estimate personal; competitor-channel tracking; week-over-week trend history; creator country and language tags; background removal for covers; an end-to-end browser test suite in CI.

**37. Why did you pick 3 creators, 14 days, 60 seconds?**
Defensible defaults documented in DECISIONS.md. 3 creators is the smallest number that rules out one creator's series; 14 days keeps it recent; 60 seconds removes Shorts so length stats reflect long-form. Each is a single constant, easy to change.

**38. What did the AI do and what did you do?**
Gemini Flash does the language work in the app: writing theme names, why-now, filming angle, scripts, and the meaning numbers for grouping. Everything else (measuring, grouping, rules, estimates, checks) is code I can explain line by line. A design assistant helped write the code; every decision is recorded in DECISIONS.md and I can defend each.

**39. If I changed Ishaan to a fashion creator, what happens?**
Change the topics in Settings. The cache key and a "settings changed" notice stop the old niche's brief being shown as current, then "Generate now" builds a new one. I fixed a real bug here: old tech videos leaked into a fashion brief until I added the pipeline version to the cache key and an on-topic check.

**40. How does the Components Map map to the code?**
Seven rows: Ishaan (settings, reads, picks, makes the video), Sunday Timer (cron route), Our app (check, plan, measure, group, build), YouTube (video data), Gemini AI (meaning numbers, brief, script), Database (settings, cache, briefs), Email (Resend). Follow numbers 1 to 15 left to right.

## Quick answers if you blank

- **Is it AI?** AI writes; code measures and checks.
- **Is it live data?** Yes, YouTube Data API v3 on every run; a cache only reuses data from the same day.
- **Is it free?** Yes: Vercel Hobby, Supabase free, Gemini free tier, Resend free, YouTube free quota.
- **What if it breaks?** The last good brief stays on screen, marked stale.
- **What is the weakness?** No login, and the income estimate is a guide, not a guarantee.

## Live-demo safety in the viva

- Have the live URL, the GitHub repo, DECISIONS.md and `docs/components-map.png` open.
- Prefer demoing **Settings, Archive, a drafted script and the cover studio**; they don't use YouTube quota.
- If asked to click Generate: it uses about 800 of 10,000 daily units and is limited to 4 per hour. Say that before clicking.
- If something fails: say what you'd check first (Vercel logs, the `runs` table error column, `/api/health`).
- If an email seems missing: check Spam; it is sent from Resend's shared test address.
