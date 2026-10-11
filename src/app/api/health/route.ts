import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Lightweight keep-alive: Supabase free projects pause after ~7 days of inactivity. */
export async function GET() {
  try {
    await sql()`select 1`;
    return NextResponse.json({ ok: true, db: "up", at: new Date().toISOString() });
  } catch (e) {
    console.error("[health] db check failed:", (e as Error).message.slice(0, 200));
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
