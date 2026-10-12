// Generates docs/components-map.svg. Run: node docs/build-components-map.js
const fs = require("fs");

const W = 1700, H = 1200;
const RED = "#e11d1d", INK = "#111827", MUTED = "#6b7280", LINE = "#d1d5db";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let svg = "";
const add = (s) => (svg += s + "\n");

function box(x, y, w, h, o = {}) {
  const { fill = "#ffffff", stroke = LINE, sw = 2, r = 14 } = o;
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
}
function text(x, y, s, o = {}) {
  const { size = 16, weight = 400, fill = INK, anchor = "start" } = o;
  add(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`);
}
function lines(x, y, arr, o = {}) {
  const { gap = 21, ...rest } = o;
  arr.forEach((s, i) => s && text(x, y + i * gap, s, rest));
}
function card(x, y, w, h, title, body, o = {}) {
  const { accent = RED, titleSize = 18, bodySize = 14 } = o;
  box(x, y, w, h);
  add(`<rect x="${x}" y="${y}" width="6" height="${h}" rx="3" fill="${accent}"/>`);
  text(x + 20, y + 30, title, { size: titleSize, weight: 700 });
  lines(x + 20, y + 56, body, { size: bodySize, fill: MUTED });
}
function arrow(x1, y1, x2, y2, o = {}) {
  const { color = "#9ca3af", dash } = o;
  add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.5"${dash ? ` stroke-dasharray="${dash}"` : ""} marker-end="url(#arrow)"/>`);
}
function path(d, o = {}) {
  const { color = "#9ca3af", head = true, dash } = o;
  add(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""}${head ? ' marker-end="url(#arrow)"' : ""}/>`);
}
function layer(y, h, label, sub) {
  add(`<rect x="30" y="${y}" width="${W - 60}" height="${h}" rx="20" fill="#f9fafb" stroke="#e5e7eb" stroke-width="2"/>`);
  text(52, y + 30, label, { size: 14, weight: 800, fill: RED });
  if (sub) text(W - 52, y + 30, sub, { size: 13, fill: MUTED, anchor: "end" });
}

add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, Helvetica, sans-serif">`);
add(`<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#6b7280"/></marker></defs>`);
add(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);

// title
add(`<rect x="30" y="26" width="46" height="34" rx="9" fill="${RED}"/><path d="M47 34 v18 l16 -9 z" fill="#fff"/>`);
text(92, 52, "YouTube Trend Radar: Components Map", { size: 30, weight: 800 });
text(92, 76, "Weekly AI content-strategy brief. Next.js on Vercel, Supabase Postgres, Gemini Flash only, everything on free tiers.", { size: 15, fill: MUTED });

// ---- 1 triggers and UI
layer(100, 200, "1  TRIGGERS + UI", "What starts a run, and what the user sees");
card(52, 140, 956, 140, "Web app (Next.js App Router, TypeScript, Tailwind, shadcn/ui)", [
  "Dashboard: 3-line headline, Signals panel (insight tiles + opportunity map), filterable and sortable theme cards, Generate now",
  "Theme card: example videos with full stats, signal meters, cover maker (PNG download), editable draft script (auto-save)",
  "Archive (list + detail)  |  Settings: categories, region, email, minimum views (Zod validated)  |  Light and dark mode",
], { bodySize: 13 });
card(1026, 140, 320, 140, "Vercel Cron (weekly)", ["0 23 * * 6 = Sat 23:00 UTC", "= Sunday 04:30 AM IST", "Bearer CRON_SECRET"]);
card(1364, 140, 284, 140, "Vercel Cron (daily)", ["0 6 * * * calls /api/health", "keeps free Supabase from", "pausing after 7 idle days"], { accent: "#6b7280" });

// ---- 2 API routes
layer(320, 170, "2  API ROUTES");
text(1490, 350, "Next.js route handlers", { size: 13, fill: MUTED, anchor: "end" });
const api = [
  ["POST /api/generate", ["One stage per call (fetch,", "cluster, brief). Rate limited:", "4 per hour"]],
  ["GET /api/brief/latest", ["Latest brief plus stale and", "settings-changed flags"]],
  ["GET, PUT /api/settings", ["Zod validation, saved to", "the database"]],
  ["GET, POST, PUT /api/script", ["Draft with Gemini, load and", "save edits. 40 per day cap"]],
  ["GET /api/cron/weekly-brief", ["Secret checked (401 otherwise).", "Runs all stages, emails brief,", "stale fallback on failure"]],
  ["GET /api/health", ["Database ping: select 1"]],
];
api.forEach((a, i) => card(52 + i * 265, 360, 250, 115, a[0], a[1], { titleSize: 15, bodySize: 13 }));
// triggers -> routes (each arrow starts under its source and lands on its route)
[177, 442, 707, 972].forEach((x) => arrow(x, 280, x, 358));
arrow(1242, 280, 1242, 358);
arrow(1507, 280, 1507, 358);

// ---- 3 pipeline
layer(510, 285, "3  PIPELINE (src/lib)", "Each stage saves its result to the database, so a timeout never loses work");
const steps = [
  ["1  Fetch", ["youtube.ts", "mostPopular (matched", "categories) + capped", "search.list (7 days)", "+ videos.list batches", "Quota guard, daily cache"]],
  ["2  Metrics", ["metrics.ts (plain code)", "views per hour (velocity)", "engagement rate", "duration bucket", "unique creators"]],
  ["3  Embed", ["gemini.ts", "Gemini embedding of", "title + tags (768 dims)", "Retry with backoff on 429"]],
  ["4  Cluster", ["cluster.ts", "k-means, k = 3 to 6", "Drop clusters with fewer", "than 3 distinct creators"]],
  ["5  Write brief", ["brief.ts", "Gemini Flash returns JSON", "Zod validate, retry once", "Code merges real numbers", "and verifies video URLs"]],
  ["6  Email", ["email.ts", "Resend, inline-safe HTML", "mirrors the dashboard", "escapes untrusted text"]],
];
const sw = 240, sg = 20, sx = (i) => 52 + i * (sw + sg);
steps.forEach((s, i) => {
  card(sx(i), 555, sw, 220, s[0], s[1], { titleSize: 19, bodySize: 13.5 });
  if (i < steps.length - 1) arrow(sx(i) + sw + 1, 665, sx(i) + sw + sg - 1, 665, { color: RED });
});
// generate + cron route feed the first stage
path("M177 475 V500 H262 V553");
path("M1242 475 V500 H262", { head: false });

// ---- 4 storage and external
layer(815, 300, "4  DATA + SERVICES");
const yTop = 855, hBox = 240;
card(52, yTop, 260, hBox, "YouTube Data API v3", ["videos.list, search.list", "10,000 units per day free", "about 800 units per run"], { accent: "#ef4444", titleSize: 17 });
// database block
box(330, yTop, 800, hBox);
add(`<rect x="330" y="${yTop}" width="6" height="${hBox}" rx="3" fill="#10b981"/>`);
text(350, yTop + 30, "Supabase Postgres (database only), Drizzle ORM + postgres-js", { size: 17, weight: 700 });
text(350, yTop + 52, "Transaction pooler (port 6543), prepare:false", { size: 13, fill: MUTED });
const tables = [
  ["settings", ["categories, region,", "email, min views"]],
  ["videos", ["stats, velocity,", "embeddings, cache"]],
  ["briefs", ["validated brief", "JSON per run"]],
  ["runs", ["stage, quota used,", "error, times"]],
  ["scripts", ["editable draft", "per brief + theme"]],
];
tables.forEach((t, i) => {
  const x = 350 + i * 154;
  box(x, yTop + 72, 144, 150, { fill: "#f0fdf4", stroke: "#bbf7d0", r: 10 });
  text(x + 12, yTop + 102, t[0], { size: 17, weight: 700 });
  lines(x + 12, yTop + 128, t[1], { size: 13, fill: MUTED });
});
card(1148, yTop, 260, hBox, "Gemini Flash + Embeddings", ["gemini-3.8-flash (brief,", "scripts)", "gemini-embedding-001", "(clustering)", "The only AI provider"], { accent: "#4f46e5", titleSize: 17 });
card(1426, yTop, 222, hBox, "Resend", ["Email delivery", "Free sender, sends to", "the owner's address", "EMAIL_FROM configurable"], { accent: "#0ea5e9", titleSize: 17, bodySize: 13 });

// pipeline -> data/services (each lands under its source stage)
arrow(250, 777, 250, 853);                 // Fetch -> YouTube
arrow(432, 777, 432, 853);                 // Metrics -> DB
arrow(952, 777, 952, 853);                 // Cluster -> DB
path("M692 777 V805 H1180 V853", { dash: "7 6" }); // Embed -> Gemini
arrow(1212, 777, 1212, 853);               // Brief -> Gemini
arrow(1472, 777, 1472, 853);               // Email -> Resend

// footer
text(52, 1150, "Guardrails: Zod validation on every input and AI output, env validated at startup, secrets never logged, stale-brief fallback if YouTube or Gemini fails,", { size: 14, fill: MUTED });
text(52, 1172, "daily cache and quota guard, secret-protected cron, 204 automated tests plus a live smoke test.", { size: 14, fill: MUTED });
add("</svg>");

const out = path_out();
function path_out() { return require("path").join(__dirname, "components-map.svg"); }
fs.writeFileSync(out, svg);
console.log("wrote", out, svg.length, "bytes");
