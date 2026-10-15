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
  { name: "Ishaan", sub: "(The creator)", tint: "#e8ecf8" },
  { name: "Sunday Timer", sub: "(Vercel Cron)", tint: "#eee9f6" },
  { name: "Our app", sub: "(Website on Vercel)", tint: "#f1eed4" },
  { name: "YouTube", sub: "(Live video data)", tint: "#f6e7e3" },
  { name: "Gemini AI", sub: "(Understands and writes)", tint: "#f4e4ee" },
  { name: "Database", sub: "(Supabase notebook)", tint: "#e1efe6" },
  { name: "Email", sub: "(Resend)", tint: "#e0eef2" },
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
  ["I1", 0, 0, "people", "A", "Taps Generate now", ["or just waits for Sunday", "at most 4 times an hour", "progress shown step by step"]],
  ["I2", 0, 1, "people", 1, "Sets his niche", ["topics · country · email", "minimum views · ₹ per 1,000 views", "checked before it is saved"]],
  ["I3", 0, 3, "people", 13, "Reads the brief", ["email on Sunday, or dashboard", "3 headlines · 3 signals", "themes with expected ₹ income"]],
  ["I4", 0, 4, "people", 14, "Picks a theme", ["one theme at a time", "why it works · example videos", "expected views and income"]],
  ["I5", 0, 5, "shape", 15, "Makes the video", ["edits the script (auto-saves)", "then designs the cover", "downloads or copies it"]],

  ["V1", 1, 0, "service", 2, "Wakes up on Sunday", ["4:30 AM India time", "proves it is allowed (secret key)", "ignores a double alarm"]],

  ["A1", 2, 1, "code", 3, "Checks the request", ["secret key · 4 runs an hour", "right order, right step only", "bad input is turned away"]],
  ["A2", 2, 2, "code", 4, "Plans the search", ["reads his niche + today's saved data", "popular videos + up to 10 searches", "stays inside the free limit"]],
  ["A3", 2, 3, "code", 6, "Measures every video", ["views per hour · likes ratio", "length · how many creators", "drops Shorts and old videos"]],
  ["A4", 2, 4, "code", 8, "Groups by topic", ["puts similar videos together", "a trend needs 3+ creators", "one channel can't fake a trend"]],
  ["A5", 2, 5, "code", 10, "Builds the brief", ["adds the real numbers back", "checks every video link", "works out views and income"]],

  ["Y1", 3, 2, "service", 5, "Supplies live videos", ["search · popular · details", "uses about 800 of 10,000 free units", "gives up after 20 seconds"]],

  ["G1", 4, 3, "ai", 7, "Understands the titles", ["turns each title into meaning", "so similar topics sit together", "waits and retries if busy"]],
  ["G2", 4, 4, "ai", 9, "Writes the brief", ["theme names · why now", "what to film · how urgent", "answer checked, retried once"]],
  ["G3", 4, 5, "ai", null, "Drafts the script", ["hook · sections · visual notes", "marks facts to double-check", "English or Hinglish · 40 a day"]],

  ["S1", 5, 1, "stored", null, "Remembers his niche", ["topics · country · email", "minimum views · ₹ per 1,000", "the settings page shows it back"]],
  ["S2", 5, 3, "stored", null, "Keeps today's videos", ["stats and meanings saved", "same day + same niche = no refetch", "cleared after 30 days"]],
  ["S3", 5, 5, "stored", 11, "Saves every brief", ["archive of past weeks", "run log · scripts you edited", "dashboard reads from here"]],

  ["R1", 6, 5, "service", 12, "Emails the brief", ["same layout as the dashboard", "last good copy if a run fails", "sent to his own inbox"]],
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
add(`<text x="${W / 2}" y="94" font-size="19" fill="${MUTED}" text-anchor="middle">Every Sunday: get live YouTube videos → measure and group them → AI writes the brief → save it and email it → Ishaan plans the right video</text>`);

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
  add(`<text x="${x + w / 2}" y="${y + 26}" font-size="16.5" font-weight="800" fill="${INK}" text-anchor="middle">Side job: a daily wake-up call</text>`);
  add(`<text x="${x + w / 2}" y="${y + 47}" font-size="12" fill="${MUTED}" text-anchor="middle">A quick check every morning keeps the free database awake (it sleeps after 7 idle days)</text>`);
}

BOXES.forEach(drawBox);
LABELS.forEach(([t, x, y]) => pill(t, x, y));

// ---- how to read it
add(`<text x="${W / 2}" y="1058" font-size="16" font-style="italic" fill="${MUTED}" text-anchor="middle">How to read it: follow the numbers 1 to 15 left to right. The circled A is the optional manual button; dashed arrows show what gets passed on.</text>`);

// ---- legend and footer
const legend = [
  ["Plain code (the rules)", "code"], ["AI (understands and writes)", "ai"], ["People decide", "people"],
  ["People shape it", "shape"], ["Outside services", "service"], ["Saved in the database", "stored"],
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
add(`<text x="${W / 2}" y="1140" font-size="14" fill="${MUTED}" text-anchor="middle">Built with: Vercel (hosting + timer) · Supabase (database) · Gemini Flash (AI) · YouTube Data API (videos) · Resend (email) · all free plans</text>`);
add(`<text x="${W / 2}" y="1160" font-size="14" fill="${MUTED}" text-anchor="middle">Safety: every input and AI answer is checked · the last good brief is kept if a run fails · 369 automatic tests · tested on every code change · 70-point check on the live site</text>`);
add("</svg>");

const out = nodePath.join(__dirname, "components-map.svg");
fs.writeFileSync(out, svg);
console.log("wrote", out, svg.length, "bytes");
