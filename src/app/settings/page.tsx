import { getSettings } from "@/lib/repo";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let settings = null;
  try {
    settings = await getSettings();
  } catch {
    /* handled below */
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Changes apply to the next brief you generate or that arrives on Sunday.</p>
      </div>
      {settings ? <SettingsForm initial={settings} /> : <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">Couldn&apos;t load settings from the database. Try again shortly.</p>}
    </div>
  );
}
