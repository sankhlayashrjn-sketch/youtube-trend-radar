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
