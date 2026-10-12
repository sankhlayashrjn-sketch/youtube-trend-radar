"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COVER_STYLES, wrapWords, type CoverStyle } from "@/lib/cover";
import { cn } from "@/lib/utils";

const W = 1280;
const H = 720;
const FONT = `900 {size}px Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif`;
const EMOJI_FONT = `380px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

function draw(canvas: HTMLCanvasElement, opts: { text: string; emoji: string; style: CoverStyle; duration: string }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { text, emoji, style, duration } = opts;

  // background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, style.from);
  g.addColorStop(1, style.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // glow behind the emoji
  const r = ctx.createRadialGradient(990, 360, 40, 990, 360, 420);
  r.addColorStop(0, "rgba(255,255,255,0.45)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);

  // diagonal stripes
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(300 + i * 220, 0);
    ctx.lineTo(420 + i * 220, 0);
    ctx.lineTo(120 + i * 220, H);
    ctx.lineTo(0 + i * 220, H);
    ctx.closePath();
    ctx.fill();
  }

  // emoji
  if (emoji) {
    ctx.save();
    // Color emoji glyphs inherit the fill alpha; the stripes above left it at 7%, so reset to opaque.
    ctx.fillStyle = "#000";
    ctx.globalAlpha = 1;
    ctx.font = EMOJI_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 14;
    ctx.translate(990, 372);
    ctx.rotate(0.12);
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  }

  // headline: shrink until it fits in 3 lines
  const maxW = 700;
  const label = (text || "YOUR TITLE").toUpperCase();
  let size = 170;
  let lines: string[] = [];
  for (; size >= 64; size -= 6) {
    ctx.font = FONT.replace("{size}", String(size));
    lines = wrapWords(label, maxW, (s) => ctx.measureText(s).width);
    if (lines.length <= 3 && lines.length * size * 1.02 <= 470) break;
  }
  ctx.font = FONT.replace("{size}", String(size));
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  const lineH = size * 1.04;
  const blockH = lines.length * lineH;
  const top = (H - blockH) / 2 + size * 0.86 + 10;
  lines.forEach((ln, i) => {
    const y = top + i * lineH;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    ctx.lineWidth = Math.max(10, size * 0.1);
    ctx.strokeStyle = style.stroke;
    ctx.strokeText(ln, 60, y);
    ctx.restore();
    ctx.fillStyle = i === lines.length - 1 && lines.length > 1 ? style.accent : style.text;
    ctx.fillText(ln, 60, y);
  });

  // accent bar under the headline
  ctx.fillStyle = style.accent;
  ctx.fillRect(60, top + (lines.length - 1) * lineH + size * 0.22, 220, 12);

  // "NEW" badge
  ctx.fillStyle = style.accent;
  ctx.beginPath();
  ctx.roundRect(48, 40, 150, 56, 14);
  ctx.fill();
  ctx.fillStyle = style.id === "sun" ? "#fff" : style.stroke;
  ctx.font = `900 34px Impact, "Arial Black", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("NEW", 78, 69);

  // YouTube-style duration badge
  if (duration) {
    ctx.font = `700 34px Arial, sans-serif`;
    const tw = ctx.measureText(duration).width;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.beginPath();
    ctx.roundRect(W - tw - 70, H - 78, tw + 30, 52, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(duration, W - tw - 55, H - 51);
  }
}

export function CoverMaker({
  defaultText, defaultEmoji, durationMin, slug,
}: { defaultText: string; defaultEmoji: string; durationMin: number; slug: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState(defaultText);
  const [emoji, setEmoji] = useState(defaultEmoji);
  const [styleId, setStyleId] = useState(COVER_STYLES[0].id);
  const style = COVER_STYLES.find((s) => s.id === styleId) ?? COVER_STYLES[0];
  const duration = `${Math.max(1, durationMin)}:00`;

  useEffect(() => {
    if (ref.current) draw(ref.current, { text, emoji, style, duration });
  }, [text, emoji, style, duration]);

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

  return (
    <div className="space-y-3">
      <canvas
        ref={ref}
        width={W}
        height={H}
        role="img"
        aria-label={`Thumbnail preview with the text ${text}`}
        className="aspect-video w-full rounded-xl border bg-muted shadow-sm"
      />
      <div className="grid gap-3 sm:grid-cols-[1fr_5rem]">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Headline on the cover (keep it to 2-4 words)
          <Input value={text} maxLength={40} onChange={(e) => setText(e.target.value)} className="text-sm font-semibold text-foreground" />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Emoji
          <Input value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} className="text-center text-lg" />
        </label>
      </div>
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
              style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
            >
              <span className="sr-only">{s.label}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setText(defaultText); setEmoji(defaultEmoji); setStyleId(COVER_STYLES[0].id); }}>
            <RotateCcw className="size-3.5" aria-hidden /> Reset
          </Button>
          <Button type="button" size="sm" onClick={download}><Download className="size-3.5" aria-hidden /> Download PNG</Button>
        </div>
      </div>
    </div>
  );
}
