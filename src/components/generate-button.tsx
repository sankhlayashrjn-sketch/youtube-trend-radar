"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  { stage: "fetch", label: "Fetching" },
  { stage: "cluster", label: "Clustering" },
  { stage: "brief", label: "Writing brief" },
] as const;

export function GenerateButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const [current, setCurrent] = useState<number | null>(null); // index of the running step
  const [done, setDone] = useState(false);
  const running = current !== null && !done;

  async function run() {
    setDone(false);
    let runId: number | undefined;
    try {
      for (let i = 0; i < STEPS.length; i++) {
        setCurrent(i);
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stage: STEPS[i].stage, runId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
        runId = data.runId;
      }
      setDone(true);
      toast.success("New brief ready", { description: "Also emailed to your inbox." });
      router.refresh();
      setTimeout(() => setCurrent(null), 2500);
    } catch (e) {
      setCurrent(null);
      toast.error("Couldn't generate a new brief", { description: `${(e as Error).message} Showing the last saved brief.` });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={run} disabled={running} size="lg" variant={variant} className="h-10 w-fit gap-2 px-4 text-sm">
        {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
        {running ? "Generating…" : "Generate now"}
      </Button>
      {current !== null && (
        <ol aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {[...STEPS, { stage: "done", label: "Done" }].map((s, i) => {
            const complete = done || i < current;
            const active = !done && i === current;
            return (
              <li key={s.stage} className={cn("flex items-center gap-1.5", complete || active ? "text-foreground" : "text-muted-foreground")}>
                <span className={cn("grid size-4 place-items-center rounded-full border", complete && "border-emerald-500 bg-emerald-500 text-white", active && "border-primary")}>
                  {complete ? <Check className="size-3" aria-hidden /> : active ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
                </span>
                {s.label}
                {i < STEPS.length && <span aria-hidden className="text-muted-foreground">→</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
