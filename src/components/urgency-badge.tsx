import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Theme } from "@/lib/types";

const URGENCY = {
  film_now: { label: "Film now", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300", live: true },
  soon: { label: "Soon", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", live: false },
  skip: { label: "Skip", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300", live: false },
} as const;

export function UrgencyBadge({ level }: { level: Theme["urgency"]["level"] }) {
  const u = URGENCY[level];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", u.cls)}>
      {u.live ? <span className="live-dot size-2 rounded-full bg-emerald-500 text-emerald-500" aria-hidden /> : level === "soon" ? <Clock3 className="size-3.5" aria-hidden /> : null}
      {u.label}
    </span>
  );
}
