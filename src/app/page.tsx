import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { getLatest } from "@/lib/latest";
import { fmtDate } from "@/lib/format";
import { BriefView } from "@/components/brief-view";
import { EmptyState } from "@/components/empty-state";
import { GenerateButton } from "@/components/generate-button";
import { StaleBanner } from "@/components/stale-banner";

export const dynamic = "force-dynamic";

function Chips({ items }: { items: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5 align-middle">
      {items.map((c) => (
        <span key={c} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{c}</span>
      ))}
    </span>
  );
}

export default async function Dashboard() {
  const latest = await getLatest();
  const minViews = latest.settings?.minViews ?? 0;

  // Settings changed since the newest brief was made: don't present old-niche content as current.
  if (latest.brief && latest.settingsMismatch) {
    return (
      <div className="space-y-8">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Your Sunday brief</h1>
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 rounded-3xl border border-dashed bg-card/60 px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><RefreshCw className="size-7" aria-hidden /></span>
          <h2 className="font-heading text-2xl font-semibold">Your settings changed</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You&apos;re now tracking <Chips items={latest.settings?.categories ?? []} /> in {latest.settings?.region}. The latest saved brief
            {latest.briefCategories ? <> was built for <Chips items={latest.briefCategories} /></> : " was built for different settings"}, so it isn&apos;t shown here.
            Generate a new brief for your current categories.
          </p>
          {latest.stale && latest.staleReason && <StaleBanner reason={latest.staleReason} />}
          <GenerateButton />
          <Link href="/archive" className="text-sm font-medium text-primary underline-offset-4 hover:underline">View older briefs in the archive</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Your Sunday brief</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {latest.createdAt ? `Generated ${fmtDate(latest.createdAt)} IST` : "Patterns, not a list of videos."}
          </p>
          {latest.brief?.meta.categories && (
            <p className="mt-2 text-sm text-muted-foreground">Tracking <Chips items={latest.brief.meta.categories} /></p>
          )}
        </div>
        {latest.brief && <GenerateButton variant="outline" />}
      </div>
      {latest.stale && latest.staleReason && <StaleBanner reason={latest.staleReason} />}
      {latest.brief ? <BriefView brief={latest.brief} minViews={minViews} /> : <EmptyState />}
    </div>
  );
}
