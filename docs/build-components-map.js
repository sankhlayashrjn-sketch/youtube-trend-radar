// Generates docs/components-map.svg in the swimlane style of the reference map.
// Run: node docs/build-components-map.js   (then convert to PNG)
const fs = require("fs");
const nodePath = require("path");

const W = 2000, H = 1170;
const BROWN = "#6b5a4a", INK = "#2a2118", MUTED = "#4b4036";
const COL_X = [388, 658, 928, 1198, 1468, 1738];
const COLS = ["Trigger", "Input", "Context", "Processing", "AI", "Output"];
const LANE_TOP = 158, LANE_H = 124, BW = 226, BH = 88;

const LANES = [
  { name: "Ishaan", sub: "(Creator)", tint: "#e8ecf8" },
  { name: "Vercel Cron", sub: "(Scheduler)", tint: "#eee9f6" },
  { name: "Our app", sub: "(Next.js on Vercel)", tint: "#f1eed4" },
  { name: "YouTube", sub: "(Data API v3)", tint: "#f6e7e3" },
  { name: "Gemini", sub: "(Reasoning)", tint: "#f4e4ee" },
  { name: "Supabase", sub: "(Memory)", tint: "#e1efe6" },
  { name: "Resend", sub: "(Email)", tint: "#e0eef2" },
];

const TYPES = {
  code: { fill: "#efe8b6", stroke: "#a39433" },
  ai: { fill: "#f3d2e0", stroke: "#c4558a" },
  people: { fill: "#dde2f7", stroke: "#7a86c9" },
  shape: { fill: "#dcd4f2", stroke: "#8a72c8" },
  service: { fill: "#d3e8cf", stroke: "#68a465" },
  stored: { fill: "#cde6df", stroke: "#4c9887" },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let svg = "";
const add = (s) => (svg += s + "\n");

const laneC = (l) => LANE_TOP + l * LANE_H + LANE_H / 2;
const B = {}; // id -> {cx, cy}
const place = (id, lane, col) => (B[id] = { cx: COL_X[col], cy: laneC(lane) });

// ---- every box: id, lane, column, type, step number, title, three detail lines
const BOXES = [
  ["I1", 0, 0, "people", "A", "Taps Generate now", ["or just waits for Sunday", "4 tries an hour", "progress bar shows each step"]],
  ["I2", 0, 1, "people", 1, "Sets his niche", ["8 keywords · region India", "email · minimum views", "checked before it is saved"]],
  ["I3", 0, 3, "people", 13, "Reads the brief", ["email on Sunday, or dashboard", "3-line headline · 3 signals", "ranked theme list · optional map"]],
  ["I4", 0, 4, "people", 14, "Picks a theme to plan", ["one theme in focus at a time", "why it works · example videos", "views · age · length · likes"]],
  ["I5", 0, 5, "shape", 15, "Makes the video", ["designs the cover → PNG", "asks for a draft script", "edits it (auto-saves) · copies"]],

  ["V1", 1, 0, "service", 2, "Wakes up on Sunday", ["4:30 AM IST (Sat 23:00 UTC)", "proves itself with a secret key", "ignores a repeat delivery"]],

  ["A1", 2, 1, "code", 3, "Checks the request", ["secret key · 4 runs per hour", "right run, right stage only", "bad input turned away (Zod)"]],
  ["A2", 2, 2, "code", 4, "Plans the search", ["reads his niche and today's cache", "matching chart + up to 10 searches", "equal share each · quota guard"]],
  ["A3", 2, 3, "code", 6, "Measures every video", ["views per hour · engagement", "length · creators counted", "Shorts and old videos dropped"]],
  ["A4", 2, 4, "code", 8, "Groups by topic", ["clusters the meaning numbers", "a trend needs 3+ creators", "one channel can't fake it"]],
  ["A5", 2, 5, "code", 10, "Builds the brief", ["adds the real numbers back", "checks every video link", "scores momentum · competition"]],

  ["Y1", 3, 2, "service", 5, "Supplies live videos", ["search · most popular · details", "about 800 of 10,000 free units", "gives up after 20 seconds"]],

  ["G1", 4, 3, "ai", 7, "Turns titles into numbers", ["Gemini embeddings (768 numbers)", "titles + tags become a map", "waits and retries if busy"]],
  ["G2", 4, 4, "ai", 9, "Writes the brief", ["names · why now · film angle", "urgency · cover text · on-topic?", "answer checked, retried once"]],
  ["G3", 4, 5, "ai", null, "Drafts the script", ["hook · sections · [SHOW] notes", "[VERIFY] marks, no made-up facts", "English or Hinglish · 40 a day"]],

  ["S1", 5, 1, "stored", null, "Remembers his niche", ["keywords · region · email", "minimum views", "the settings page reads it back"]],
  ["S2", 5, 3, "stored", null, "Keeps today's videos", ["stats + meaning numbers", "same day + same niche = no refetch", "tidied up after 30 days"]],
  ["S3", 5, 5, "stored", 11, "Saves every brief", ["archive of past weeks", "run log · scripts you edited", "dashboard reads from here"]],

  ["R1", 6, 5, "service", 12, "Emails the brief", ["same layout as the dashboard", "last good copy if a run fails", "free sender → his own inbox"]],
];
BOXES.forEach(([id, lane, col]) => place(id, lane, col));

const edge = {
  right: (id, dy = 0) => [B[id].cx + BW / 2, B[id].cy + dy],
  left: (id, dy = 0) => [B[id].cx - BW / 2, B[id].cy + dy],
  top: (id, dx = 0) => [B[id].cx + dx, B[id].cy - BH / 2],
  bottom: (id, dx = 0) => [B[id].cx + dx, B[id].cy + BH / 2],
};
const L = laneC;

function drawBox([id, , , type, step, title, lines]) {
  const { cx, cy } = B[id];
  const t = TYPES[type];
  const x = cx - BW / 2, y = cy - BH / 2;
  add(`<rect x="${x}" y="${y}" width="${BW}" height="${BH}" rx="12" fill="${t.fill}" stroke="${t.stroke}" stroke-width="2.4"/>`);
  if (step !== null) {
    add(`<circle cx="${x + 2}" cy="${y + 2}" r="13" fill="${BROWN}" stroke="#fff" stroke-width="2"/>`);
    add(`<text x="${x + 2}" y="${y + 7}" font-size="13" font-weight="800" fill="#fff" text-anchor="middle">${step}</text>`);
  }
  add(`<text x="${cx}" y="${y + 27}" font-size="16.5" font-weight="800" fill="${INK}" text-anchor="middle">${esc(title)}</text>`);
  lines.forEach((l, i) => add(`<text x="${cx}" y="${y + 47 + i * 15.5}" font-size="12" fill="${MUTED}" text-anchor="middle">${esc(l)}</text>`));
}

function route(points, o = {}) {
  const { head = true } = o;
  const d = points.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
  add(`<path d="${d}" fill="none" stroke="${BROWN}" stroke-width="2.4" stroke-dasharray="7 6" stroke-linejoin="round"${head ? ' marker-end="url(#ah)"' : ""}/>`);
}
function pill(label, x, y) {
  const w = label.length * 6.6 + 18;
  add(`<rect x="${x - w / 2}" y="${y - 11}" width="${w}" height="22" rx="11" fill="#fff" stroke="${BROWN}" stroke-width="1.4"/>`);
  add(`<text x="${x}" y="${y + 4.5}" font-size="12" fill="${INK}" text-anchor="middle">${esc(label)}</text>`);
}

// ================================================================ draw
add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, Helvetica, sans-serif">`);
add(`<defs><marker id="ah" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto"><path d="M0 0 L12 6 L0 12 z" fill="${BROWN}"/></marker></defs>`);
add(`<rect width="${W}" height="${H}" fill="#eceff8"/>`);

add(`<text x="${W / 2}" y="58" font-size="40" font-weight="800" fill="${INK}" text-anchor="middle">YouTube Trend Radar — Components Map</text>`);
add(`<text x="${W / 2}" y="94" font-size="19" fill="${MUTED}" text-anchor="middle">One Sunday run → live YouTube data → code measures and groups it → AI writes the brief → saved and emailed → Ishaan films the right video</text>`);

add(`<path d="M12 128 a18 18 0 0 1 18 -18 H1970 a18 18 0 0 1 18 18 V156 H12 Z" fill="${BROWN}"/>`);
add(`<text x="134" y="140" font-size="18" font-weight="800" fill="#fff" text-anchor="middle">Actor</text>`);
COLS.forEach((c, i) => add(`<text x="${COL_X[i]}" y="140" font-size="18" font-weight="800" fill="#fff" text-anchor="middle">${c}</text>`));

LANES.forEach((l, i) => {
  const y = LANE_TOP + i * LANE_H;
  add(`<rect x="256" y="${y}" width="1732" height="${LANE_H}" fill="${l.tint}"/>`);
  add(`<rect x="12" y="${y + 2}" width="243" height="${LANE_H - 2}" fill="${BROWN}"/>`);
  add(`<text x="134" y="${y + 60}" font-size="25" font-weight="800" fill="#fff" text-anchor="middle">${esc(l.name)}</text>`);
  add(`<text x="134" y="${y + 84}" font-size="14" fill="#efe6dc" text-anchor="middle">${esc(l.sub)}</text>`);
});

// ---- arrows (drawn before boxes so boxes sit on top of any overlap)
const LABELS = [];
const arrow = (pts, label, at, o) => { route(pts, o); if (label) LABELS.push([label, ...at]); };

// 1  Ishaan saves his niche
arrow([edge.left("I2"), [520, L(0)], [520, L(5)], edge.left("S1")], "saves", [520, L(3) + 24]);
// 2  Cron wakes the app
arrow([edge.bottom("V1"), [B.V1.cx, L(2) - 14], edge.left("A1", -14)], "wakes", [452, L(2) - 14]);
// A  Ishaan taps Generate now
arrow([edge.left("I1"), [266, L(0)], [266, L(2) + 18], edge.left("A1", 18)], "taps", [340, L(2) + 18]);
// 3  checks, then plans
arrow([edge.right("A1", -14), edge.left("A2", -14)]);
// 4  his niche feeds the plan
arrow([edge.right("S1"), [790, L(5)], [790, L(2) + 14], edge.left("A2", 14)], "his niche", [790, L(4) - 6]);
// 5  plan asks YouTube
arrow([edge.bottom("A2"), edge.top("Y1")], "asks", [B.A2.cx, (L(2) + L(3)) / 2]);
// 6  YouTube answers
arrow([edge.right("Y1"), [1050, L(3)], [1050, L(2)], edge.left("A3")], "videos", [1040, L(2) + 62]);
// 7  titles to Gemini
arrow([edge.bottom("A3"), edge.top("G1")], "titles + tags", [B.A3.cx, L(3)]);
// 7b saved
arrow([edge.bottom("G1"), edge.top("S2")], "saved", [B.G1.cx, (L(4) + L(5)) / 2]);
// 8  meanings back to grouping
arrow([edge.right("G1", -14), [1325, L(4) - 14], [1325, L(2) + 14], edge.left("A4", 14)], "meanings", [1325, L(3)]);
// 9  groups to the AI writer
arrow([edge.bottom("A4"), edge.top("G2")], "the topics", [B.A4.cx, L(3)]);
// 10 write-up back to code
arrow([edge.right("G2", -14), [1603, L(4) - 14], [1603, L(2) + 14], edge.left("A5", 14)], "write-up", [1603, L(3)]);
// 11/12 saved and emailed (right margin)
arrow([edge.right("A5"), [1880, L(2)], [1880, L(5) - 14], edge.right("S3", -14)], "saves", [1880, L(4) - 44]);
arrow([[1880, L(5) - 14], [1880, L(6)], edge.right("R1")], "sends", [1880, L(6) - 30]);
// 13 email reaches Ishaan
arrow([edge.left("R1"), [1073, L(6)], [1073, L(0)], edge.left("I3")], "email", [1330, L(6)]);
// 14, 15 Ishaan's chain
arrow([edge.right("I3"), edge.left("I4")], "opens", [1333, L(0)]);
arrow([edge.right("I4"), edge.left("I5")], "then", [1603, L(0)]);
// script request and reply (right margin)
arrow([edge.right("I5", 16), [1915, L(0) + 16], [1915, L(4) + 16], edge.right("G3", 16)], "asks", [1915, L(2) + 20]);
arrow([edge.right("G3", -14), [1952, L(4) - 14], [1952, L(0) - 14], edge.right("I5", -14)], "draft", [1952, L(3) + 20]);

// side job note in the cron lane (a dashed box with no arrows: it runs by itself)
{
  const x = 1085, y = L(1) - 34, w = 496, h = 68;
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${TYPES.service.fill}" stroke="${TYPES.service.stroke}" stroke-width="2.4" stroke-dasharray="6 5"/>`);
  add(`<text x="${x + w / 2}" y="${y + 26}" font-size="16.5" font-weight="800" fill="${INK}" text-anchor="middle">Side job: pings every morning</text>`);
  add(`<text x="${x + w / 2}" y="${y + 47}" font-size="12" fill="${MUTED}" text-anchor="middle">06:00 UTC health check keeps the free database awake (it sleeps after 7 idle days)</text>`);
}

BOXES.forEach(drawBox);
LABELS.forEach(([t, x, y]) => pill(t, x, y));

// ---- how to read it
add(`<text x="${W / 2}" y="1058" font-size="16" font-style="italic" fill="${MUTED}" text-anchor="middle">How to read it: follow the numbers 1 to 15 left to right. The circled A is the optional manual button; dashed arrows show what gets passed on.</text>`);

// ---- legend and footer
const legend = [
  ["Code does the rules", "code"], ["AI does the reasoning", "ai"], ["People decide", "people"],
  ["People shape it", "shape"], ["Connected services", "service"], ["Every step is stored", "stored"],
];
const lw = legend.map((l) => l[0].length * 8.6 + 40);
const total = lw.reduce((a, b) => a + b, 0) + (legend.length - 1) * 16;
let lx = (W - total) / 2;
legend.forEach(([t, k], i) => {
  const c = TYPES[k];
  add(`<rect x="${lx}" y="1076" width="${lw[i]}" height="38" rx="19" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2.4"/>`);
  add(`<text x="${lx + lw[i] / 2}" y="1100" font-size="16" font-weight="600" fill="${INK}" text-anchor="middle">${esc(t)}</text>`);
  lx += lw[i] + 16;
});
add(`<text x="${W / 2}" y="1140" font-size="14" fill="${MUTED}" text-anchor="middle">Stack: Next.js on Vercel · Supabase (Postgres) · Gemini Flash + embeddings · YouTube Data API · Resend · Vercel Cron · all free tiers</text>`);
add(`<text x="${W / 2}" y="1160" font-size="14" fill="${MUTED}" text-anchor="middle">Safety net: every input and AI answer is checked (Zod) · last good brief if a run fails · 307 automated tests · CI on every push · 66-point live smoke test</text>`);
add("</svg>");

const out = nodePath.join(__dirname, "components-map.svg");
fs.writeFileSync(out, svg);
console.log("wrote", out, svg.length, "bytes");
