"use client";

import { useRef, useState } from "react";
import { ArrowRight, Eye, FileText, Film, ImageIcon, Lightbulb, Timer, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { deriveCoverText, kickerFor } from "@/lib/cover";
import { VideoCard } from "@/components/video-card";
import { CoverMaker } from "@/components/cover-maker";
import { ScriptEditor } from "@/components/script-editor";
import { UrgencyBadge } from "@/components/urgency-badge";
import type { Theme } from "@/lib/types";
import { ExpectedResults } from "@/components/expected-results";
import { NumbersGuide } from "@/components/numbers-guide";
import { benchmarkTheme, type StatBenchmark, type Verdict } from "@/lib/forecast";

type TabId = "why" | "examples" | "script" | "cover";

const TABS: { id: TabId; label: string; icon: typeof Lightbulb }[] = [
  { id: "why", label: "Why it works", icon: Lightbulb },
  { id: "examples", label: "Examples", icon: Film },
  { id: "script", label: "Script", icon: FileText },
  { id: "cover", label: "Cover", icon: ImageIcon },
];

/** What "Next" means on each tab: the whole workflow is one straight line. */
const NEXT: Record<TabId, { to: TabId; label: string } | null> = {
  why: { to: "examples", label: "See the examples" },
  examples: { to: "script", label: "Draft the script" },
  script: { to: "cover", label: "Design the cover" },
  cover: null,
};

const SAT_LEVEL = { low: 1, medium: 2, high: 3 } as const;

const CHIP_TONE: Record<Verdict, string> = {
  good: "border-emerald-500/40 bg-emerald-500/10",
  average: "border-amber-500/40 bg-amber-500/10",
  weak: "border-rose-500/40 bg-rose-500/10",
};

function Chip({ icon: Icon, children, label, tone, note }: { icon: typeof Users; children: React.ReactNode; label: string; tone?: Verdict; note?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium", tone && CHIP_TONE[tone])} title={note ? `${label}: ${note}` : label}>
      <Icon className="size-3.5 text-primary" aria-hidden />
      <span className="sr-only">{label}: </span>
      {children}
      {note && <span className="font-normal text-muted-foreground">{note}</span>}
    </span>
  );
}

function SaturationMeter({ level }: { level: Theme["saturation"] }) {
  const n = SAT_LEVEL[level];
  return (
    <div className="flex items-center gap-2 text-sm" role="img" aria-label={`Saturation: ${level}`}>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 w-6 rounded-full", i <= n ? (n === 3 ? "bg-rose-500" : n === 2 ? "bg-amber-500" : "bg-emerald-500") : "bg-muted")} />
        ))}
      </div>
      <span className="font-medium capitalize">{level}</span>
    </div>
  );
}

export function ThemeWorkspace({
  theme, index, total, allThemes, rpm, minViews = 0, briefId = null, hasScript = false, best = false, flash = false,
}: {
  theme: Theme; index: number; total: number; allThemes: Theme[]; rpm: number; minViews?: number; briefId?: string | null;
  hasScript?: boolean; best?: boolean; flash?: boolean;
}) {
  const [tab, setTab] = useState<TabId>("why");
  // A tab's content is built the first time it is opened, then kept (hidden) so edits survive switching tabs.
  const [seen, setSeen] = useState<TabId[]>(["why"]);
  const refs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const examples = theme.exampleVideos.filter((v) => v.views >= minViews);
  const mins = Math.max(1, Math.round(theme.typicalLengthMinutes));
  const bench = benchmarkTheme(theme, allThemes);
  const note = (b: StatBenchmark, fmt: (n: number) => string) => `(avg ${fmt(b.avg)})`;
  const pid = (t: TabId) => `ws${index}-panel-${t}`;
  const tid = (t: TabId) => `ws${index}-tab-${t}`;

  function go(t: TabId, focus = false) {
    setTab(t);
    setSeen((s) => (s.includes(t) ? s : [...s, t]));
    if (focus) refs.current[t]?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    const i = TABS.findIndex((x) => x.id === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    go(TABS[next].id, true);
  }

  return (
    <article aria-labelledby={`ws${index}-title`} className={cn("min-w-0 rounded-3xl border bg-card shadow-sm", flash && "flash-ring border-primary")}>
      <header className="space-y-3 border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Theme {index + 1} of {total}{best && <span className="text-primary"> · Best bet</span>}
            </p>
            <h3 id={`ws${index}-title`} className="font-heading mt-1 text-2xl font-semibold leading-snug">{theme.name}</h3>
          </div>
          <UrgencyBadge level={theme.urgency.level} />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{theme.summary}</p>
        <div className="flex flex-wrap gap-2">
          <Chip icon={Users} label="Creators" tone={bench.creators.verdict} note={note(bench.creators, (n) => String(Math.round(n)))}>{theme.stats.creatorCount} creators</Chip>
          <Chip icon={Eye} label="Total views" tone={bench.views.verdict} note={note(bench.views, fmtNum)}>{fmtNum(theme.stats.totalViews)} views</Chip>
          <Chip icon={Zap} label="Velocity" tone={bench.velocity.verdict} note={note(bench.velocity, fmtNum)}>{fmtNum(theme.stats.avgVelocity)}/hr</Chip>
          <Chip icon={Timer} label="Typical length">~{mins} min</Chip>
        </div>
      </header>

      <div role="tablist" aria-label="Plan this video" onKeyDown={onKey} className="flex gap-1 overflow-x-auto border-b px-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              ref={(el) => { refs.current[id] = el; }}
              role="tab"
              id={tid(id)}
              type="button"
              aria-selected={on}
              aria-controls={pid(id)}
              tabIndex={on ? 0 : -1}
              onClick={() => go(id)}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-xl border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                on ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
              {id === "examples" && <span className="rounded-full bg-muted px-1.5 text-xs font-bold text-muted-foreground">{examples.length}</span>}
            </button>
          );
        })}
      </div>

      {TABS.map(({ id }) => {
        if (!seen.includes(id)) return null;
        const next = NEXT[id];
        return (
          <div key={id} role="tabpanel" id={pid(id)} aria-labelledby={tid(id)} hidden={tab !== id} className="p-5 sm:p-6">
            {id === "why" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                    <Lightbulb className="size-3.5" aria-hidden /> Film this
                  </p>
                  <p className="font-heading mt-1.5 text-xl font-semibold leading-snug">{theme.filmingAngle.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/85">{theme.filmingAngle.angle}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{theme.urgency.reason}</p>
                </div>
                <ExpectedResults theme={theme} rpm={rpm} />
                <p className="text-sm leading-relaxed"><span className="font-semibold">Why now: </span>{theme.whyNow}</p>
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Winning format</dt>
                    <dd className="mt-0.5 font-medium">{theme.winningFormat}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Typical length</dt>
                    <dd className="mt-0.5 font-medium">About {mins} minutes</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Saturation</dt>
                    <dd className="mt-1"><SaturationMeter level={theme.saturation} /></dd>
                  </div>
                </dl>
                <NumbersGuide bench={bench} themeCount={allThemes.length} />
              </div>
            )}

            {id === "examples" && (
              <div>
                <p className="mb-3 text-sm text-muted-foreground">
                  The videos behind this theme.{minViews > 0 && <> Showing {examples.length} of {theme.exampleVideos.length} above <span className="font-semibold text-foreground">{fmtNum(minViews)} views</span>. Change this in Settings.</>}
                </p>
                {examples.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No example videos above {fmtNum(minViews)} views. Lower the minimum in Settings.</p>
                ) : (
                  <ul aria-label="Example videos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {examples.map((v) => (
                      <li key={v.id} className="relative min-w-0">
                        <VideoCard v={v} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {id === "cover" && (
              <CoverMaker
                defaultText={theme.cover?.text || deriveCoverText(theme.filmingAngle.title)}
                defaultKicker={kickerFor(theme.winningFormat)}
                exampleTitles={theme.exampleVideos.map((v) => v.title)}
                stats={{ views: fmtNum(theme.stats.totalViews), creators: theme.stats.creatorCount, velocity: `${fmtNum(theme.stats.avgVelocity)}/hr` }}
                filmTitle={theme.filmingAngle.title}
                slug={theme.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}
              />
            )}

            {id === "script" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Draft a first script with Gemini, then edit it here. Changes save automatically.</p>
                <ScriptEditor briefId={briefId} themeIndex={index} hasScript={hasScript} title={theme.filmingAngle.title} defaultOpen />
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              {next ? (
                <>
                  <span className="text-xs text-muted-foreground">Step {TABS.findIndex((t) => t.id === id) + 1} of {TABS.length}</span>
                  <button
                    type="button"
                    onClick={() => go(next.to)}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground outline-none transition-all hover:gap-3 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Next: {next.label} <ArrowRight className="size-4" aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">Step {TABS.length} of {TABS.length}: you&apos;re ready to film.</span>
                  <a href="#choose" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">Done? Choose another theme ↑</a>
                </>
              )}
            </div>
          </div>
        );
      })}
    </article>
  );
}
