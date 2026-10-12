"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, ImagePlus, RotateCcw, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  COVER_STYLES, coverChecks, headlineWords, pickAccentWord, withAlpha, wrapWords, type CoverStyle,
} from "@/lib/cover";
import { cn } from "@/lib/utils";

const W = 1280;
const H = 720;
const PAD = 84;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type CoverStats = { views: string; creators: number; velocity: string };

type DrawOpts = {
  text: string;
  kicker: string;
  accentIdx: number;
  style: CoverStyle;
  stats: CoverStats | null;
  photo: HTMLImageElement | null;
  family: string;
};

/** The app's own font (loaded by next/font) so the cover matches the product; falls back to system sans. */
function fontFamily(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim();
  return `${v ? `${v}, ` : ""}"Segoe UI", Helvetica, Arial, sans-serif`;
}

function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  // Fit the photo into the right side, then fade its left edge into the background.
  const x0 = 470;
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const l = layer.getContext("2d");
  if (!l) return;
  const rw = W - x0;
  const scale = Math.max(rw / img.width, H / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  l.drawImage(img, x0 + (rw - dw) / 2, (H - dh) / 2, dw, dh);
  l.globalCompositeOperation = "destination-in";
  const fade = l.createLinearGradient(x0, 0, x0 + 360, 0);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  l.fillStyle = fade;
  l.fillRect(0, 0, W, H);
  ctx.drawImage(layer, 0, 0);
}

function drawStats(ctx: CanvasRenderingContext2D, o: DrawOpts, stats: CoverStats) {
  const x = 790, y = 150, w = 410, h = 420;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 30);
  ctx.fill();
  ctx.stroke();

  // header
  ctx.fillStyle = o.style.accent;
  ctx.beginPath();
  ctx.arc(x + 44, y + 52, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 22px ${o.family}`;
  ctx.letterSpacing = "4px";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText("THIS WEEK", x + 66, y + 60);

  const rows: [string, string][] = [
    [stats.views, "total views"],
    [String(stats.creators), "creators covering it"],
    [stats.velocity, "views per hour"],
  ];
  rows.forEach(([num, label], i) => {
    const ry = y + 150 + i * 112;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 36, ry - 76);
    ctx.lineTo(x + w - 36, ry - 76);
    ctx.stroke();
    ctx.letterSpacing = "-2px";
    ctx.font = `900 74px ${o.family}`;
    ctx.fillStyle = i === 0 ? o.style.accent : o.style.text;
    ctx.fillText(num, x + 36, ry);
    ctx.letterSpacing = "0px";
    ctx.font = `500 24px ${o.family}`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(label, x + 38, ry + 32);
  });
  ctx.restore();
}

export function drawCover(canvas: HTMLCanvasElement, o: DrawOpts) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { style } = o;

  // background and a soft accent spotlight on the right
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, style.from);
  bg.addColorStop(1, style.to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(1000, 300, 30, 1000, 300, 600);
  glow.addColorStop(0, withAlpha(style.accent, 0.28));
  glow.addColorStop(1, withAlpha(style.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  if (o.photo) drawPhoto(ctx, o.photo);
  else if (o.stats) drawStats(ctx, o, o.stats);

  // vignette keeps the eye in the middle
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // headline: as large as fits in at most 3 lines, left aligned
  const label = (o.text.trim() || "YOUR TITLE").toUpperCase();
  const maxW = o.photo || o.stats ? 640 : 1000;
  let size = 156;
  let lines: string[] = [];
  const setFont = (s: number) => {
    ctx.font = `900 ${s}px ${o.family}`;
    ctx.letterSpacing = `${-Math.round(s * 0.025)}px`;
  };
  for (; size >= 64; size -= 4) {
    setFont(size);
    lines = wrapWords(label, maxW, (s) => ctx.measureText(s).width);
    if (lines.length <= 3 && lines.length * size * 1.02 <= 430) break;
  }
  setFont(size);
  const lineH = size * 1.02;
  const blockH = lines.length * lineH;
  const kicker = o.kicker.trim().toUpperCase();
  const top = (H - blockH) / 2 + (kicker ? 26 : 0);

  if (kicker) {
    ctx.fillStyle = style.accent;
    ctx.beginPath();
    ctx.roundRect(PAD, top - 62, 6, 32, 3);
    ctx.fill();
    ctx.font = `700 28px ${o.family}`;
    ctx.letterSpacing = "5px";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(kicker, PAD + 22, top - 36);
    setFont(size);
  }

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 8;
  const space = ctx.measureText(" ").width;
  let wordIdx = 0;
  lines.forEach((ln, li) => {
    let x = PAD;
    const y = top + li * lineH + size * 0.82;
    for (const w of ln.split(" ")) {
      ctx.fillStyle = wordIdx === o.accentIdx ? style.accent : style.text;
      ctx.fillText(w, x, y);
      x += ctx.measureText(w).width + space;
      wordIdx++;
    }
  });
  ctx.restore();

  // short accent rule under the headline
  ctx.fillStyle = style.accent;
  ctx.beginPath();
  ctx.roundRect(PAD, top + blockH + 14, 96, 8, 4);
  ctx.fill();
}

export function CoverMaker({
  defaultText, defaultKicker, exampleTitles, stats, slug,
}: { defaultText: string; defaultKicker: string; exampleTitles: string[]; stats: CoverStats | null; slug: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(defaultText);
  const [kicker, setKicker] = useState(defaultKicker);
  const [styleId, setStyleId] = useState(COVER_STYLES[0].id);
  const [accentOverride, setAccentOverride] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [fontReady, setFontReady] = useState(0);

  const style = COVER_STYLES.find((s) => s.id === styleId) ?? COVER_STYLES[0];
  const tokens = useMemo(() => headlineWords(text), [text]);
  const autoIdx = useMemo(() => pickAccentWord(text, exampleTitles), [text, exampleTitles]);
  const accentIdx = accentOverride !== null && accentOverride < tokens.length ? accentOverride : autoIdx;
  const checks = useMemo(() => coverChecks(text, style), [text, style]);

  // Make sure the heavy weight of the app font is ready before the first draw.
  useEffect(() => {
    let live = true;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (fonts?.load) {
      fonts.load(`900 64px ${fontFamily()}`).catch(() => {}).finally(() => live && setFontReady((n) => n + 1));
    }
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    drawCover(ref.current, {
      text, kicker, accentIdx, style, photo, family: fontFamily(),
      stats: showStats ? stats : null,
    });
  }, [text, kicker, accentIdx, style, photo, showStats, stats, fontReady]);

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setPhotoError("Please choose an image file (JPG, PNG or WebP).");
    if (file.size > MAX_PHOTO_BYTES) return setPhotoError("That image is over 8 MB. Choose a smaller one.");
    setPhotoError("");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setPhoto(img); URL.revokeObjectURL(url); };
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

  function reset() {
    setText(defaultText);
    setKicker(defaultKicker);
    setStyleId(COVER_STYLES[0].id);
    setAccentOverride(null);
    setPhoto(null);
    setPhotoError("");
    setShowStats(true);
  }

  return (
    <div className="space-y-4">
      <canvas
        ref={ref}
        width={W}
        height={H}
        role="img"
        aria-label={`Thumbnail preview with the text ${text}`}
        className="aspect-video w-full rounded-xl border bg-zinc-900 shadow-md"
      />

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Thumbnail checks">
        {checks.map((c) => (
          <li key={c.label} className={cn("flex items-center gap-1.5", c.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")} title={c.hint}>
            {c.ok ? <Check className="size-3.5" aria-hidden /> : <TriangleAlert className="size-3.5" aria-hidden />}
            <span className="font-medium">{c.label}</span>
            <span className="text-muted-foreground">{c.hint}</span>
          </li>
        ))}
      </ul>

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

      {tokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-medium text-muted-foreground">Highlight</span>
          {tokens.map((w, i) => (
            <button
              key={`${w}-${i}`}
              type="button"
              aria-pressed={i === accentIdx}
              onClick={() => setAccentOverride(i)}
              className={cn("rounded-full border px-2.5 py-1 font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", i === accentIdx ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary")}
            >
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

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Cover colour style" className="flex flex-wrap gap-1.5">
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

        <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Add your photo or product shot" onChange={onPhoto} tabIndex={-1} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="size-3.5" aria-hidden /> {photo ? "Change photo" : "Add your photo"}
        </Button>
        {photo && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(null)}>
            <X className="size-3.5" aria-hidden /> Remove photo
          </Button>
        )}
        {!photo && stats && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showStats} onChange={(e) => setShowStats(e.target.checked)} className="accent-[var(--primary)]" />
            Show this week&apos;s numbers
          </label>
        )}

        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="size-3.5" aria-hidden /> Reset
          </Button>
          <Button type="button" size="sm" onClick={download}><Download className="size-3.5" aria-hidden /> Download PNG</Button>
        </div>
      </div>
      {photoError && <p role="alert" className="text-xs text-destructive">{photoError}</p>}
      <p className="text-xs text-muted-foreground">
        Tip: a clear photo of you or the product works best. It stays in your browser and is never uploaded. The bottom-right corner is kept clear for YouTube&apos;s timestamp.
      </p>
    </div>
  );
}
