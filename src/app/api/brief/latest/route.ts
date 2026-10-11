import { NextResponse } from "next/server";
import { getLatest } from "@/lib/latest";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getLatest());
}
