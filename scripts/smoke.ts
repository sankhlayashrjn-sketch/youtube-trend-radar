/**
 * Smoke test against a deployed (or local) URL. Read-only: it never changes data or triggers the pipeline.
 *   npm run smoke -- https://your-site.vercel.app
 */
import { briefSchema } from "../src/lib/types";

const base = (process.argv[2] ?? process.env.SMOKE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const UUID_UNKNOWN = "00000000-0000-4000-8000-000000000000";

type Result = { area: string; check: string; ok: boolean; detail: string };
const results: Result[] = [];
const record = (area: string, check: string, ok: boolean, detail = "") => results.push({ area, check, ok, detail });

async function get(path: string, init?: RequestInit) {
  const t0 = Date.now();
  const res = await fetch(base + path, { redirect: "manual", ...init });
  const body = await res.text();
  return { res, body, ms: Date.now() - t0 };
}

const SECRET_PATTERNS: [string, RegExp][] = [
  ["Google API key", /AIza[0-9A-Za-z_-]{20,}/],
  ["Resend key", /re_[A-Za-z0-9]{8,}_[A-Za-z0-9]{10,}/],
  ["Supabase key", /sb_(secret|publishable)_[A-Za-z0-9_-]{10,}/],
  ["Database URL", /postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/],
  ["Bearer secret", /Bearer\s+[A-Za-z0-9]{24,}/],
];

async function main() {
  console.log(`Smoke test against ${base}\n`);

  // ---- pages ----------------------------------------------------------------
  for (const p of ["/", "/archive", "/settings"]) {
    const { res, body, ms } = await get(p);
    record("pages", `GET ${p} returns 200`, res.status === 200, `${res.status} in ${ms}ms`);
    record("pages", `${p} is HTML with a title`, /<title>[^<]+<\/title>/.test(body) && (res.headers.get("content-type") ?? "").includes("text/html"));
    record("pages", `${p} responds in under 5s`, ms < 5000, `${ms}ms`);
    record("pages", `${p} shows the three nav links`, ["Dashboard", "Archive", "Settings"].every((l) => body.includes(`>${l}<`)));
    record("pages", `${p} has no Components tab (removed on request)`, !/>Components</.test(body));
    const text = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    record("pages", `${p} shows no NaN / undefined text`, !/\bNaN\b|\bundefined\b/.test(text));
    record("pages", `${p} is not an error page`, !/Something went wrong|Application error|Internal Server Error/.test(body));
  }
  {
    const { res } = await get("/components-map");
    record("pages", "/components-map is gone (404)", res.status === 404, String(res.status));
  }
  {
    const { res } = await get("/archive/not-a-uuid");
    record("pages", "/archive/<garbage> returns 404, not a crash", res.status === 404, String(res.status));
    const r2 = await get(`/archive/${UUID_UNKNOWN}`);
    record("pages", "/archive/<unknown uuid> returns 404", r2.res.status === 404, String(r2.res.status));
    const r3 = await get("/archive/%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    record("pages", "/archive/<script> payload returns 404 and is not reflected", r3.res.status === 404 && !r3.body.includes("<script>alert(1)"), String(r3.res.status));
    const r4 = await get("/definitely-not-a-page");
    record("pages", "unknown route returns 404", r4.res.status === 404, String(r4.res.status));
  }

  // ---- static assets ----------------------------------------------------------
  {
    const { body } = await get("/");
    const css = body.match(/\/_next\/static\/[^"']+\.css/)?.[0];
    const js = body.match(/\/_next\/static\/[^"']+\.js/)?.[0];
    if (css) {
      const r = await get(css);
      record("assets", "stylesheet loads (200, text/css)", r.res.status === 200 && (r.res.headers.get("content-type") ?? "").includes("css"), `${css.slice(-24)} ${r.body.length} bytes`);
      record("assets", "stylesheet is compiled Tailwind (not raw @import)", r.body.length > 10_000 && !r.body.includes('@import "tailwindcss"'));
    } else record("assets", "stylesheet link present", false);
    if (js) {
      const r = await get(js);
      record("assets", "JS chunk loads (200)", r.res.status === 200, `${r.body.length} bytes`);
    } else record("assets", "JS chunk present", false);
  }

  // ---- API: health & latest brief ---------------------------------------------
  {
    const { res, body } = await get("/api/health");
    const j = JSON.parse(body || "{}");
    record("api", "GET /api/health: database up", res.status === 200 && j.ok === true && j.db === "up", body.slice(0, 80));
  }
  let briefId: string | null = null;
  {
    const { res, body } = await get("/api/brief/latest");
    const j = JSON.parse(body);
    record("api", "GET /api/brief/latest returns 200 JSON", res.status === 200 && !!j.brief);
    const parsed = briefSchema.safeParse(j.brief);
    record("api", "latest brief passes the Zod schema", parsed.success, parsed.success ? "" : parsed.error.issues[0]?.message);
    if (parsed.success) {
      const b = parsed.data;
      record("api", "brief has exactly 3 headline lines", b.headline.length === 3);
      record("api", "brief has 3-5 themes", b.themes.length >= 3 && b.themes.length <= 5, String(b.themes.length));
      record("api", "every example URL matches its video id (no invented links)", b.themes.every((t) => t.exampleVideos.every((v) => v.url === `https://www.youtube.com/watch?v=${v.id}`)));
      record("api", "every theme has 3+ distinct creators (multi-creator rule)", b.themes.every((t) => t.stats.creatorCount >= 3), b.themes.map((t) => t.stats.creatorCount).join(","));
      record("api", "no negative or NaN numbers in stats", b.themes.every((t) => Object.values(t.stats).every((n) => Number.isFinite(n) && n >= 0)));
      record("api", "urgency and saturation use allowed values", b.themes.every((t) => ["film_now", "soon", "skip"].includes(t.urgency.level) && ["low", "medium", "high"].includes(t.saturation)));
      record("api", "meta says where the data came from", ["live", "cached", "seed"].includes(b.meta.dataSource), b.meta.dataSource);
    }
    record("api", "latest payload has the stale / mismatch flags", typeof j.stale === "boolean" && typeof j.settingsMismatch === "boolean");
    briefId = j.briefId ?? null;
  }

  // ---- API: settings (read, and invalid writes only) ----------------------------
  {
    const { res, body } = await get("/api/settings");
    const s = JSON.parse(body);
    record("api", "GET /api/settings returns the saved settings", res.status === 200 && Array.isArray(s.categories) && typeof s.region === "string" && typeof s.minViews === "number");
    const put = (b: unknown) => get("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    const good = { categories: ["x y"], region: "IN", email: "a@b.co", minViews: 0 };
    for (const [name, payload] of [
      ["empty categories", { ...good, categories: [] }],
      ["unsupported region", { ...good, region: "ZZ" }],
      ["bad email", { ...good, email: "nope" }],
      ["minViews above 20M", { ...good, minViews: 20_000_001 }],
      ["negative minViews", { ...good, minViews: -1 }],
    ] as const) {
      const r = await put(payload);
      record("validation", `PUT /api/settings rejects ${name} (400)`, r.res.status === 400, String(r.res.status));
    }
    const r = await get("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: "{broken" });
    record("validation", "PUT /api/settings with broken JSON is 400, not 500", r.res.status === 400, String(r.res.status));
  }

  // ---- API: script endpoint guards (no writes) -----------------------------------
  {
    for (const [name, qs] of [["no params", ""], ["bad brief id", "briefId=x&themeIndex=0"], ["theme index too high", `briefId=${UUID_UNKNOWN}&themeIndex=9`], ["missing theme index", `briefId=${UUID_UNKNOWN}`]] as const) {
      const r = await get(`/api/script?${qs}`);
      record("validation", `GET /api/script rejects ${name} (400)`, r.res.status === 400, String(r.res.status));
    }
    const r = await get(`/api/script?briefId=${UUID_UNKNOWN}&themeIndex=0`);
    record("api", "GET /api/script for an unknown brief returns null, not an error", r.res.status === 200 && JSON.parse(r.body).script === null);
    const p = await get("/api/script", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ briefId: UUID_UNKNOWN, themeIndex: 0, language: "English" }) });
    record("validation", "POST /api/script for an unknown brief is 404 (no Gemini call)", p.res.status === 404, String(p.res.status));
    const bad = await get("/api/script", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ briefId: UUID_UNKNOWN, themeIndex: 0, language: "Klingon" }) });
    record("validation", "POST /api/script rejects an unsupported language (400)", bad.res.status === 400, String(bad.res.status));
    const put = await get("/api/script", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ briefId: UUID_UNKNOWN, themeIndex: 0, content: "x" }) });
    record("validation", "PUT /api/script with no script to edit is 404", put.res.status === 404, String(put.res.status));
    if (briefId) {
      const real = await get(`/api/script?briefId=${briefId}&themeIndex=0`);
      record("api", "GET /api/script works for the real latest brief", real.res.status === 200, real.body.slice(0, 50));
    }
  }

  // ---- security -----------------------------------------------------------------
  {
    const noAuth = await get("/api/cron/weekly-brief");
    record("security", "cron without a secret is 401", noAuth.res.status === 401, String(noAuth.res.status));
    const wrong = await get("/api/cron/weekly-brief", { headers: { authorization: "Bearer wrong-secret" } });
    record("security", "cron with a wrong secret is 401", wrong.res.status === 401, String(wrong.res.status));
    const basic = await get("/api/cron/weekly-brief", { headers: { authorization: "Basic abc" } });
    record("security", "cron with a non-Bearer scheme is 401", basic.res.status === 401, String(basic.res.status));
    const post = await get("/api/cron/weekly-brief", { method: "POST" });
    record("security", "cron does not accept POST", post.res.status === 405, String(post.res.status));
    const gen = await get("/api/generate");
    record("security", "GET /api/generate is not allowed (405)", gen.res.status === 405, String(gen.res.status));
    const badGen = await get("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage: "cluster" }) });
    record("validation", "POST /api/generate without a run id for a later stage is 400", badGen.res.status === 400, String(badGen.res.status));
    const junkGen = await get("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage: "'; DROP TABLE runs;--" }) });
    record("validation", "POST /api/generate with a SQL-injection-style stage is 400", junkGen.res.status === 400, String(junkGen.res.status));
    const nf = await get("/api/does-not-exist");
    record("security", "unknown API route is 404", nf.res.status === 404, String(nf.res.status));

    // no secrets in anything public
    const pages = ["/", "/archive", "/settings", "/api/brief/latest", "/api/settings", "/api/health"];
    const leaks: string[] = [];
    for (const p of pages) {
      const { body } = await get(p);
      for (const [name, re] of SECRET_PATTERNS) if (re.test(body)) leaks.push(`${p}: ${name}`);
    }
    record("security", "no API keys, DB URL or secrets appear in any public response", leaks.length === 0, leaks.join("; "));
    const home = await get("/");
    const chunks = [...new Set(home.body.match(/\/_next\/static\/[^"']+\.js/g) ?? [])].slice(0, 12);
    for (const c of chunks) {
      const { body } = await get(c);
      for (const [name, re] of SECRET_PATTERNS) if (re.test(body)) leaks.push(`${c.slice(-20)}: ${name}`);
    }
    record("security", "no secrets in the client JavaScript bundles", leaks.length === 0, leaks.join("; "));
  }

  // ---- report ---------------------------------------------------------------------
  const failed = results.filter((r) => !r.ok);
  const byArea = new Map<string, { pass: number; fail: number }>();
  for (const r of results) {
    const a = byArea.get(r.area) ?? { pass: 0, fail: 0 };
    if (r.ok) a.pass++;
    else a.fail++;
    byArea.set(r.area, a);
  }
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  [${r.area}] ${r.check}${r.detail && !r.ok ? `  -> ${r.detail}` : ""}`);
  console.log("\nSummary:");
  for (const [area, c] of byArea) console.log(`  ${area.padEnd(11)} ${c.pass} passed, ${c.fail} failed`);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `, ${failed.length} FAILED` : ""}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("Smoke test crashed:", e);
  process.exit(2);
});
