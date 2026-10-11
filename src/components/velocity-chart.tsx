"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Theme } from "@/lib/types";
import { fmtNum } from "@/lib/format";

const COLORS: Record<Theme["urgency"]["level"], string> = {
  film_now: "var(--color-emerald, #10b981)",
  soon: "#f59e0b",
  skip: "#a1a1aa",
};

export function VelocityChart({ themes }: { themes: Theme[] }) {
  const data = themes.map((t) => ({
    name: t.name.length > 26 ? t.name.slice(0, 25) + "…" : t.name,
    full: t.name,
    velocity: t.stats.avgVelocity,
    level: t.urgency.level,
  }));
  return (
    <figure className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <figcaption className="mb-4">
        <h3 className="font-heading text-lg font-semibold">Momentum by theme</h3>
        <p className="text-sm text-muted-foreground">Average views per hour since upload. Colour shows the filming urgency.</p>
      </figcaption>
      <div className="h-64 w-full" role="img" aria-label={`Bar chart of average views per hour: ${data.map((d) => `${d.full} ${fmtNum(d.velocity)}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
            <XAxis type="number" tickFormatter={fmtNum} tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" opacity={0.6} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: "currentColor" }} stroke="currentColor" />
            <Tooltip
              cursor={{ fill: "currentColor", opacity: 0.06 }}
              formatter={(v) => [`${fmtNum(Number(v))} views/hr`, "Velocity"]}
              labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""}
              contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--card-foreground)" }}
            />
            <Bar dataKey="velocity" radius={[0, 8, 8, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.level === "film_now" ? "#10b981" : COLORS[d.level]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
