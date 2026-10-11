import { Radar } from "lucide-react";
import { GenerateButton } from "@/components/generate-button";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Radar className="size-7" aria-hidden /></span>
      <h2 className="font-heading text-2xl font-semibold">No brief yet</h2>
      <p className="max-w-md text-sm text-muted-foreground">Generate your first one. It reads this week&apos;s YouTube, groups what multiple creators are covering, and tells you what to film.</p>
      <GenerateButton />
    </div>
  );
}
