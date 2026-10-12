export const fmtNum = (n: number) =>
  n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n));

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/** "today", "3 days ago", "2 weeks ago" */
export function timeAgo(iso?: string, now = Date.now()): string {
  if (!iso) return "";
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

/** Slider stops for the minimum-views filter: 0 to 20M. Non-linear so low and high ranges are both usable. */
export const VIEW_STEPS = [0, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 20_000_000];

/** 754 -> "12:34", 3725 -> "1:02:05" */
export function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** "8 Oct 2026" in IST */
export const fmtDay = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "";

export const fmtPct = (n?: number) => (n === undefined ? "" : `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`);
