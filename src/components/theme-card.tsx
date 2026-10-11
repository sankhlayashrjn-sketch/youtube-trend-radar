import { Eye, Clock3, Lightbulb, Play, Timer, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum, timeAgo } from "@/lib/format";
import type { Theme } from "@/lib/types";
import type { ThemeSignals } from "@/lib/signals";

const URGENCY = {
  film_now: { label: "Film now", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500 text-emerald-500", live: true },
  soon: { label: "Soon", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500", live: false },
  skip: { label: "Skip", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300", dot: "bg-zinc-400", live: false },
} as const;

const SAT_LEVEL = { low: 1, medium: 2, high: 3 } as const;

function Chip({ icon: Icon, children, label }: { icon: typeof Users; children: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary" title={label}>
      <Icon className="size-3.5 text-primary" aria-hidden />
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

function Meter({ label, value, color, hint }: { label: string; value: number; color: string; hint: string }) {
  return (
    <div title={hint}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className={cn("meter-fill h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ThemeCard({
  theme, rank, minViews = 0, signals, flash = false,
}: { theme: Theme; rank: number; minViews?: number; signals: ThemeSignals; flash?: boolean }) {
  const u = URGENCY[theme.urgency.level];
  const examples = theme.exampleVideos.filter((v) => v.views >= minViews);
  const mins = Math.max(1, Math.round(theme.typicalLengthMinutes));
  const compColor = signals.competition > 66 ? "bg-rose-500" : signals.competition > 33 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <article
      id={`theme-${rank}`}
      aria-labelledby={`theme-title-${rank}`}
      className={cn(
        "pop-in flex min-w-0 scroll-mt-24 flex-col gap-5 rounded-3xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none sm:p-6",
        flash && "flash-ring border-primary",
      )}
    >
      <header className="flex items-start gap-3">
        <span className="font-heading grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">{rank}</span>
        <div className="min-w-0 flex-1">
          <h3 id={`theme-title-${rank}`} className="font-heading text-xl font-semibold leading-snug">{theme.name}</h3>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", u.cls)}>
          {u.live ? <span className={cn("live-dot size-2 rounded-full", u.dot)} aria-hidden /> : theme.urgency.level === "soon" ? <Clock3 className="size-3.5" aria-hidden /> : null}
          {u.label}
        </span>
      </header>

      <p className="text-sm leading-relaxed text-muted-foreground">{theme.summary}</p>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          What&apos;s working {minViews > 0 && <span className="font-medium normal-case">· {examples.length} of {theme.exampleVideos.length} above {fmtNum(minViews)} views</span>}
        </p>
        {examples.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No example videos above {fmtNum(minViews)} views. Lower the minimum in Settings.</p>
        ) : (
          <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2" aria-label="Example videos">
            {examples.map((v) => (
              <li key={v.id} className="w-44 shrink-0 snap-start">
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="group/v block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
                  <span className="relative block aspect-video overflow-hidden rounded-xl bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover/v:scale-110 motion-reduce:transform-none" />
                    <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover/v:bg-black/30">
                      <span className="grid h-7 w-10 scale-75 place-items-center rounded-lg bg-[#ff0000] opacity-0 shadow-lg transition-all group-hover/v:scale-100 group-hover/v:opacity-100 group-focus-visible/v:scale-100 group-focus-visible/v:opacity-100">
                        <Play className="size-3.5 fill-white text-white" aria-hidden />
                      </span>
                    </span>
                    <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{fmtNum(v.views)} views</span>
                  </span>
                  <span className="mt-2 line-clamp-2 block text-[13px] font-semibold leading-snug group-hover/v:text-primary">{v.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {v.channel}
                    {v.publishedAt && <span suppressHydrationWarning> · {timeAgo(v.publishedAt)}</span>}
                  </span>
                  <span className="sr-only">Opens on YouTube</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-2xl bg-muted/50 p-4">
        <Meter label="Momentum" value={signals.momentum} color="bg-emerald-500" hint="Views per hour vs the other themes" />
        <Meter label="Competition" value={signals.competition} color={compColor} hint="Creator count vs the other themes (lower is better)" />
        <Meter label="Engagement" value={signals.engagement} color="bg-pink-500" hint="Likes + comments per view vs the other themes" />
        <Meter label="Opportunity" value={signals.opportunity} color="bg-primary" hint="High momentum, low competition, some engagement" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip icon={Users} label="Creators">{theme.stats.creatorCount} creators</Chip>
        <Chip icon={Eye} label="Total views">{fmtNum(theme.stats.totalViews)} views</Chip>
        <Chip icon={Zap} label="Velocity">{fmtNum(theme.stats.avgVelocity)}/hr</Chip>
        <Chip icon={Timer} label="Typical length">~{mins} min</Chip>
      </div>

      <p className="text-sm leading-relaxed"><span className="font-semibold">Why now: </span>{theme.whyNow}</p>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">Winning format</dt>
          <dd className="mt-0.5 font-medium">{theme.winningFormat}</dd>
        </div>
        <div className="flex items-end"><SaturationMeter level={theme.saturation} /></div>
      </dl>

      <div className="overflow-hidden rounded-2xl border border-primary/30 bg-primary/5">
        <p className="flex items-center gap-1.5 px-4 pt-3 text-xs font-bold uppercase tracking-wider text-primary">
          <Lightbulb className="size-3.5" aria-hidden /> Your next video
        </p>
        <div className="relative mx-4 mt-2 grid aspect-video place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-red-600 via-red-700 to-zinc-900 p-4 text-center">
          <div aria-hidden className="absolute -right-6 -top-6 size-28 rounded-full bg-white/10 blur-2xl" />
          <p className="font-heading relative line-clamp-4 text-lg font-bold leading-tight text-white drop-shadow sm:text-xl">{theme.filmingAngle.title}</p>
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{mins}:00</span>
        </div>
        <div className="px-4 pb-4 pt-3">
          <p className="text-sm leading-relaxed text-foreground/85">{theme.filmingAngle.angle}</p>
          <p className="mt-2 text-xs text-muted-foreground">{theme.urgency.reason}</p>
        </div>
      </div>
    </article>
  );
}
