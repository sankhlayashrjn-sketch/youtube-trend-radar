import { ArrowDown, Brain, CalendarClock, Database, Globe, Layout, Mail, Server } from "lucide-react";

export const metadata = { title: "Components Map · Trend Radar" };

type Node = { icon: typeof Server; title: string; items: { name: string; note: string }[] };

const LAYERS: { label: string; nodes: Node[] }[] = [
  {
    label: "Triggers",
    nodes: [
      { icon: CalendarClock, title: "Vercel Cron", items: [{ name: "0 23 * * 6", note: "Sat 23:00 UTC = Sun 04:30 IST → /api/cron/weekly-brief (Bearer CRON_SECRET)" }, { name: "0 6 * * *", note: "Daily /api/health ping keeps Supabase awake" }] },
      { icon: Layout, title: "Web UI (Next.js App Router)", items: [{ name: "/", note: "Dashboard: hero headline, momentum chart, theme cards, Generate now" }, { name: "/archive", note: "Past briefs + detail" }, { name: "/settings", note: "Categories, region, email (Zod)" }, { name: "/components-map", note: "This page" }] },
    ],
  },
  {
    label: "API routes",
    nodes: [
      { icon: Server, title: "Route handlers", items: [{ name: "POST /api/generate", note: "One stage per call (fetch → cluster → brief), rate-limited" }, { name: "GET /api/cron/weekly-brief", note: "Full pipeline + email, secret-checked" }, { name: "GET /api/brief/latest", note: "Latest brief + stale flag" }, { name: "GET|PUT /api/settings", note: "Read/validate/save settings" }, { name: "GET /api/health", note: "select 1" }] },
    ],
  },
  {
    label: "Pipeline (src/lib)",
    nodes: [
      { icon: Globe, title: "Data layer", items: [{ name: "youtube.ts", note: "mostPopular + capped search.list + videos.list, quota guard" }, { name: "metrics.ts", note: "velocity, engagement, duration bucket, unique creators" }] },
      { icon: Brain, title: "Intelligence layer", items: [{ name: "gemini.ts", note: "Gemini embeddings + Flash JSON, 429 backoff, retry-once" }, { name: "cluster.ts", note: "k-means + “≥3 distinct creators” rule" }, { name: "brief.ts", note: "Facts → prompt → Zod → merge code numbers → verify URLs" }] },
      { icon: Mail, title: "Delivery", items: [{ name: "email.ts", note: "Inline-styled HTML via Resend" }] },
    ],
  },
  {
    label: "Storage & external services",
    nodes: [
      { icon: Database, title: "Supabase Postgres (Drizzle + postgres-js)", items: [{ name: "settings", note: "categories, region, email" }, { name: "videos", note: "stats, metrics, embeddings; daily cache" }, { name: "briefs", note: "validated JSON per week" }, { name: "runs", note: "stage, quota, error" }] },
      { icon: Globe, title: "External APIs", items: [{ name: "YouTube Data API v3", note: "10,000 units/day free" }, { name: "Gemini Flash + embedding", note: "Only AI provider used" }, { name: "Resend", note: "Email delivery" }] },
    ],
  },
];

export default function ComponentsMap() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Components Map</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">How the pieces fit: triggers call API routes, which run the staged pipeline, which reads and writes Supabase and calls YouTube, Gemini and Resend. Each stage saves its result, so a timeout never loses work.</p>
      </div>
      <div className="space-y-2">
        {LAYERS.map((layer, li) => (
          <div key={layer.label}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{layer.label}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {layer.nodes.map((n) => (
                <section key={n.title} className="rounded-2xl border bg-card p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
                    <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><n.icon className="size-4" aria-hidden /></span>
                    {n.title}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {n.items.map((it) => (
                      <li key={it.name} className="text-sm"><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{it.name}</code><span className="ml-2 text-muted-foreground">{it.note}</span></li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {li < LAYERS.length - 1 && <div className="my-3 flex justify-center text-muted-foreground"><ArrowDown className="size-5" aria-hidden /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
