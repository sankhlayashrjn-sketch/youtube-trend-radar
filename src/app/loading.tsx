import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-56 w-full rounded-3xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-96 rounded-2xl" />)}
      </div>
    </div>
  );
}
