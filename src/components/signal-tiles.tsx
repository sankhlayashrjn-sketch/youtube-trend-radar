"use client";

import { Heart, Target, Users } from "lucide-react";
import type { Theme } from "@/lib/types";
import { computeInsights, type Insight, type ThemeSignals } from "@/lib/signals";
import { cn } from "@/lib/utils";

const TILE: Record<Insight["key"], { icon: typeof Target; tone: string }> = {
  bestBet: { icon: Target, tone: "from-emerald-500/20 to-emerald-500/5 text-emerald-700 dark:text-emerald-300" },
  crowded: { icon: Users, tone: "from-amber-500/20 to-amber-500/5 text-amber-700 dark:text-amber-300" },
  loved: { icon: Heart, tone: "from-pink-500/20 to-pink-500/5 text-pink-700 dark:text-pink-300" },
};

/** Three quick answers, calculated from this week's numbers. Each one selects the theme it points at. */
export function SignalTiles({ themes, signals, onSelect }: { themes: Theme[]; signals: ThemeSignals[]; onSelect: (i: number) => void }) {
  const insights = computeInsights(themes, signals);
  return (
    <ul aria-label="Signals" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
  );
}
