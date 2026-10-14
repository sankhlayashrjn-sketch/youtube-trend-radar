import { Check } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UrgencyBadge } from "@/components/urgency-badge";
import type { Theme } from "@/lib/types";
import { fmtINR, forecastViews, incomeFromViews } from "@/lib/forecast";

/** One line in the "Choose what to film" list: enough to compare themes, nothing more. */
export function ThemeRow({
  theme, rank, selected, best, rpm, onSelect,
}: { theme: Theme; rank: number; selected: boolean; best: boolean; rpm: number; onSelect: () => void }) {
  const f = forecastViews(theme);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border bg-card p-4 text-left shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transform-none",
        selected && "border-primary ring-2 ring-primary/25",
      )}
    >
      <span className="flex items-start gap-3">
        <span aria-hidden className={cn("font-heading grid size-8 shrink-0 place-items-center rounded-xl text-sm font-bold", selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
          {selected ? <Check className="size-4" /> : rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-heading text-base font-semibold leading-snug">{theme.name}</span>
            {best && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">Best bet</span>}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {theme.stats.creatorCount} creators · {fmtNum(theme.stats.totalViews)} views · {fmtNum(theme.stats.avgVelocity)}/hr
          </span>
        </span>
        <UrgencyBadge level={theme.urgency.level} />
      </span>
      <span className="mt-3 flex items-baseline justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-xs" data-testid="row-income">
        <span className="text-muted-foreground">Expected <span className="font-semibold text-foreground">{fmtNum(f.expected)} views</span></span>
        <span className="text-right"><span className="text-muted-foreground">Rough income </span><span className="font-heading text-sm font-bold text-foreground">{fmtINR(incomeFromViews(f.expected, rpm))}</span></span>
      </span>
    </button>
  );
}
