import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runFullPipeline } from "@/lib/pipeline";
import { latestBrief, latestRun, getSettings } from "@/lib/repo";
import { isDuplicateCronDelivery } from "@/lib/run-state";
import { sendBriefEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. Saturday 23:00 UTC = Sunday 04:30 IST. */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // A duplicate delivery of the same cron event must not send a second email. ?force=1 overrides (manual testing).
  if (new URL(req.url).searchParams.get("force") !== "1") {
    const last = await latestRun().catch(() => null);
    if (isDuplicateCronDelivery(last)) return NextResponse.json({ ok: true, skipped: "A run finished less than 30 minutes ago." });
  }

  const res = await runFullPipeline({ manual: false, email: true });
  if (res.error) {
    // Fall back to the last brief: email it flagged as stale so Ishaan still gets something on Sunday.
    let emailed = false;
    try {
      const [stale, s] = await Promise.all([latestBrief(), getSettings()]);
      if (stale && s.email) {
        await sendBriefEmail(stale.brief, s.email, { stale: true });
        emailed = true;
      }
    } catch (e) {
      console.error("[cron] stale email failed:", (e as Error).message.slice(0, 200));
    }
    return NextResponse.json({ ok: false, error: res.error, staleEmailed: emailed }, { status: 500 });
  }
  return NextResponse.json({ ok: true, runId: res.runId, themes: res.brief?.themes.length });
}
