import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listBriefs } from "@/lib/repo";
import { fmtDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function Archive() {
  let briefs: Awaited<ReturnType<typeof listBriefs>> = [];
  let failed = false;
  try {
    briefs = await listBriefs();
  } catch {
    failed = true;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Archive</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every brief generated so far, newest first.</p>
      </div>
      {failed && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">Couldn&apos;t reach the database. Try again in a moment.</p>}
      {!failed && briefs.length === 0 && <EmptyState />}
      <ul className="grid gap-3">
        {briefs.map((b) => (
          <li key={b.id}>
            <Link href={`/archive/${b.id}`} className="group flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Week of {b.brief.weekOf} · {b.brief.meta.dataSource}</p>
                <p className="font-heading mt-1 truncate text-lg font-semibold">{b.brief.headline[0]}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {b.brief.themes.length} themes · {b.brief.meta.videoCount} videos · {fmtDate(b.createdAt.toISOString())} IST
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
