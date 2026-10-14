import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBrief, getSettings, scriptIndexes } from "@/lib/repo";
import { fmtDate } from "@/lib/format";
import { BriefView } from "@/components/brief-view";

export const dynamic = "force-dynamic";

export default async function ArchiveDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = await getBrief(id);
  if (!stored) notFound();
  const { minViews, rpm } = await getSettings().then((s) => ({ minViews: s.minViews, rpm: s.rpm })).catch(() => ({ minViews: 0, rpm: 80 }));
  const scriptIdx = await scriptIndexes(stored.id).catch(() => []);
  return (
    <div className="space-y-6">
      <Link href="/archive" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All briefs
      </Link>
      <div>
        <h1 className="font-heading text-3xl font-semibold">Week of {stored.brief.weekOf}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Generated {fmtDate(stored.createdAt.toISOString())} IST</p>
      </div>
      <BriefView brief={stored.brief} minViews={minViews} rpm={rpm} briefId={stored.id} scriptIdx={scriptIdx} />
    </div>
  );
}
