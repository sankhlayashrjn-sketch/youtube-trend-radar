"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ChevronDown, ChevronRight, Clock3, Flame, LayoutGrid, SkipForward } from "lucide-react";
import type { Brief, Theme } from "@/lib/types";
import { computeInsights, computeSignals } from "@/lib/signals";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/section-heading";
import { SignalTiles } from "@/components/signal-tiles";
import { OpportunityMap } from "@/components/opportunity-map";
import { ThemeRow } from "@/components/theme-row";
import { ThemeWorkspace } from "@/components/theme-workspace";

type Filter = "all" | Theme["urgency"]["level"];
type Sort = "rank" | "opportunity" | "momentum" | "views";
type Item = { t: Theme; i: number };

const FILTERS: { key: Filter; label: string; icon: typeof Flame }[] = [
  { key: "all", label: "All", icon: LayoutGrid },
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

const STEPS = [
  { id: "week", n: 1, label: "Read the week" },
  { id: "choose", n: 2, label: "Choose a theme" },
  { id: "plan", n: 3, label: "Plan the video" },
];

export function BriefView({
  brief, minViews = 0, briefId = null, scriptIdx = [],
}: { brief: Brief; minViews?: number; briefId?: string | null; scriptIdx?: number[] }) {
  const signals = useMemo(() => computeSignals(brief.themes), [brief.themes]);
  // The recommended starting point: the theme the "Best bet" signal points at.
  const bestIdx = useMemo(() => computeInsights(brief.themes, signals).find((s) => s.key === "bestBet")?.themeIndex ?? 0, [brief.themes, signals]);

  const [selected, setSelected] = useState(bestIdx);
  // A theme's workspace is built the first time it is picked, then kept (hidden) so cover and script edits survive.
  const [visited, setVisited] = useState<number[]>([bestIdx]);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("rank");
  const [mapOpen, setMapOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /** Pick a theme and take the user straight to its workspace. */
  const select = useCallback((i: number) => {
    setSelected(i);
    setVisited((v) => (v.includes(i) ? v : [...v, i]));
    setFlash(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(false), 1400);
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
    raf(() => {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("plan")?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  }, []);

  const count = (k: Filter) => (k === "all" ? brief.themes.length : brief.themes.filter((t) => t.urgency.level === k).length);

  return (
    <div className="space-y-14">
      <nav aria-label="Dashboard steps" className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
        {STEPS.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1">
            <a href={`#${s.id}`} className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span aria-hidden className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{s.n}</span>
              {s.label}
            </a>
            {i < STEPS.length - 1 && <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
          </span>
        ))}
      </nav>

      {/* ---- Step 1 ---------------------------------------------------------------- */}
      <section id="week" aria-labelledby="week-h" className="scroll-mt-20 space-y-4">
        <SectionHeading step={1} id="week-h" title="Read the week" hint={`What is happening on YouTube in your niche. Week of ${brief.weekOf}.`} />
        <div className="relative overflow-hidden rounded-3xl bg-zinc-950 p-6 text-white shadow-xl sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-red-600/45 blur-3xl" />
          <ol className="relative space-y-3.5" aria-label="This week in 3 lines">
            {brief.headline.map((line, i) => (
              <li key={i} className="pop-in font-heading flex items-start gap-3 text-xl font-semibold leading-snug sm:text-2xl" style={{ animationDelay: `${i * 120}ms` }}>
                <span aria-hidden className="mt-1.5 grid h-5 w-7 shrink-0 place-items-center rounded-md bg-[#ff0000] text-[9px] text-white">▶</span>
                {line}
              </li>
            ))}
          </ol>
          <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">
              {brief.meta.videoCount} videos analysed · {brief.themes.length} themes · {brief.meta.dataSource} data
            </p>
            <a href="#choose" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 outline-none transition-all hover:gap-3 focus-visible:ring-3 focus-visible:ring-white/60">
              Next: choose what to film <ArrowDown className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      {/* ---- Step 2 ---------------------------------------------------------------- */}
      <section id="choose" aria-labelledby="choose-h" className="scroll-mt-20 space-y-6">
        <SectionHeading step={2} id="choose-h" title="Choose what to film" hint="Three signals point at the strongest themes. Pick one to plan it." />

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Signals</p>
          <SignalTiles themes={brief.themes} signals={signals} onSelect={select} />
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Themes this week</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div role="group" aria-label="Filter by urgency" className="flex flex-wrap gap-1.5">
                {FILTERS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      filter === key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden /> {label}
                    <span className={cn("rounded-full px-1.5", filter === key ? "bg-white/25" : "bg-muted")}>{count(key)}</span>
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No themes in this group this week.</p>
          ) : (
            <ul aria-label="Themes" className="grid gap-3 lg:grid-cols-2">
              {visible.map(({ t, i }) => (
                <li key={t.name} className="min-w-0">
                  <ThemeRow theme={t} rank={i + 1} signals={signals[i]} selected={i === selected} best={i === bestIdx} onSelect={() => select(i)} />
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => select(selected)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground outline-none transition-all hover:gap-3 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Plan &ldquo;{brief.themes[selected].name}&rdquo; <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>

        <div className="rounded-2xl border bg-card">
          <button
            type="button"
            aria-expanded={mapOpen}
            aria-controls="opportunity-map"
            onClick={() => setMapOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>Compare all themes on a map <span className="font-normal text-muted-foreground">(optional)</span></span>
            <ChevronDown className={cn("size-4 transition-transform", mapOpen && "rotate-180")} aria-hidden />
          </button>
          {mapOpen && (
            <div id="opportunity-map" className="border-t">
              <OpportunityMap themes={brief.themes} signals={signals} onSelect={select} />
            </div>
          )}
        </div>
      </section>

      {/* ---- Step 3 ---------------------------------------------------------------- */}
      <section id="plan" aria-labelledby="plan-h" className="scroll-mt-20 space-y-4">
        <SectionHeading step={3} id="plan-h" title="Plan the video" hint="Everything for the theme you picked, in order: why it works, examples, cover, script." />
        {visited.map((i) => (
          <div key={i} hidden={i !== selected}>
            <ThemeWorkspace
              theme={brief.themes[i]}
              index={i}
              total={brief.themes.length}
              allThemes={brief.themes}
              minViews={minViews}
              briefId={briefId}
              hasScript={scriptIdx.includes(i)}
              best={i === bestIdx}
              flash={flash && i === selected}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
