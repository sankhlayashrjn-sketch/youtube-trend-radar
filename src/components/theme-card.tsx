import { ExternalLink, Flame, Clock3, Timer, Users, Eye, Zap, ChevronDown, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum, timeAgo } from "@/lib/format";
import type { Theme } from "@/lib/types";

const URGENCY = {
  film_now: { label: "Film now", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300", icon: Flame },
  soon: { label: "Soon", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", icon: Clock3 },
  skip: { label: "Skip", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300", icon: Clock3 },
} as const;

const SAT_LEVEL = { low: 1, medium: 2, high: 3 } as const;

function Chip({ icon: Icon, children, label }: { icon: typeof Users; children: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium" title={label}>
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="sr-only">{label}: </span>
      {children}
    </span>
  );
}

export function SaturationMeter({ level }: { level: Theme["saturation"] }) {
  const n = SAT_LEVEL[level];
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" role="img" aria-label={`Saturation: ${level}`}>
      <span>Saturation</span>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 w-6 rounded-full", i <= n ? (n === 3 ? "bg-rose-500" : n === 2 ? "bg-amber-500" : "bg-emerald-500") : "bg-muted")} />
        ))}
      </div>
      <span className="font-medium capitalize text-foreground">{level}</span>
    </div>
  );
}

export function ThemeCard({ theme, rank, minViews = 0 }: { theme: Theme; rank: number; minViews?: number }) {
  const u = URGENCY[theme.urgency.level];
  const examples = theme.exampleVideos.filter((v) => v.views >= minViews);
  const UIcon = u.icon;
  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6" aria-labelledby={`theme-${rank}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Theme {rank}</p>
          <h3 id={`theme-${rank}`} className="font-heading mt-1 text-xl font-semibold leading-snug">{theme.name}</h3>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", u.cls)}>
          <UIcon className="size-3.5" aria-hidden />
          {u.label}
        </span>
      </header>

      <p className="text-sm leading-relaxed text-muted-foreground">{theme.summary}</p>

      <div className="flex flex-wrap gap-2">
        <Chip icon={Users} label="Creators">{theme.stats.creatorCount} creators</Chip>
        <Chip icon={Eye} label="Total views">{fmtNum(theme.stats.totalViews)} views</Chip>
        <Chip icon={Zap} label="Velocity">{fmtNum(theme.stats.avgVelocity)}/hr</Chip>
        <Chip icon={Timer} label="Typical length">~{Math.round(theme.typicalLengthMinutes)} min</Chip>
      </div>

      <p className="text-sm leading-relaxed"><span className="font-semibold">Why now: </span>{theme.whyNow}</p>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Winning format</dt>
          <dd className="mt-0.5 font-medium">{theme.winningFormat}</dd>
        </div>
        <div className="flex items-end"><SaturationMeter level={theme.saturation} /></div>
      </dl>

      <div className="rounded-xl border-l-4 border-primary bg-primary/10 p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Lightbulb className="size-3.5" aria-hidden /> Film this
        </p>
        <p className="mt-1 font-heading text-base font-semibold leading-snug">{theme.filmingAngle.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/80">{theme.filmingAngle.angle}</p>
        <p className="mt-2 text-xs text-muted-foreground">{theme.urgency.reason}</p>
      </div>

      <details className="group rounded-lg border">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-lg">
          Example videos ({examples.length}{minViews > 0 ? ` of ${theme.exampleVideos.length}` : ""})
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        {examples.length === 0 && <p className="border-t px-4 py-3 text-sm text-muted-foreground">No example videos above {fmtNum(minViews)} views.</p>}
        <ul className="divide-y border-t">
          {examples.map((v) => (
            <li key={v.id}>
              <a href={v.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                <span>
                  <span className="line-clamp-2 font-medium">{v.title}</span>
                  <span className="text-xs text-muted-foreground">{v.channel} · {fmtNum(v.views)} views{v.publishedAt && <span suppressHydrationWarning> · posted {timeAgo(v.publishedAt)}</span>}</span>
                </span>
                <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-label="Opens on YouTube" />
              </a>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
