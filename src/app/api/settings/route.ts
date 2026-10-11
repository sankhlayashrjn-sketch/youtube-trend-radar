import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/repo";
import { settingsSchema } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getSettings());
  } catch {
    return NextResponse.json({ error: "Could not load settings" }, { status: 503 });
  }
}

export async function PUT(req: Request) {
  const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }
  const clean = { ...parsed.data, categories: [...new Set(parsed.data.categories.map((c) => c.trim()))] };
  await saveSettings(clean);
  return NextResponse.json(clean);
}
