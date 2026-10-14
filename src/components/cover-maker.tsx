"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ClipboardCopy, Download, ImagePlus, Move, RotateCcw, Smartphone, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BADGE_IDEAS, COVER_STYLES, DEFAULT_STUDIO, FONTS, PATTERNS, TEMPLATES, autoDarken, averageLuminance, clamp, coverChecks, headlineIdeas,
  headlineWords, hitTest, pickAccentWord, splitVersus, type CalloutKind, type Pt, type Region, type RegionId, type Studio,
} from "@/lib/cover";
import { cn } from "@/lib/utils";
import { H, W, drawCover, fontFamily, type CoverStats, type PhotoLayout } from "@/components/cover-draw";

export { drawCover };
export type { CoverStats, PhotoLayout };

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const LAYOUTS: { id: PhotoLayout; label: string; hint: string }[] = [
  { id: "full", label: "Full image", hint: "Your image fills the whole cover" },
  { id: "fit", label: "Fit whole image", hint: "Nothing is cropped (good for diagrams)" },
  { id: "side", label: "Side photo", hint: "Photo on the right, headline on the left" },
  { id: "framed", label: "Framed photo", hint: "A framed, tilted photo on the right: the classic thumbnail look" },
];

type PanelId = "text" | "look" | "photo" | "extras";
const PANELS: { id: PanelId; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "look", label: "Look" },
  { id: "photo", label: "Photo" },
  { id: "extras", label: "Extras" },
];

/** How bright the left side (where the text sits) of the image is, 0 to 1; NaN if it cannot be measured. */
function leftBrightness(img: HTMLImageElement): number {
  try {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 36;
    const g = c.getContext("2d");
    if (!g) return NaN;
    const s = Math.max(64 / img.width, 36 / img.height);
    g.drawImage(img, (64 - img.width * s) / 2, (36 - img.height * s) / 2, img.width * s, img.height * s);
    return averageLuminance(g.getImageData(0, 0, 29, 36).data);
  } catch {
    return NaN;
  }
}

const seg = (on: boolean) =>
  cn("rounded-full border px-3 py-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary");

function Slider({ label, value, min, max, step, onChange, unit = "" }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; unit?: string }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="w-24 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="w-full min-w-0 accent-[var(--primary)] sm:w-44" />
      <output className="w-12 font-semibold text-foreground">{value}{unit}</output>
    </label>
  );
}

export function CoverMaker({
  defaultText, defaultKicker, exampleTitles, stats, slug, filmTitle = "",
}: { defaultText: string; defaultKicker: string; exampleTitles: string[]; stats: CoverStats | null; slug: string; filmTitle?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const feedRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const regions = useRef<Region[]>([]);
  const drag = useRef<{ id: RegionId; sx: number; sy: number; start: Studio } | null>(null);
  const [text, setText] = useState(defaultText);
  const [kicker, setKicker] = useState(defaultKicker);
  const [styleId, setStyleId] = useState(COVER_STYLES[0].id);
  const [accentOverride, setAccentOverride] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [layout, setLayout] = useState<PhotoLayout>("full");
  const [darken, setDarken] = useState(45);
  const [fontReady, setFontReady] = useState(0);
  const [studio, setStudio] = useState<Studio>(DEFAULT_STUDIO);
  const [panel, setPanel] = useState<PanelId>("text");
  const [feed, setFeed] = useState(false);
  const [safe, setSafe] = useState(false);
  const [cursor, setCursor] = useState("default");

  const up = (p: Partial<Studio>) => setStudio((s) => ({ ...s, ...p }));
  const style = COVER_STYLES.find((s) => s.id === styleId) ?? COVER_STYLES[0];
  const tokens = useMemo(() => headlineWords(text), [text]);
  const autoIdx = useMemo(() => pickAccentWord(text, exampleTitles), [text, exampleTitles]);
  const accentIdx = accentOverride !== null && accentOverride < tokens.length ? accentOverride : autoIdx;
  const hasText = text.trim().length > 0 || kicker.trim().length > 0;
  const versusReady = !!splitVersus(text);
  const ideas = useMemo(() => headlineIdeas(text, filmTitle, exampleTitles), [text, filmTitle, exampleTitles]);
  const checks = useMemo(
    () =>
      text.trim()
        ? coverChecks(text, style)
        : [{ ok: !!photo, label: "No headline", hint: photo ? "Showing your image exactly as it is" : "Add a headline or your own image" }],
    [text, style, photo],
  );

  // Make sure the heavy weights of the app fonts are ready before the first draw.
  useEffect(() => {
    let live = true;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (fonts?.load) {
      Promise.all([fonts.load(`900 64px ${fontFamily()}`), fonts.load("800 64px var(--font-fraunces)")]).catch(() => {}).finally(() => live && setFontReady((n) => n + 1));
    }
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    regions.current = drawCover(ref.current, {
      text, kicker, accentIdx, style, photo, layout, darken: darken / 100, family: fontFamily(), studio,
      stats: showStats ? stats : null,
    });
    if (feed) feedRef.current?.getContext("2d")?.drawImage(ref.current, 0, 0, 336, 189);
  }, [text, kicker, accentIdx, style, photo, layout, darken, showStats, stats, fontReady, studio, feed]);

  // ---- moving things on the canvas ----
  function point(e: React.PointerEvent): Pt {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / (r.width || W), y: ((e.clientY - r.top) * H) / (r.height || H) };
  }
  function onDown(e: React.PointerEvent) {
    const p = point(e);
    const id = hitTest(regions.current, p.x, p.y);
    if (!id) return;
    if (id === "photo" && !photo) return;
    drag.current = { id, sx: p.x, sy: p.y, start: studio };
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
  }
  function onMove(e: React.PointerEvent) {
    const p = point(e);
    const d = drag.current;
    if (!d) {
      const id = hitTest(regions.current, p.x, p.y);
      setCursor(id && !(id === "photo" && !photo) ? "grab" : "default");
      return;
    }
    const dx = p.x - d.sx, dy = p.y - d.sy;
    setCursor("grabbing");
    if (d.id === "headline") up({ textDx: Math.round(d.start.textDx + dx), textDy: Math.round(d.start.textDy + dy) });
    else if (d.id === "photo") up({ photoDx: Math.round(d.start.photoDx + dx), photoDy: Math.round(d.start.photoDy + dy) });
    else if (d.id === "badge") up({ badgePos: { x: clamp(d.start.badgePos.x + dx / W, 0.05, 0.95), y: clamp(d.start.badgePos.y + dy / H, 0.06, 0.94) } });
    else up({ calloutPos: { x: clamp(d.start.calloutPos.x + dx / W, 0.05, 0.95), y: clamp(d.start.calloutPos.y + dy / H, 0.06, 0.94) } });
  }
  function onUp() {
    drag.current = null;
    setCursor("default");
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setPhotoError("Please choose an image file (JPG, PNG or WebP).");
    if (file.size > MAX_PHOTO_BYTES) return setPhotoError("That image is over 8 MB. Choose a smaller one.");
    setPhotoError("");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setPhoto(img);
      setLayout("full");
      up({ photoZoom: 1, photoDx: 0, photoDy: 0 });
      setDarken(autoDarken(leftBrightness(img))); // light images need more darkening behind white text
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { setPhotoError("Couldn't read that image."); URL.revokeObjectURL(url); };
    img.src = url;
  }

  function download() {
    ref.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cover-${slug || "idea"}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  }

  function copy() {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("unsupported");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast.success("Cover copied", { description: "Paste it into Canva, Photoshop or YouTube Studio." });
      } catch {
        toast.error("Couldn't copy the image", { description: "Use Download PNG instead." });
      }
    }, "image/png");
  }

  function reset() {
    setText(defaultText);
    setKicker(defaultKicker);
    setStyleId(COVER_STYLES[0].id);
    setAccentOverride(null);
    setPhoto(null);
    setPhotoError("");
    setShowStats(true);
    setLayout("full");
    setDarken(45);
    setStudio(DEFAULT_STUDIO);
  }

  const movable = studio.textDx !== 0 || studio.textDy !== 0 || studio.photoDx !== 0 || studio.photoDy !== 0;

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Cover template" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Template</span>
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" aria-pressed={studio.template === t.id} title={t.hint} onClick={() => up({ template: t.id })} className={seg(studio.template === t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {studio.template === "versus" && !versusReady && (
        <p role="status" className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
          Write the headline as <span className="font-semibold">A vs B</span> (for example &ldquo;iPhone vs Pixel&rdquo;) to split the cover into two sides. Until then it shows the Classic layout.
        </p>
      )}
      {studio.template === "number" && !(stats && showStats) && (
        <p role="status" className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">The Big number layout needs this week&apos;s numbers. Turn on &ldquo;Show this week&apos;s numbers&rdquo; in the Look tab.</p>
      )}

      <div className="relative">
        <canvas
          ref={ref}
          width={W}
          height={H}
          role="img"
          aria-label={`Thumbnail preview with the text ${text}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ cursor, touchAction: "pan-y" }}
          className="aspect-video w-full rounded-xl border bg-zinc-900 shadow-md"
        />
        {safe && (
          <div aria-hidden data-testid="safe-zone" className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <div className="absolute bottom-[3%] right-[2%] flex h-[13%] w-[17%] items-center justify-center rounded-md border-2 border-dashed border-rose-400 bg-rose-500/20 text-[10px] font-bold text-white sm:text-xs">TIMESTAMP</div>
            <div className="absolute inset-[5%] rounded-lg border border-dashed border-white/50" />
          </div>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Move className="size-3.5 shrink-0" aria-hidden /> Drag the headline, badge, arrow or photo on the cover to move them.</span>
        {movable && (
          <button type="button" onClick={() => up({ textDx: 0, textDy: 0, photoDx: 0, photoDy: 0 })} className="whitespace-nowrap font-medium underline underline-offset-2">Put them back</button>
        )}
      </p>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Thumbnail checks">
        {checks.map((c) => (
          <li key={c.label} className={cn("flex items-center gap-1.5", c.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")} title={c.hint}>
            {c.ok ? <Check className="size-3.5" aria-hidden /> : <TriangleAlert className="size-3.5" aria-hidden />}
            <span className="font-medium">{c.label}</span>
            <span className="text-muted-foreground">{c.hint}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label="Cover controls" className="flex flex-wrap gap-1.5">
          {PANELS.map((p) => (
            <button key={p.id} type="button" aria-pressed={panel === p.id} onClick={() => setPanel(p.id)} className={seg(panel === p.id)}>{p.label}</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={feed} onChange={(e) => setFeed(e.target.checked)} className="accent-[var(--primary)]" />
          <Smartphone className="size-3.5" aria-hidden /> Phone preview
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} className="accent-[var(--primary)]" />
          Show safe zones
        </label>
      </div>

      {feed && (
        <div className="flex flex-wrap items-start gap-4 rounded-2xl bg-muted/50 p-3" data-testid="feed-preview">
          <div className="w-[336px] max-w-full space-y-2">
            <div className="relative overflow-hidden rounded-lg">
              <canvas ref={feedRef} width={336} height={189} aria-label="How the thumbnail looks small, like on a phone" role="img" className="aspect-video w-full" />
              <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] font-semibold text-white">12:34</span>
            </div>
            <p className="line-clamp-2 text-sm font-semibold leading-snug">{filmTitle || text || "Your video title"}</p>
            <p className="text-xs text-muted-foreground">Your channel · 1.2L views · 2 hours ago</p>
          </div>
          <p className="min-w-40 flex-1 text-xs leading-relaxed text-muted-foreground">
            This is roughly how big your thumbnail is in the feed. If you can&apos;t read it here, viewers won&apos;t either: use fewer words or a bigger headline.
          </p>
        </div>
      )}

      <div role="group" aria-label={`${PANELS.find((p) => p.id === panel)?.label} controls`} className="space-y-4 rounded-2xl border p-4">
        {panel === "text" && (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Headline on the cover (2 to 4 words works best)
                <Input value={text} maxLength={40} onChange={(e) => setText(e.target.value)} className="text-sm font-semibold text-foreground" />
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Label above the headline
                <Input value={kicker} maxLength={28} onChange={(e) => setKicker(e.target.value)} className="text-sm text-foreground" />
              </label>
            </div>

            {ideas.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-medium text-muted-foreground">Headline ideas</span>
                {ideas.map((i) => (
                  <button key={i} type="button" onClick={() => { setText(i); setAccentOverride(null); }} className="rounded-full border bg-background px-2.5 py-1 font-semibold outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">{i}</button>
                ))}
              </div>
            )}

            {tokens.length > 0 && !(studio.template === "versus" && versusReady) && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-medium text-muted-foreground">Highlight</span>
                {tokens.map((w, i) => (
                  <button key={`${w}-${i}`} type="button" aria-pressed={i === accentIdx} onClick={() => setAccentOverride(i)} className={seg(i === accentIdx)}>
                    {w.toUpperCase()}
                  </button>
                ))}
                {accentOverride !== null && (
                  <button type="button" onClick={() => setAccentOverride(null)} className="rounded-full px-2 py-1 text-muted-foreground underline-offset-2 hover:underline">
                    Auto (from what is trending)
                  </button>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div role="group" aria-label="Headline font" className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-medium text-muted-foreground">Font</span>
                {FONTS.map((f) => (
                  <button key={f.id} type="button" aria-pressed={studio.font === f.id} onClick={() => up({ font: f.id })} className={seg(studio.font === f.id)}>{f.label}</button>
                ))}
              </div>
              <div role="group" aria-label="Highlight style" className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-medium text-muted-foreground">Highlight style</span>
                <button type="button" aria-pressed={studio.highlight === "colour"} onClick={() => up({ highlight: "colour" })} className={seg(studio.highlight === "colour")}>Coloured word</button>
                <button type="button" aria-pressed={studio.highlight === "box"} onClick={() => up({ highlight: "box" })} className={seg(studio.highlight === "box")}>Boxed word</button>
              </div>
              <Slider label="Headline size" value={Math.round(studio.textScale * 100)} min={60} max={130} step={5} unit="%" onChange={(n) => up({ textScale: n / 100 })} />
              <Slider label="Dark outline" value={studio.outline} min={0} max={12} step={1} unit="px" onChange={(n) => up({ outline: n })} />
            </div>
          </>
        )}

        {panel === "look" && (
          <>
            <div role="group" aria-label="Cover colour style" className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Colour</span>
              {COVER_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === styleId}
                  onClick={() => setStyleId(s.id)}
                  title={s.label}
                  className={cn("size-7 rounded-full border-2 outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/60", s.id === styleId ? "border-foreground" : "border-transparent")}
                  style={{ background: `linear-gradient(135deg, ${s.from} 30%, ${s.accent})` }}
                >
                  <span className="sr-only">{s.label}</span>
                </button>
              ))}
            </div>
            <div role="group" aria-label="Background pattern" className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground">Background</span>
              {PATTERNS.map((p) => (
                <button key={p.id} type="button" aria-pressed={studio.pattern === p.id} onClick={() => up({ pattern: p.id })} className={seg(studio.pattern === p.id)}>{p.label}</button>
              ))}
            </div>
            {stats && !photo && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={showStats} onChange={(e) => setShowStats(e.target.checked)} className="accent-[var(--primary)]" />
                Show this week&apos;s numbers
              </label>
            )}
          </>
        )}

        {panel === "photo" && (
          <>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Add your photo or product shot" onChange={onPhoto} tabIndex={-1} />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-3.5" aria-hidden /> {photo ? "Change photo" : "Add your photo"}
              </Button>
              {photo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPhoto(null); up({ photoZoom: 1, photoDx: 0, photoDy: 0, blurBackdrop: false }); }}>
                  <X className="size-3.5" aria-hidden /> Remove photo
                </Button>
              )}
              {!photo && <p className="text-xs text-muted-foreground">A clear photo of you or the product works best. It stays in your browser and is never uploaded.</p>}
            </div>
            {photo && (
              <div className="space-y-3 rounded-xl bg-muted/50 p-3 text-xs">
                <div role="group" aria-label="Photo layout" className="flex flex-wrap gap-1.5">
                  {LAYOUTS.map((l) => (
                    <button key={l.id} type="button" aria-pressed={layout === l.id} title={l.hint} onClick={() => setLayout(l.id)} className={seg(layout === l.id)}>{l.label}</button>
                  ))}
                </div>
                {(layout === "full" || layout === "fit") && hasText && (
                  <label className="flex items-center gap-2 text-muted-foreground">
                    Darken behind text
                    <input type="range" min={0} max={80} step={5} value={darken} onChange={(e) => setDarken(Number(e.target.value))} aria-label="Darken behind text" className="w-28 accent-[var(--primary)]" />
                    <output className="w-9 font-semibold text-foreground">{darken}%</output>
                  </label>
                )}
                <Slider label="Zoom" value={Math.round(studio.photoZoom * 100)} min={100} max={300} step={5} unit="%" onChange={(n) => up({ photoZoom: n / 100 })} />
                {layout === "framed" && (
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input type="checkbox" checked={studio.blurBackdrop} onChange={(e) => up({ blurBackdrop: e.target.checked })} className="accent-[var(--primary)]" />
                    Blur your photo behind the frame
                  </label>
                )}
                <p className="text-muted-foreground">Drag the photo on the cover to reposition it. Clear the headline and the label to use your image exactly as it is.</p>
              </div>
            )}
            {photoError && <p role="alert" className="text-xs text-destructive">{photoError}</p>}
          </>
        )}

        {panel === "extras" && (
          <>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <input type="checkbox" checked={studio.badgeOn} onChange={(e) => up({ badgeOn: e.target.checked })} className="accent-[var(--primary)]" />
                Add a badge
              </label>
              {studio.badgeOn && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Input value={studio.badgeText} maxLength={14} aria-label="Badge text" onChange={(e) => up({ badgeText: e.target.value })} className="h-8 w-32 text-sm font-semibold" />
                  {BADGE_IDEAS.map((b) => (
                    <button key={b} type="button" onClick={() => up({ badgeText: b })} className="rounded-full border bg-background px-2.5 py-1 font-semibold outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">{b}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div role="group" aria-label="Callout" className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-medium text-muted-foreground">Point at something</span>
                {(["none", "arrow", "circle"] as CalloutKind[]).map((k) => (
                  <button key={k} type="button" aria-pressed={studio.callout === k} onClick={() => up({ callout: k })} className={seg(studio.callout === k)}>{k === "none" ? "None" : k === "arrow" ? "Arrow" : "Circle"}</button>
                ))}
              </div>
              {studio.callout !== "none" && <Slider label="Size" value={Math.round(studio.calloutSize * 100)} min={60} max={200} step={10} unit="%" onChange={(n) => up({ calloutSize: n / 100 })} />}
              {studio.callout === "arrow" && <Slider label="Turn the arrow" value={studio.calloutRot} min={0} max={359} step={5} unit="°" onChange={(n) => up({ calloutRot: n })} />}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-40 flex-1 text-xs text-muted-foreground">The bottom-right corner is kept clear for YouTube&apos;s timestamp.</p>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="size-3.5" aria-hidden /> Reset
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copy}><ClipboardCopy className="size-3.5" aria-hidden /> Copy image</Button>
        <Button type="button" size="sm" onClick={download}><Download className="size-3.5" aria-hidden /> Download PNG</Button>
      </div>
    </div>
  );
}
