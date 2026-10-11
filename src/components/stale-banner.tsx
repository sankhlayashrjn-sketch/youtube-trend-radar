import { AlertTriangle } from "lucide-react";

export function StaleBanner({ reason }: { reason: string }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p><span className="font-semibold">Stale data. </span>{reason}</p>
    </div>
  );
}
