"use client";

import { useState } from "react";
import { Eye, IndianRupee } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { DEFAULT_RPM_INR, RPM_MAX, RPM_MIN, clampRpm, fmtINR, forecastViews, incomeFromViews } from "@/lib/forecast";
import type { Theme } from "@/lib/types";

/** Expected views and rough ad income for one theme, with the reasoning shown so the number can be trusted (or argued with). */
export function ExpectedResults({ theme }: { theme: Theme }) {
  const f = forecastViews(theme);
  const [rpm, setRpm] = useState(DEFAULT_RPM_INR);
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
      <label className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Your earnings per 1,000 views (₹)
        <input
          type="number"
          inputMode="numeric"
          min={RPM_MIN}
          max={RPM_MAX}
          value={rpm}
          onChange={(e) => setRpm(Number(e.target.value))}
          onBlur={() => setRpm(clampRpm(rpm))}
          aria-label="Earnings per 1,000 views in rupees"
          className="h-8 w-20 rounded-lg border bg-background px-2 text-sm font-semibold text-foreground"
        />
        <span>(₹{DEFAULT_RPM_INR} is a typical figure for Indian tech channels. Check yours in YouTube Studio.)</span>
      </label>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        How this is worked out: the {f.basedOn} example video{f.basedOn === 1 ? "" : "s"} in this theme typically reached the middle figure (the range is the lower and upper quarter),
        then adjusted for how urgent the trend is ({theme.urgency.level.replace("_", " ")}) and how crowded it is ({theme.saturation}).
        {f.confidence === "rough" && " There are few examples, so treat this as a rough guide."} Assumes a typical-size channel; a bigger channel will do better.
        Ad income only, before sponsorships, and only for regular videos, not Shorts. It is an estimate, not a promise.
      </p>
    </section>
  );
}
