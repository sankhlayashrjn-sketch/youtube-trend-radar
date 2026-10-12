# Viva prep (15 Oct, 2:00-8:00 PM): 40% of your total

Answer in this order: **what it does, how it works, why I chose it, what I'd improve.** Keep answers under 45 seconds. Use the numbers below.

## 30-second pitch

"Ishaan makes 3 videos a week and doesn't want a list of trending videos; he wants patterns. Every Sunday before noon, my app fetches live YouTube data for his categories, computes metrics in code, groups videos by topic with Gemini embeddings and k-means, keeps only topics that at least three different creators are covering, and has Gemini Flash write the explanation and filming advice. It saves the brief and emails it. It's free-tier end to end."

## Numbers to know

| Fact | Value |
|---|---|
| AI provider | Gemini Flash only (`gemini-3.8-flash`), embeddings `gemini-embedding-001` (768 dims). No Claude/Anthropic. |
| Schedule | `0 23 * * 6` = Sat 23:00 UTC = Sun 04:30 IST (Hobby cron can fire anywhere in that hour) |
| YouTube quota | 10,000 units/day free; search = 100, videos.list = 1; a run is about 800 units (8 searches) |
| Search cap | max 10 searches per run, split evenly across keywords |
| Videos per run | 50 to 100 target, Shorts (60s or less) and videos older than 14 days dropped |
| Clustering | k = 3 to 6, a cluster needs 3+ distinct creators |
| Themes in brief | 3 to 5 |
| Manual limits | 4 runs/hour, 40 scripts/day |
| Tests | 278 automated tests, 66 smoke checks on the live site, GitHub Actions CI |
| Stack | Next.js 16 App Router, Tailwind, shadcn/ui, Drizzle + postgres-js, Supabase (DB only), Zod, Recharts, Resend |

## Likely questions and answers

**1. Walk me through the pipeline.**
Fetch (mostPopular for matching YouTube categories plus capped keyword searches, then batched videos.list) → metrics in code (views per hour, engagement, duration, unique creators) → embeddings of title and tags → k-means → drop clusters with fewer than 3 creators → Gemini Flash writes JSON → Zod validates → code merges real numbers and verifies URLs → save → email. Each stage saves its result, so a timeout never loses work.

**2. Why k-means and embeddings instead of keyword matching or asking the AI to group?**
Titles that mean the same thing use different words ("free AI stack" vs "stop paying for apps"). Embeddings capture meaning. k-means is simple, deterministic (seeded), cheap in code, and I can test it. Asking an LLM to group 100 videos is slower, costs quota, and isn't reproducible.

**3. How do you choose k?**
I try k = 3 to 6, keep the k that leaves the most clusters passing the 3-creator rule (capped at 5), and break ties with the silhouette score.

**4. What is the "multi-creator rule" and why?**
A trend means several creators independently covering something. One creator posting 10 videos on a topic is a series, not a trend. Clusters with fewer than 3 distinct channels are dropped.

**5. How do you stop the AI from inventing stats or links?**
Gemini only writes prose. The numbers (creators, views, velocity, length) are computed in code and merged in afterwards. Example videos come from the fetched set, URLs are rebuilt from the verified video ID, and `verifyExamples` rejects anything not in the fetched data. The output is Zod-validated; if invalid I retry once with the error message, then fall back to the last brief.

**6. What happens if YouTube or Gemini fails?**
The run is marked failed with a sanitized error, and the dashboard keeps showing the last saved brief with a "stale" banner. The Sunday cron also emails the last brief marked stale. Gemini 429s and 503s retry with exponential backoff.

**7. How do you protect the YouTube quota?**
Daily cache (same settings and day means no refetch), a per-run budget guard, a 24-hour usage guard, a hard cap of 10 searches, and a rate limit on manual runs. The cache key includes a pipeline version so old data from older logic is never reused.

**8. Why is the cron at 23:00 UTC on Saturday?**
That is 04:30 IST on Sunday, safely before noon. Vercel Hobby crons run at most once a day, in UTC, and may fire anywhere within the scheduled hour, so I leave a big margin. The cron route requires `Authorization: Bearer CRON_SECRET`, compared with `timingSafeEqual`.

**9. Why split generation into stages (fetch, cluster, brief)?**
Serverless functions have time limits and the dashboard needs a progress indicator (Fetching → Clustering → Writing brief). Each stage persists to the database, so it can be retried without losing work. The cron route runs all three in one call with `maxDuration = 300`.

**10. Why Supabase only as a database, and why `prepare: false`?**
The brief says no Supabase Auth/Storage/client. I use the transaction pooler (port 6543), which doesn't support prepared statements, so postgres-js is configured with `prepare: false`. Drizzle gives typed queries and migrations.

**11. Why store embeddings as JSON instead of pgvector?**
I cluster in application code, not in SQL, and each run only has about 100 vectors. pgvector would add a dependency and migration with no benefit here. If I did similarity search across history, I'd add pgvector.

**12. How are the signals (momentum, competition, opportunity) calculated?**
Computed in code, relative to the other themes in the same brief: momentum from views per hour, competition from creator count, engagement from (likes+comments)/views. Opportunity = 50% momentum + 35% (100 − competition) + 15% engagement. They're my own weights, easy to change and unit-tested. Gemini decides urgency and saturation from the same facts, so I'd say that part is AI judgement.

**13. How do you rank the top themes?**
Surviving clusters are sorted by total views × number of creators and the top 5 are kept. Weakness: it favours big mainstream topics (festival sales) over small fast-rising ones. The improvement is a momentum-based ranking.

**14. Are you covering Indian creators or global?**
Both. Every call uses `regionCode=IN`, which means "viewable in India", not "creator is from India". I observed Indian channels (Technical Dost, Tech Burner) and international ones (MKBHD), plus some unwanted languages. Next step: tag creators by country and language.

**15. How did you test it? What bugs did you find?**
278 tests (unit, edge cases, regression, component) plus CI on every push plus a read-only smoke test on the live URL, a responsive audit at 5 widths and an accessibility audit. Bugs it found: unsupported regions were accepted, a blank env var overrode defaults, a missing theme index meant theme 0, the script editor vanished when emptied, unknown archive pages returned 200 instead of 404, and an overflow on small phones. Earlier, a manual run showed an early result cap starving later keywords, which is now a regression test.

**16. Security?**
Secrets only in env vars, validated by Zod at first use, never logged; error messages list variable names, not values. Cron route is secret-protected and fails closed. All untrusted text in email is HTML-escaped. External links use `rel="noopener"`. SQL is parameterized (Drizzle). Public routes that call paid or limited APIs are rate limited. **Weakness:** no login, so anyone with the URL can change settings.

**17. Why no AI-generated cover images?**
Gemini's image models have no free tier (about $0.04-0.07 per image) and the brief requires free tier. I built a free in-browser thumbnail maker instead (editable text, emoji, colour, PNG export). Enabling billing would allow AI art as an opt-in.

**18. What would you improve with more time?**
Login; competitor-channel tracking; week-over-week trend history; creator country and language tagging; a content calendar; moving ranking to a momentum score; and an end-to-end browser test suite (Playwright) in CI.

**19. What are the known limitations?**
Resend's free sender can only email the account owner; keyword search is loose, so a few example videos are only weakly on-topic; Gemini free tier has per-minute limits; velocity (views per hour) favours very new uploads; the app is single-user with no login.

**20. A tricky one: "Why did you pick these numbers (3 creators, 14 days, 60 seconds)?"**
They're defensible defaults, documented in DECISIONS.md. 3 creators is the smallest number that rules out one creator's series; 14 days keeps it recent; 60 seconds removes Shorts so length stats reflect long-form videos. All are single constants and easy to change.

## Live-demo safety in the viva

- Have the live URL, GitHub repo, DECISIONS.md and `docs/components-map.png` open.
- If asked to run something live, prefer **Settings, Archive, Draft script and the cover maker**; they don't use YouTube quota.
- If asked to click Generate: it uses about 800 of 10,000 daily units and is limited to 4 per hour. Say that before clicking.
- If something fails: say what you'd check first (Vercel logs, the `runs` table error column, `/api/health`).
