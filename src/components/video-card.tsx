import { MessageCircle, Play, ThumbsUp, Zap, Sparkles, Eye, CalendarDays } from "lucide-react";
import { fmtDay, fmtDuration, fmtNum, fmtPct, timeAgo } from "@/lib/format";
import type { Theme } from "@/lib/types";

type Video = Theme["exampleVideos"][number];

function Stat({ icon: Icon, label, value, title }: { icon: typeof Eye; label: string; value: string; title?: string }) {
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
      <dt className="sr-only">{label}</dt>
      <dd className="font-medium tabular-nums" suppressHydrationWarning>{value}</dd>
    </div>
  );
}

/** One example video with the full set of details we have for it. */
export function VideoCard({ v }: { v: Video }) {
  const dur = fmtDuration(v.durationSec);
  return (
    <div className="flex h-full flex-col rounded-2xl border bg-background p-2.5 transition-shadow hover:shadow-md">
      <a href={v.url} target="_blank" rel="noopener noreferrer" className="group/v block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
        <span className="relative block aspect-video overflow-hidden rounded-xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover/v:scale-110 motion-reduce:transform-none" />
          <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover/v:bg-black/30">
            <span className="grid h-7 w-10 scale-75 place-items-center rounded-lg bg-[#ff0000] opacity-0 shadow-lg transition-all group-hover/v:scale-100 group-hover/v:opacity-100 group-focus-visible/v:scale-100 group-focus-visible/v:opacity-100">
              <Play className="size-3.5 fill-white text-white" aria-hidden />
            </span>
          </span>
          {dur && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{dur}</span>}
        </span>
        <span className="mt-2 line-clamp-2 block text-[13px] font-semibold leading-snug group-hover/v:text-primary">{v.title}</span>
        <span className="sr-only">Opens on YouTube</span>
      </a>
      {v.channelId ? (
        <a href={`https://www.youtube.com/channel/${v.channelId}`} target="_blank" rel="noopener noreferrer" className="mt-1 truncate text-xs text-muted-foreground hover:text-foreground hover:underline">
          {v.channel}
        </a>
      ) : (
        <span className="mt-1 truncate text-xs text-muted-foreground">{v.channel}</span>
      )}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t pt-2 text-xs">
        <Stat icon={Eye} label="Views" value={`${fmtNum(v.views)} views`} title={`${v.views.toLocaleString("en-IN")} views`} />
        {v.publishedAt && (
          <Stat icon={CalendarDays} label="Posted" value={timeAgo(v.publishedAt)} title={`Posted ${fmtDay(v.publishedAt)}`} />
        )}
        {v.likes !== undefined && <Stat icon={ThumbsUp} label="Likes" value={fmtNum(v.likes)} title={`${v.likes.toLocaleString("en-IN")} likes`} />}
        {v.comments !== undefined && <Stat icon={MessageCircle} label="Comments" value={fmtNum(v.comments)} title={`${v.comments.toLocaleString("en-IN")} comments`} />}
        {v.velocity !== undefined && <Stat icon={Zap} label="Views per hour" value={`${fmtNum(v.velocity)}/hr`} title="Average views per hour since upload" />}
        {v.engagement !== undefined && <Stat icon={Sparkles} label="Engagement" value={`${fmtPct(v.engagement)} engaged`} title="(likes + comments) / views" />}
      </dl>
      {v.publishedAt && <p className="mt-2 text-[11px] text-muted-foreground" suppressHydrationWarning>Posted {fmtDay(v.publishedAt)}</p>}
    </div>
  );
}
