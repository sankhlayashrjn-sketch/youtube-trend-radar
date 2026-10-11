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
