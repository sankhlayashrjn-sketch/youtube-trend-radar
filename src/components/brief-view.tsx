"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Flame, Clock3, LayoutGrid, SkipForward } from "lucide-react";
import type { Brief, Theme } from "@/lib/types";
import { fmtNum } from "@/lib/format";
import { computeSignals } from "@/lib/signals";
import { cn } from "@/lib/utils";
import { ThemeCard } from "@/components/theme-card";
import { SignalsPanel } from "@/components/signals-panel";

type Filter = "all" | Theme["urgency"]["level"];
type Sort = "rank" | "opportunity" | "momentum" | "views";
type Item = { t: Theme; i: number };

const FILTERS: { key: Filter; label: string; icon: typeof Flame }[] = [
  { key: "all", label: "All themes", icon: LayoutGrid },
  { key: "film_now", label: "Film now", icon: Flame },
  { key: "soon", label: "Soon", icon: Clock3 },
  { key: "skip", label: "Skip", icon: SkipForward },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: "rank", label: "Brief order" },
  { key: "opportunity", label: "Opportunity" },
  { key: "momentum", label: "Momentum" },
  { key: "views", label: "Total views" },
];

export function BriefView({ brief, minViews = 0 }: { brief: Brief; minViews?: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("rank");
  const [flash, setFlash] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signals = useMemo(() => computeSignals(brief.themes), [brief.themes]);

  const visible = useMemo(() => {
    const items: Item[] = brief.themes.map((t, i) => ({ t, i }));
    const filtered = filter === "all" ? items : items.filter((x) => x.t.urgency.level === filter);
    const score: Record<Sort, (x: Item) => number> = {
      rank: (x) => -x.i,
      opportunity: (x) => signals[x.i].opportunity,
      momentum: (x) => signals[x.i].momentum,
      views: (x) => x.t.stats.totalViews,
    };
    return [...filtered].sort((a, b) => score[sort](b) - score[sort](a));
  }, [brief.themes, filter, sort, signals]);

  const select = useCallback((i: number) => {
    setFilter("all");
    setFlash(i);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), 1400);
    // wait a frame so the card exists if a filter was hiding it
    requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(`theme-${i + 1}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    });
  }, []);

  const count = (k: Filter) => (k === "all" ? brief.themes.length : brief.themes.filter((t) => t.urgency.level === k).length);

  return (
    <div className="space-y-10">
      <section aria-labelledby="headline" className="relative overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white shadow-xl sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-red-600/50 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 size-64 rounded-full bg-red-900/40 blur-3xl" />
        <svg aria-hidden viewBox="0 0 32 24" className="pointer-events-none absolute -right-6 bottom-0 h-44 w-60 opacity-[0.07] sm:h-56 sm:w-72"><path d="M12 5v14l12-7z" fill="#fff" /></svg>
        <p id="headline" className="relative inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-red-200">
          <span className="live-dot size-2 rounded-full bg-red-500 text-red-500" aria-hidden /> This week in 3 lines · {brief.weekOf}
        </p>
        <ol className="relative mt-5 space-y-4">
          {brief.headline.map((line, i) => (
            <li key={i} className="pop-in font-heading flex items-start gap-3 text-xl font-semibold leading-snug sm:text-2xl" style={{ animationDelay: `${i * 120}ms` }}>
              <span aria-hidden className="mt-1.5 grid h-5 w-7 shrink-0 place-items-center rounded-md bg-[#ff0000] text-[9px] text-white">▶</span>
              {line}
            </li>
          ))}
        </ol>
        <p className="relative mt-6 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full bg-white/10 px-3 py-1">{brief.meta.videoCount} videos analysed</span>
          <span className="rounded-full bg-white/10 px-3 py-1">{brief.themes.length} multi-creator themes</span>
          <span className="rounded-full bg-white/10 px-3 py-1">source: {brief.meta.dataSource}</span>
        </p>
      </section>

      <SignalsPanel themes={brief.themes} signals={signals} onSelect={select} />

      <section aria-labelledby="themes-h" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="themes-h" className="font-heading text-2xl font-semibold">Themes</h2>
            {minViews > 0 && (
              <p className="text-sm text-muted-foreground">
                Example videos limited to <span className="font-semibold text-foreground">{fmtNum(minViews)}+ views</span>. Change in Settings.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div role="group" aria-label="Filter by urgency" className="flex flex-wrap gap-2">
              {FILTERS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transform-none",
                    filter === key ? "border-primary bg-primary text-primary-foreground shadow-md" : "bg-card hover:bg-secondary",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden /> {label}
                  <span className={cn("rounded-full px-1.5 text-xs", filter === key ? "bg-white/25" : "bg-muted")}>{count(key)}</span>
                </button>
              ))}
            </div>
            <div role="group" aria-label="Sort themes" className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Sort</span>
              {SORTS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={sort === key}
                  onClick={() => setSort(key)}
                  className={cn("rounded-full px-2.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", sort === key ? "bg-foreground text-background" : "bg-muted hover:bg-secondary")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No themes in this group this week.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {visible.map(({ t, i }) => (
              <ThemeCard key={t.name} theme={t} rank={i + 1} minViews={minViews} signals={signals[i]} flash={flash === i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
