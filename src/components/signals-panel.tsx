"use client";

import { Heart, Rocket, Target, Users } from "lucide-react";
import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { Theme } from "@/lib/types";
import { computeInsights, median, type Insight, type ThemeSignals } from "@/lib/signals";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

const LEVEL_COLOR = { film_now: "#10b981", soon: "#f59e0b", skip: "#a1a1aa" } as const;

const TILE: Record<Insight["key"], { icon: typeof Target; tone: string }> = {
  bestBet: { icon: Target, tone: "from-emerald-500/20 to-emerald-500/5 text-emerald-700 dark:text-emerald-300" },
  fastest: { icon: Rocket, tone: "from-red-500/20 to-red-500/5 text-red-700 dark:text-red-300" },
  crowded: { icon: Users, tone: "from-amber-500/20 to-amber-500/5 text-amber-700 dark:text-amber-300" },
  loved: { icon: Heart, tone: "from-pink-500/20 to-pink-500/5 text-pink-700 dark:text-pink-300" },
};

type Dot = { x: number; y: number; r: number; i: number; name: string; level: Theme["urgency"]["level"]; opp: number };
type DotProps = { cx?: number; cy?: number; payload?: Dot };

function Bubble({ cx = 0, cy = 0, payload, onSelect }: DotProps & { onSelect: (i: number) => void }) {
  if (!payload) return <g />;
  const color = LEVEL_COLOR[payload.level];
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Theme ${payload.i + 1}: ${payload.name}`}
      className="cursor-pointer outline-none transition-transform hover:scale-110 focus-visible:scale-110"
      style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: "fill-box" }}
      onClick={() => onSelect(payload.i)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(payload.i)}
    >
      <circle cx={cx} cy={cy} r={payload.r} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={2} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill="currentColor">
        {payload.i + 1}
      </text>
    </g>
  );
}

export function SignalsPanel({ themes, signals, onSelect }: { themes: Theme[]; signals: ThemeSignals[]; onSelect: (i: number) => void }) {
  const insights = computeInsights(themes, signals);
  const maxViews = Math.max(...themes.map((t) => t.stats.totalViews), 1);
  const data: Dot[] = themes.map((t, i) => ({
    x: t.stats.creatorCount,
    y: t.stats.avgVelocity,
    r: 11 + 15 * Math.sqrt(t.stats.totalViews / maxViews),
    i,
    name: t.name,
    level: t.urgency.level,
    opp: signals[i].opportunity,
  }));
  const medX = median(data.map((d) => d.x));
  const medY = median(data.map((d) => d.y));
  const maxX = Math.max(...data.map((d) => d.x)) * 1.2;
  const maxY = Math.max(...data.map((d) => d.y)) * 1.25;

  return (
    <section aria-labelledby="signals-h" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="signals-h" className="font-heading text-2xl font-semibold">Signals</h2>
          <p className="text-sm text-muted-foreground">Calculated from this week&apos;s numbers. Tap a tile or bubble to jump to the theme.</p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {insights.map((s, n) => {
          const { icon: Icon, tone } = TILE[s.key];
          return (
            <li key={s.key} className="pop-in" style={{ animationDelay: `${n * 70}ms` }}>
              <button
                type="button"
                onClick={() => onSelect(s.themeIndex)}
                className={cn("group h-full w-full rounded-2xl border bg-gradient-to-br p-4 text-left transition-all hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transform-none", tone)}
              >
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                  <Icon className="size-4 transition-transform group-hover:scale-125 group-hover:-rotate-12" aria-hidden /> {s.label}
                </span>
                <span className="font-heading mt-2 line-clamp-2 block text-base font-semibold leading-snug text-foreground">{themes[s.themeIndex].name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{s.detail}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <figure className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <figcaption className="mb-3">
          <h3 className="font-heading text-lg font-semibold">Opportunity map</h3>
          <p className="text-sm text-muted-foreground">
            Left and up is the sweet spot: fast growing with few creators. Bubble size is total views, colour is filming urgency.
          </p>
        </figcaption>
        <div className="h-72 w-full sm:h-80" role="img" aria-label={`Opportunity map. ${themes.map((t, i) => `${i + 1}: ${t.name}, ${t.stats.creatorCount} creators, ${fmtNum(t.stats.avgVelocity)} views per hour`).join("; ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
              <ReferenceArea x1={0} x2={medX} y1={medY} y2={maxY} fill="#10b981" fillOpacity={0.08} label={{ value: "Sweet spot", position: "insideTopLeft", fill: "#059669", fontSize: 12, fontWeight: 700 }} />
              <ReferenceArea x1={medX} x2={maxX} y1={0} y2={medY} fill="#ef4444" fillOpacity={0.05} label={{ value: "Crowded", position: "insideBottomRight", fill: "#dc2626", fontSize: 12, fontWeight: 700 }} />
              <ReferenceLine x={medX} stroke="currentColor" strokeDasharray="4 4" opacity={0.25} />
              <ReferenceLine y={medY} stroke="currentColor" strokeDasharray="4 4" opacity={0.25} />
              <XAxis type="number" dataKey="x" name="Creators" domain={[0, maxX]} tickFormatter={(v) => String(Math.round(v))} tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" label={{ value: "Competition (creators covering it)", position: "insideBottom", offset: -12, fontSize: 12, fill: "currentColor" }} />
              <YAxis type="number" dataKey="y" name="Views/hr" domain={[0, maxY]} tickFormatter={(v) => fmtNum(v)} width={60} tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" label={{ value: "Views per hour", angle: -90, position: "insideLeft", offset: -2, fontSize: 12, fill: "currentColor" }} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  const d = active ? (payload?.[0]?.payload as Dot | undefined) : undefined;
                  if (!d) return null;
                  return (
                    <div className="max-w-60 rounded-xl border bg-card p-3 text-xs shadow-lg">
                      <p className="font-semibold text-foreground">{d.i + 1}. {d.name}</p>
                      <p className="mt-1 text-muted-foreground">{d.x} creators · {fmtNum(d.y)}/hr</p>
                      <p className="text-muted-foreground">Opportunity score <span className="font-bold text-foreground">{d.opp}</span>/100</p>
                    </div>
                  );
                }}
              />
              <Scatter data={data} isAnimationActive shape={(p: unknown) => <Bubble {...(p as DotProps)} onSelect={onSelect} />} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 flex flex-wrap gap-2">
          {themes.map((t, i) => (
            <li key={t.name}>
              <button type="button" onClick={() => onSelect(i)} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="grid size-4 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: LEVEL_COLOR[t.urgency.level] }}>{i + 1}</span>
                <span className="max-w-44 truncate">{t.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </figure>
    </section>
  );
}
