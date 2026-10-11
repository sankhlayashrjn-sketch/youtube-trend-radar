import { Resend } from "resend";
import { getEnv } from "./env";
import { fmtNum, timeAgo } from "./format";
import type { Brief } from "./types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const URG = {
  film_now: { label: "FILM NOW", bg: "#dcfce7", fg: "#166534" },
  soon: { label: "SOON", bg: "#fef3c7", fg: "#92400e" },
  skip: { label: "SKIP", bg: "#e5e7eb", fg: "#374151" },
} as const;

export function appUrl(): string {
  const host = process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? (host.startsWith("http") ? host : `https://${host}`) : "http://localhost:3000";
}

export function renderEmail(brief: Brief, opts: { stale?: boolean } = {}): { subject: string; html: string } {
  const accent = "#e11d1d";
  const themes = brief.themes
    .map((t) => {
      const u = URG[t.urgency.level];
      const examples = t.exampleVideos
        .map(
          (v) =>
            `<li style="margin:0 0 4px 0;"><a href="${esc(v.url)}" style="color:${accent};text-decoration:none;">${esc(v.title)}</a> <span style="color:#6b7280;">· ${esc(v.channel)} · ${fmtNum(v.views)} views${v.publishedAt ? ` · ${timeAgo(v.publishedAt)}` : ""}</span></li>`,
        )
        .join("");
      return `
<tr><td style="padding:0 0 16px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
<tr><td style="padding:20px;">
  <span style="display:inline-block;background:${u.bg};color:${u.fg};font-size:11px;font-weight:700;letter-spacing:.06em;padding:3px 10px;border-radius:999px;">${u.label}</span>
  <span style="display:inline-block;color:#6b7280;font-size:11px;margin-left:8px;">Saturation: ${esc(t.saturation)}</span>
  <h2 style="margin:10px 0 6px 0;font-size:20px;line-height:1.25;color:#111827;">${esc(t.name)}</h2>
  <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;color:#374151;">${esc(t.summary)}</p>
  <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;color:#374151;"><strong>Why now:</strong> ${esc(t.whyNow)}</p>
  <p style="margin:0 0 12px 0;font-size:13px;color:#4b5563;">
    <strong>${t.stats.creatorCount}</strong> creators · <strong>${fmtNum(t.stats.totalViews)}</strong> views · <strong>${fmtNum(t.stats.avgVelocity)}</strong>/hr · ~<strong>${t.typicalLengthMinutes.toFixed(0)} min</strong> · ${esc(t.winningFormat)}
  </p>
  <div style="background:#fef2f2;border-left:4px solid ${accent};border-radius:8px;padding:12px 14px;margin:0 0 12px 0;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:${accent};">FILM THIS</div>
    <div style="font-size:15px;font-weight:600;color:#111827;margin:2px 0;">${esc(t.filmingAngle.title)}</div>
    <div style="font-size:14px;color:#374151;line-height:1.45;">${esc(t.filmingAngle.angle)}</div>
    <div style="font-size:12px;color:#6b7280;margin-top:6px;">${esc(t.urgency.reason)}</div>
  </div>
  <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.45;color:#374151;">${examples}</ul>
</td></tr></table>
</td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
<tr><td style="padding:0 0 16px 0;">
  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:${accent};">YOUTUBE TREND RADAR · WEEK OF ${esc(brief.weekOf)}</div>
  ${opts.stale ? `<div style="margin-top:8px;background:#fef3c7;color:#92400e;font-size:13px;padding:8px 12px;border-radius:8px;">Showing the last saved brief: today's refresh failed.</div>` : ""}
</td></tr>
<tr><td style="padding:0 0 16px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:12px;"><tr><td style="padding:22px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#fca5a5;margin-bottom:8px;">THIS WEEK IN 3 LINES</div>
    ${brief.headline.map((l) => `<div style="font-size:17px;line-height:1.4;color:#ffffff;margin:0 0 6px 0;">${esc(l)}</div>`).join("")}
  </td></tr></table>
</td></tr>
${themes}
<tr><td style="padding:8px 0 0 0;text-align:center;font-size:12px;color:#6b7280;">
  ${brief.meta.videoCount} videos analysed · source: ${brief.meta.dataSource}<br>
  <a href="${esc(appUrl())}" style="color:${accent};">Open the dashboard</a>
</td></tr>
</table></td></tr></table></body></html>`;

  return { subject: `Trend Radar: ${brief.themes[0]?.name ?? "this week's brief"} + ${Math.max(brief.themes.length - 1, 0)} more themes`, html };
}

export async function sendBriefEmail(brief: Brief, to: string, opts: { stale?: boolean } = {}): Promise<string> {
  const env = getEnv();
  const { subject, html } = renderEmail(brief, opts);
  const res = await new Resend(env.RESEND_API_KEY).emails.send({ from: env.EMAIL_FROM, to, subject, html });
  if (res.error) throw new Error(`Resend: ${res.error.message}`);
  return res.data?.id ?? "";
}
