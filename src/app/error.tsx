"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border bg-card p-8 text-center">
      <h1 className="font-heading text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">We couldn&apos;t load this page. Your saved briefs are safe. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
