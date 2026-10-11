"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REGIONS, settingsSchema, type Settings } from "@/lib/types";
import { fmtNum, VIEW_STEPS } from "@/lib/format";

export function SettingsForm({ initial }: { initial: Settings }) {
  const [categories, setCategories] = useState(initial.categories);
  const [region, setRegion] = useState(initial.region);
  const [email, setEmail] = useState(initial.email);
  const [step, setStep] = useState(() => {
    const i = VIEW_STEPS.findIndex((v) => v >= initial.minViews);
    return i === -1 ? VIEW_STEPS.length - 1 : i;
  });
  const [draft, setDraft] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function addTag() {
    const v = draft.trim();
    if (!v) return;
    if (v.length < 2) return setErrors((e) => ({ ...e, categories: "Category must be at least 2 characters" }));
    if (categories.some((c) => c.toLowerCase() === v.toLowerCase())) return setDraft("");
    if (categories.length >= 12) return setErrors((e) => ({ ...e, categories: "Max 12 categories" }));
    setCategories([...categories, v]);
    setDraft("");
    setErrors((e) => ({ ...e, categories: "" }));
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const parsed = settingsSchema.safeParse({ categories, region, email, minViews: VIEW_STEPS[step] });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (map[String(i.path[0])] ??= i.message));
      setErrors(map);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      toast.success("Settings saved", { description: "Open the dashboard and click Generate now to build a brief for these categories." });
    } catch (e) {
      toast.error("Couldn't save settings", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-8 rounded-2xl border bg-card p-6 shadow-sm sm:p-8" noValidate>
      <fieldset className="space-y-3">
        <Label htmlFor="cat">Categories</Label>
        <p id="cat-help" className="text-xs text-muted-foreground">Keywords searched on YouTube each week. Up to 10 are searched (each costs 100 quota units).</p>
        <ul className="flex flex-wrap gap-2" aria-label="Current categories">
          {categories.map((c) => (
            <li key={c} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-sm font-medium text-primary">
              {c}
              <button type="button" onClick={() => setCategories(categories.filter((x) => x !== c))} aria-label={`Remove ${c}`} className="grid size-5 place-items-center rounded-full hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input id="cat" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. AI coding tools" aria-describedby="cat-help" aria-invalid={!!errors.categories}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
          <Button type="button" variant="outline" onClick={addTag}><Plus className="size-4" aria-hidden /> Add</Button>
        </div>
        {errors.categories && <p role="alert" className="text-sm text-destructive">{errors.categories}</p>}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="region">Region</Label>
        <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-72">
          {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.name} ({r.code})</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 sm:w-96">
          <Label htmlFor="min-views">Minimum views for example videos</Label>
          <output htmlFor="min-views" className="text-sm font-semibold text-primary">{VIEW_STEPS[step] === 0 ? "Any" : `${fmtNum(VIEW_STEPS[step])}+`}</output>
        </div>
        <input
          id="min-views"
          type="range"
          min={0}
          max={VIEW_STEPS.length - 1}
          step={1}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          aria-valuetext={VIEW_STEPS[step] === 0 ? "No minimum" : `${VIEW_STEPS[step].toLocaleString()} views`}
          className="w-full accent-[var(--primary)] sm:w-96"
        />
        <p className="text-xs text-muted-foreground">From 0 to 20M. Hides example videos below this many views on the dashboard and archive.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Send the brief to</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} className="sm:w-96" />
        {errors.email && <p role="alert" className="text-sm text-destructive">{errors.email}</p>}
        <p className="text-xs text-muted-foreground">With Resend&apos;s free sender, this must be the address you signed up with.</p>
      </div>

      <Button type="submit" size="lg" disabled={saving} className="h-10 px-5">
        {saving && <Loader2 className="size-4 animate-spin" aria-hidden />} Save settings
      </Button>
    </form>
  );
}
