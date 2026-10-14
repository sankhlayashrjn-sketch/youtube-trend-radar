import { Eye, Users, Zap } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StatBenchmark, StatKey, Verdict } from "@/lib/forecast";

const COPY: Record<StatKey, { title: string; icon: typeof Users; plain: string; good: string; average: string; weak: string; fmt: (n: number) => string }> = {
  creators: {
    title: "Creators covering it",
    icon: Users,
    plain: "How many different channels made videos on this. Fewer means less competition for you.",
    good: "Less crowded than most themes this week",
    average: "About as crowded as other themes",
    weak: "More crowded than most themes this week",
    fmt: (n) => String(Math.round(n)),
  },
  views: {
    title: "Total views",
    icon: Eye,
    plain: "All views across the videos in this theme. Bigger means a bigger audience exists.",
    good: "A bigger audience than most themes",
    average: "An audience similar to other themes",
    weak: "A smaller audience than most themes",
    fmt: fmtNum,
  },
  velocity: {
    title: "Views per hour",
    icon: Zap,
    plain: "How fast these videos gain views right now. Higher means the topic is hot.",
    good: "Growing faster than most themes",
    average: "Growing at a similar pace to other themes",
    weak: "Growing slower than most themes",
    fmt: (n) => `${fmtNum(n)}/hr`,
  },
};

const TONE: Record<Verdict, { chip: string; label: string }> = {
  good: { chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "Good" },
  average: { chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300", label: "Average" },
  weak: { chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300", label: "Weak" },
};

/** Explains each headline number and compares it with the average of this week's other themes. */
export function NumbersGuide({ bench, themeCount }: { bench: Record<StatKey, StatBenchmark>; themeCount: number }) {
  return (
    <section aria-label="What these numbers mean">
      <h4 className="font-heading text-base font-semibold">Is this a good number?</h4>
      <p className="mt-0.5 text-xs text-muted-foreground">Each number is compared with the average of this week&apos;s {themeCount} themes, so you can see where it stands.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {(["creators", "views", "velocity"] as StatKey[]).map((k) => {
          const b = bench[k];
          const c = COPY[k];
          const Icon = c.icon;
          return (
            <li key={k} className="min-w-0 rounded-2xl border bg-card p-3.5" data-stat={k}>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Icon className="size-3.5 text-primary" aria-hidden />{c.title}</p>
              <p className="font-heading mt-1 text-2xl font-semibold tabular-nums">{c.fmt(b.value)}</p>
              <p className="text-xs text-muted-foreground">This week&apos;s average: <span className="font-semibold text-foreground">{c.fmt(b.avg)}</span></p>
              <span className={cn("mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", TONE[b.verdict].chip)}>{TONE[b.verdict].label}</span>
              <p className="mt-1.5 text-xs font-medium">{c[b.verdict]}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.plain}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
