import { NextResponse } from "next/server";
import { z } from "zod";
import { RateLimitError, runStage, startRun, STAGES } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const body = z.object({
  stage: z.enum(["fetch", "cluster", "brief"]),
  runId: z.number().int().positive().optional(),
});

/**
 * Manual generation, one stage per call so the UI can show progress and a timeout never loses work.
 * Starting a run (stage "fetch" without runId) is rate limited to protect the YouTube quota.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { stage } = parsed.data;
  try {
    let runId = parsed.data.runId;
    if (!runId) {
      if (stage !== STAGES[0]) return NextResponse.json({ error: "runId required" }, { status: 400 });
      runId = await startRun({ manual: true });
    }
    const result = (await runStage(runId, stage)) as Record<string, unknown>;
    // Do not return the whole brief from the generate call; the UI reloads /api/brief/latest.
    const { brief: _brief, ...rest } = result;
    void _brief;
    return NextResponse.json({ runId, stage, ...rest });
  } catch (e) {
    const status = e instanceof RateLimitError ? 429 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
