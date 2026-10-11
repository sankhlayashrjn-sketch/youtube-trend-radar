import { getLatest } from "@/lib/latest";
import { getSettings } from "@/lib/repo";
import { fmtDate } from "@/lib/format";
import { BriefView } from "@/components/brief-view";
import { EmptyState } from "@/components/empty-state";
import { GenerateButton } from "@/components/generate-button";
import { StaleBanner } from "@/components/stale-banner";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const latest = await getLatest();
  const minViews = await getSettings().then((s) => s.minViews).catch(() => 0);
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Your Sunday brief</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {latest.createdAt ? `Generated ${fmtDate(latest.createdAt)} IST` : "Patterns, not a list of videos."}
          </p>
        </div>
        {latest.brief && <GenerateButton variant="outline" />}
      </div>
      {latest.stale && latest.staleReason && <StaleBanner reason={latest.staleReason} />}
      {latest.brief ? <BriefView brief={latest.brief} minViews={minViews} /> : <EmptyState />}
    </div>
  );
}
