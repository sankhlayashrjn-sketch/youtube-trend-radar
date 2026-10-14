"use client";

import { Eye, IndianRupee } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { clampRpm, fmtINR, forecastViews, incomeFromViews } from "@/lib/forecast";
import type { Theme } from "@/lib/types";

/** Expected views and rough ad income for one theme, with the reasoning shown so the number can be trusted (or argued with). */
export function ExpectedResults({ theme, rpm }: { theme: Theme; rpm: number }) {
  const f = forecastViews(theme);
  const r = clampRpm(rpm);
  return (
    <section aria-label="Expected results" className="rounded-2xl border bg-muted/40 p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Eye className="size-3.5" aria-hidden /> Expected results if you film this
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Expected views</p>
          <p className="font-heading text-3xl font-semibold tabular-nums" data-testid="expected-views">{fmtNum(f.expected)}</p>
          <p className="text-sm text-muted-foreground">Likely range <span className="font-semibold text-foreground">{fmtNum(f.low)} to {fmtNum(f.high)}</span></p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><IndianRupee className="size-3" aria-hidden /> Rough ad income</p>
          <p className="font-heading text-3xl font-semibold tabular-nums" data-testid="expected-income">{fmtINR(incomeFromViews(f.expected, r))}</p>
          <p className="text-sm text-muted-foreground">Range <span className="font-semibold text-foreground">{fmtINR(incomeFromViews(f.low, r))} to {fmtINR(incomeFromViews(f.high, r))}</span></p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Income uses ₹{r} per 1,000 views, an estimate based on this theme&apos;s example videos. Change it in <a href="/settings" className="font-medium underline underline-offset-2">Settings</a>.
      </p>
    </section>
  );
}
