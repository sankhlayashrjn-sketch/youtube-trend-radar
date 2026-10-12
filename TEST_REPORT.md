# Test report

Run date: 2026-10-12. Target: https://youtube-trend-radar-sankhlayashrjn-sketch.vercel.app

| Layer | What | Result |
|---|---|---|
| Static | `tsc --noEmit`, ESLint, production build | 0 errors, 0 warnings |
| Unit + edge + regression + component | Vitest, 12 files, 204 tests | 204 passed |
| Smoke (live, read-only) | `npm run smoke -- <url>`, 66 checks | 66 passed |
| Browser (responsive) | 5 pages x 5 widths (320, 375, 768, 1024, 1280) | no horizontal overflow, nav fits |
| Browser (accessibility) | structure audit on 3 pages | clean |
| Browser (interaction) | dark mode, filters, sort, jump-to-theme, slider | working |

## Commands

```bash
npm test                                   # all unit, edge, regression and component tests
npm run typecheck && npm run lint          # static checks
npm run build                              # production build
npm run smoke -- https://<your-site>       # read-only smoke test against a running site
```

## What is covered

- **Unit:** metrics, formatting, YouTube row mapping, search-budget planning, quota guard, k-means and the 3-creator rule, signals scoring, cover helpers, script prompt, email rendering, Zod schemas, env validation.
- **Edge cases:** empty and one-item inputs, identical vectors, one creator posting many videos, zero/negative/future values, missing fields, non-Latin text, 40,000-character inputs, malformed JSON bodies, SQL- and script-like text, double clicks, network failures, rate limits (429), Gemini failing twice, a deleted-everything script box.
- **Security:** cron secret (missing, wrong, partial, wrong scheme, wrong method, unconfigured), no secrets in any public response or client bundle, HTML escaping of every untrusted field in email, safe external links.
- **Regression:** one test for each bug found during development (see below).
- **API routes:** called directly with mocked dependencies (settings, script, generate, cron, health, latest).
- **Components (jsdom):** brief view filters/sort/min-views, example video details, settings form, script editor (autosave debounce, confirm, errors), cover maker (canvas draw order), generate button.

## Bugs found by testing, and fixed

| # | Bug | Found by | Fix |
|---|---|---|---|
| 1 | Region accepted any two letters (e.g. `ZZ`), which would make every YouTube fetch fail | route tests | Region must be one of the supported codes |
| 2 | `GET /api/script` without `themeIndex` was treated as theme 0 | route tests | Missing parameter is now a 400 |
| 3 | A blank optional env var (e.g. `GEMINI_MODEL=`) overrode the default with an empty string | env tests | Blank values fall back to the default |
| 4 | A symbols-only title produced `---` as the cover headline | unit tests | Tokens without letters or digits are dropped |
| 5 | Selecting all and deleting the script text made the editor disappear | component tests | Editor stays once a script exists |
| 6 | Unknown archive pages returned HTTP 200 (soft 404) because the loading skeleton starts streaming first | live smoke test | Skeletons scoped with route groups; `/archive/[id]` now returns a real 404 |
| 7 | Archive list overflowed the page sideways at 320px | responsive audit | `min-w-0` on list items |
| 8 | Nav row overflowed on small phones (375px and 320px) | responsive audit | Tighter spacing, hidden scrollbar |
| 9 | Cover emoji drawn washed-out (inherited the stripe fill alpha) | visual check | Reset fill and alpha before drawing the emoji |
| 10 | Earlier in development: an early result cap let the first keywords crowd out the rest | manual run | Equal share per keyword (`planSearches`), now unit-tested |

## Known observations (not fixed)

- **Hidden duplicate DOM in non-visible tabs.** When a tab is not visible, the browser does not run `requestAnimationFrame`, so React 19 never finishes revealing streamed Suspense content. A `display:none` copy of the page stays in the DOM and duplicates element IDs. Nothing visible is affected (filters, forms, jump-to-theme all work). It could not be reproduced in a foreground tab from the test tools used here. Removing the loading skeletons would avoid it, but they are part of the requirements.
- **`next-themes` dev warning.** In development the console shows "Encountered a script tag while rendering React component" from the `next-themes` library. It does not appear in production builds.
- **Public, login-free app.** Anyone with the URL can change settings and edit scripts. Generation is rate limited (4 runs per hour, 40 scripts per day) to protect free quotas.
- **Not covered by automation:** the real Sunday cron firing (next: 18 Oct 2026, about 04:30 IST), and emails rendering in every mail client. The cron route, its secret check and the email HTML are tested.
