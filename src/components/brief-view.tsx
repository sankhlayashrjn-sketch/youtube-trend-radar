import type { Brief } from "@/lib/types";
import { fmtNum } from "@/lib/format";
import { ThemeCard } from "@/components/theme-card";
import { VelocityChart } from "@/components/velocity-chart";

export function BriefView({ brief, minViews = 0 }: { brief: Brief; minViews?: number }) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="headline" className="relative overflow-hidden rounded-3xl bg-zinc-900 p-6 text-white shadow-lg sm:p-10 dark:bg-card dark:ring-1 dark:ring-border">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/40 blur-3xl" />
        <p id="headline" className="relative text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
          This week in 3 lines · week of {brief.weekOf}
        </p>
        <ol className="relative mt-5 space-y-3">
          {brief.headline.map((line, i) => (
            <li key={i} className="font-heading flex gap-4 text-xl font-medium leading-snug sm:text-2xl">
              <span aria-hidden className="mt-1 text-base font-semibold text-indigo-300">0{i + 1}</span>
              {line}
            </li>
          ))}
        </ol>
        <p className="relative mt-6 text-xs text-zinc-400">
          {brief.meta.videoCount} videos analysed · {brief.meta.quotaUsed.toLocaleString()} API units · source: {brief.meta.dataSource}
        </p>
      </section>

      <VelocityChart themes={brief.themes} />

      {minViews > 0 && (
        <p className="text-sm text-muted-foreground">
          Example videos are limited to <span className="font-semibold text-foreground">{fmtNum(minViews)}+ views</span>. Change this in Settings.
        </p>
      )}

      <section aria-label="Theme clusters" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {brief.themes.map((t, i) => (
          <ThemeCard key={t.name} theme={t} rank={i + 1} minViews={minViews} />
        ))}
      </section>
    </div>
  );
}
