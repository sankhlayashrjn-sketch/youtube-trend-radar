"use client";

import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { Theme } from "@/lib/types";
import { median, type ThemeSignals } from "@/lib/signals";
import { fmtNum } from "@/lib/format";

const LEVEL_COLOR = { film_now: "#10b981", soon: "#f59e0b", skip: "#a1a1aa" } as const;

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

/** Bubble chart: competition (creators) across, momentum (views per hour) up. Click a bubble to pick that theme. */
export function OpportunityMap({ themes, signals, onSelect }: { themes: Theme[]; signals: ThemeSignals[]; onSelect: (i: number) => void }) {
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
    <figure className="p-4 sm:p-6">
      <figcaption className="mb-3 text-sm text-muted-foreground">
        Left and up is the sweet spot: fast growing with few creators. Bubble size is total views, colour is filming urgency. Click a bubble to pick that theme.
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
    </figure>
  );
}
