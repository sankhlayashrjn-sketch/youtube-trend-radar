import {
  DEFAULT_STUDIO, FONTS, luminance, splitVersus, withAlpha, wrapWords,
  type CoverStyle, type Region, type Studio,
} from "@/lib/cover";

export const W = 1280;
export const H = 720;
const PAD = 84;

export type CoverStats = { views: string; creators: number; velocity: string };
export type PhotoLayout = "full" | "fit" | "side" | "framed";

export type DrawOpts = {
  text: string;
  kicker: string;
  accentIdx: number;
  style: CoverStyle;
  stats: CoverStats | null;
  photo: HTMLImageElement | null;
  layout: PhotoLayout;
  /** 0 to 1: how much to darken the image behind the text (only used when there is text) */
  darken: number;
  family: string;
  studio?: Studio;
};

type Ctx = CanvasRenderingContext2D;
const DARK = "#0b0b0c";

/** The app's own font (loaded by next/font) so the cover matches the product; falls back to system sans. */
export function fontFamily(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim();
  return `${v ? `${v}, ` : ""}"Segoe UI", Helvetica, Arial, sans-serif`;
}

function headlineFont(o: DrawOpts, studio: Studio) {
  const f = FONTS.find((x) => x.id === studio.font) ?? FONTS[0];
  return { weight: f.weight, family: f.css ? `${f.css}, ${o.family}` : o.family, tracking: f.tracking };
}

/** Cover-fit an image into a box, then apply the creator's zoom and pan. */
function fitBox(img: HTMLImageElement, bx: number, by: number, bw: number, bh: number, studio: Studio) {
  const s = Math.max(bw / img.width, bh / img.height) * studio.photoZoom;
  const dw = img.width * s, dh = img.height * s;
  return { x: bx + (bw - dw) / 2 + studio.photoDx, y: by + (bh - dh) / 2 + studio.photoDy, w: dw, h: dh };
}

function drawSidePhoto(ctx: Ctx, img: HTMLImageElement, studio: Studio): Region {
  // Fit the photo into the right side, then fade its left edge into the background.
  const x0 = 470;
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const l = layer.getContext("2d");
  if (!l) return { id: "photo", x: x0, y: 0, w: W - x0, h: H };
  const rw = W - x0;
  const b = fitBox(img, x0, 0, rw, H, studio);
  l.drawImage(img, b.x, b.y, b.w, b.h);
  l.globalCompositeOperation = "destination-in";
  const fade = l.createLinearGradient(x0, 0, x0 + 360, 0);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  l.fillStyle = fade;
  l.fillRect(0, 0, W, H);
  ctx.drawImage(layer, 0, 0);
  return { id: "photo", x: x0, y: 0, w: rw, h: H };
}

/** A framed photo: rounded corners, a white keyline and a soft shadow, slightly tilted. The classic "sticker" look. */
function drawFramedPhoto(ctx: Ctx, img: HTMLImageElement, style: CoverStyle, studio: Studio): Region {
  const x = 640, y = 96, w = 556, h = 528;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((3 * Math.PI) / 180);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 38);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 30);
  ctx.save();
  ctx.clip();
  const b = fitBox(img, x, y, w, h, studio);
  ctx.drawImage(img, b.x, b.y, b.w, b.h);
  ctx.restore();
  ctx.strokeStyle = style.accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 38);
  ctx.stroke();
  ctx.restore();
  return { id: "photo", x: x - 12, y: y - 12, w: w + 24, h: h + 24 };
}

function drawStats(ctx: Ctx, o: DrawOpts, stats: CoverStats) {
  const x = 790, y = 150, w = 410, h = 420;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 30);
  ctx.fill();
  ctx.stroke();

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

/** Show the whole image: "full" fills the cover (crops the edges), "fit" keeps every pixel visible. */
function drawWholePhoto(ctx: Ctx, img: HTMLImageElement, mode: "full" | "fit", studio: Studio): Region {
  const base = mode === "full" ? Math.max(W / img.width, H / img.height) : Math.min(W / img.width, H / img.height);
  const s = base * studio.photoZoom;
  const dw = img.width * s, dh = img.height * s;
  const x = (W - dw) / 2 + studio.photoDx, y = (H - dh) / 2 + studio.photoDy;
  ctx.drawImage(img, x, y, dw, dh);
  return { id: "photo", x: 0, y: 0, w: W, h: H };
}

// ---- backgrounds ----------------------------------------------------------------------------------

function drawBackground(ctx: Ctx, style: CoverStyle, studio: Studio, wholePhoto: boolean) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, style.from);
  bg.addColorStop(1, style.to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (wholePhoto) return;

  const glowAt = studio.pattern === "spotlight" ? { x: W / 2, y: H * 0.45, r: 760, a: 0.42 } : { x: 1000, y: 300, r: 600, a: 0.28 };
  const glow = ctx.createRadialGradient(glowAt.x, glowAt.y, 30, glowAt.x, glowAt.y, glowAt.r);
  glow.addColorStop(0, withAlpha(style.accent, glowAt.a));
  glow.addColorStop(1, withAlpha(style.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  if (studio.pattern === "split") {
    ctx.fillStyle = withAlpha(style.accent, 0.16);
    ctx.beginPath();
    ctx.moveTo(W * 0.62, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, H);
    ctx.lineTo(W * 0.4, H);
    ctx.closePath();
    ctx.fill();
  } else if (studio.pattern === "grid") {
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
}

// ---- headline -------------------------------------------------------------------------------------

type Block = { region: Region; bottom: number };

type HeadlineArgs = {
  ctx: Ctx; o: DrawOpts; studio: Studio; label: string; kicker: string;
  /** where the block sits */ x: number; align: "left" | "center"; maxW: number; maxSize: number; maxLines: number; maxH: number;
  onPhoto: boolean;
  /** vertical centre of the block, before the creator's own offset */ cy: number;
  accentIdx: number; accentAll?: boolean;
};

function drawHeadline(a: HeadlineArgs): Block | null {
  const { ctx, o, studio, label, kicker, align, onPhoto } = a;
  const font = headlineFont(o, studio);
  const setFont = (s: number) => {
    ctx.font = `${font.weight} ${s}px ${font.family}`;
    ctx.letterSpacing = `${Math.round(s * font.tracking)}px`;
  };
  let size = a.maxSize;
  let lines: string[] = [];
  if (label) {
    for (; size >= 64; size -= 4) {
      setFont(size);
      lines = wrapWords(label, a.maxW, (s) => ctx.measureText(s).width);
      if (lines.length <= a.maxLines && lines.length * size * 1.02 <= a.maxH) break;
    }
    size = Math.max(40, Math.round(size * studio.textScale));
    setFont(size);
    lines = wrapWords(label, a.maxW, (s) => ctx.measureText(s).width);
  }
  const lineH = size * 1.02;
  const blockH = lines.length * lineH;
  const hasKick = !!kicker;
  const top = a.cy - blockH / 2 + (hasKick && label ? 26 : 0) + studio.textDy;
  const left = a.x + studio.textDx;
  const anchorX = left; // the left edge for "left", the centre for "center"

  let regionX = anchorX, regionW = 0;
  const regionTop = top - (hasKick && label ? 70 : 0);

  if (kicker) {
    const ky = label ? top - 36 : a.cy + studio.textDy;
    ctx.font = `700 28px ${o.family}`;
    ctx.letterSpacing = "5px";
    const kw = ctx.measureText(kicker).width;
    const kx = align === "center" ? anchorX - (kw + 22) / 2 : anchorX;
    ctx.fillStyle = o.style.accent;
    ctx.beginPath();
    ctx.roundRect(kx, ky - 26, 6, 32, 3);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.save();
    if (onPhoto) { ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 16; }
    ctx.fillText(kicker, kx + 22, ky);
    ctx.restore();
    regionX = kx;
    regionW = kw + 22;
    if (label) setFont(size);
  }

  if (!label) return { region: { id: "headline", x: regionX, y: regionTop, w: Math.max(regionW, 40), h: 60 }, bottom: top };

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.shadowColor = onPhoto ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.55)";
  ctx.shadowBlur = onPhoto ? 36 : 28;
  ctx.shadowOffsetY = 8;
  const space = ctx.measureText(" ").width;
  let wordIdx = 0;
  let minX = Infinity, maxX = -Infinity;
  lines.forEach((ln, li) => {
    const ws = ln.split(" ");
    const lineW = ctx.measureText(ln).width;
    let x = align === "center" ? anchorX - lineW / 2 : anchorX;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + lineW);
    const y = top + li * lineH + size * 0.82;
    for (const w of ws) {
      const hit = a.accentAll || wordIdx === a.accentIdx;
      const ww = ctx.measureText(w).width;
      if (hit && studio.highlight === "box") {
        ctx.save();
        ctx.shadowColor = "transparent";
        ctx.fillStyle = o.style.accent;
        ctx.beginPath();
        ctx.roundRect(x - 14, y - size * 0.86, ww + 28, size * 1.04, 14);
        ctx.fill();
        ctx.restore();
      }
      if (studio.outline > 0) {
        ctx.save();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = studio.outline * 2;
        ctx.strokeText(w, x, y);
        ctx.restore();
      }
      ctx.fillStyle = hit ? (studio.highlight === "box" ? (luminance(o.style.accent) > 0.4 ? DARK : "#ffffff") : o.style.accent) : o.style.text;
      ctx.fillText(w, x, y);
      x += ww + space;
      wordIdx++;
    }
  });
  ctx.restore();

  // short accent rule under the headline
  const ruleX = align === "center" ? anchorX - 48 : anchorX;
  ctx.fillStyle = o.style.accent;
  ctx.beginPath();
  ctx.roundRect(ruleX, top + blockH + 14, 96, 8, 4);
  ctx.fill();

  const rx = Math.min(regionX, minX) - 16;
  const rw = Math.max(maxX, regionX + regionW) - rx + 16;
  return { region: { id: "headline", x: rx, y: regionTop, w: rw, h: top + blockH + 30 - regionTop }, bottom: top + blockH + 22 };
}

// ---- extras ---------------------------------------------------------------------------------------

function drawBadge(ctx: Ctx, o: DrawOpts, studio: Studio): Region | null {
  const t = studio.badgeText.trim().toUpperCase();
  if (!studio.badgeOn || !t) return null;
  const f = headlineFont(o, { ...studio, font: "inter" });
  ctx.save();
  ctx.font = `${f.weight} 38px ${f.family}`;
  ctx.letterSpacing = "2px";
  const tw = ctx.measureText(t).width;
  const w = tw + 56, h = 70;
  const cx = studio.badgePos.x * W, cy = studio.badgePos.y * H;
  ctx.translate(cx, cy);
  ctx.rotate((-4 * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = o.style.accent;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 16);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = luminance(o.style.accent) > 0.4 ? DARK : "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t, 0, 3);
  ctx.restore();
  return { id: "badge", x: cx - w / 2, y: cy - h / 2, w, h };
}

function drawCallout(ctx: Ctx, studio: Studio): Region | null {
  if (studio.callout === "none") return null;
  const cx = studio.calloutPos.x * W, cy = studio.calloutPos.y * H;
  const s = studio.calloutSize;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 14;
  if (studio.callout === "circle") {
    const rx = 130 * s, ry = 92 * s;
    for (const [w, c] of [[22 * s, "#ffffff"], [12 * s, "#ff2d2d"]] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return { id: "callout", x: cx - rx - 14, y: cy - ry - 14, w: rx * 2 + 28, h: ry * 2 + 28 };
  }
  ctx.rotate((studio.calloutRot * Math.PI) / 180);
  const len = 190 * s, head = 62 * s;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.lineTo(len / 2 - head * 0.6, 0);
    ctx.moveTo(len / 2, 0);
    ctx.lineTo(len / 2 - head, -head * 0.62);
    ctx.moveTo(len / 2, 0);
    ctx.lineTo(len / 2 - head, head * 0.62);
  };
  for (const [w, c] of [[26 * s, "#ffffff"], [15 * s, "#ff2d2d"]] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    path();
    ctx.stroke();
  }
  ctx.restore();
  const r = (len / 2 + 24) * 1; // a square box around the arrow is close enough for grabbing
  return { id: "callout", x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
}

// ---- the cover ------------------------------------------------------------------------------------

/** Draws the whole cover and returns the regions the creator can grab and move. */
export function drawCover(canvas: HTMLCanvasElement, o: DrawOpts): Region[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const studio = o.studio ?? DEFAULT_STUDIO;
  const { style } = o;
  const label = o.text.trim().toUpperCase();
  const kicker = o.kicker.trim().toUpperCase();
  const hasText = label.length > 0 || kicker.length > 0;
  const regions: Region[] = [];
  // When the creator brings an image, that image IS the cover: no glow, no vignette, no panels on top of it.
  const wholePhoto = !!o.photo && (o.layout === "full" || o.layout === "fit");
  const versus = studio.template === "versus" ? splitVersus(label) : null;
  const template = studio.template === "versus" && !versus ? "classic" : studio.template;

  drawBackground(ctx, style, studio, wholePhoto);

  if (o.photo && wholePhoto) {
    regions.push(drawWholePhoto(ctx, o.photo, o.layout === "fit" ? "fit" : "full", studio));
    if (hasText && o.darken > 0) {
      // darken only the side the text sits on, so the image stays as untouched as possible
      const scrim = ctx.createLinearGradient(0, 0, W * 0.78, 0);
      scrim.addColorStop(0, `rgba(0,0,0,${(o.darken * 0.95).toFixed(2)})`);
      scrim.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, W, H);
    }
  } else if (o.photo) {
    if (studio.blurBackdrop && o.layout === "framed") {
      ctx.save();
      ctx.filter = "blur(36px) brightness(0.55)";
      const b = fitBox(o.photo, -80, -80, W + 160, H + 160, { ...studio, photoZoom: 1, photoDx: 0, photoDy: 0 });
      ctx.drawImage(o.photo, b.x, b.y, b.w, b.h);
      ctx.restore();
    }
    regions.push(o.layout === "framed" ? drawFramedPhoto(ctx, o.photo, style, studio) : drawSidePhoto(ctx, o.photo, studio));
  } else if (o.stats && (template === "classic")) {
    drawStats(ctx, o, o.stats);
  }

  if (!wholePhoto) {
    // vignette keeps the eye in the middle
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  if (hasText) {
    const onPhoto = wholePhoto;
    if (versus) {
      // two sides split on a diagonal, with a VS badge where they meet
      if (!o.photo) {
        ctx.fillStyle = withAlpha(style.accent, 0.2);
        ctx.beginPath();
        ctx.moveTo(W * 0.54, 0);
        ctx.lineTo(W, 0);
        ctx.lineTo(W, H);
        ctx.lineTo(W * 0.46, H);
        ctx.closePath();
        ctx.fill();
      }
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(W * 0.54, 0);
      ctx.lineTo(W * 0.46, H);
      ctx.stroke();
      ctx.restore();
      const left = drawHeadline({ ctx, o, studio, label: versus[0], kicker: "", x: W * 0.245, align: "center", maxW: 430, maxSize: 130, maxLines: 3, maxH: 360, onPhoto, cy: H / 2, accentIdx: -1 });
      const right = drawHeadline({ ctx, o, studio, label: versus[1], kicker: "", x: W * 0.755, align: "center", maxW: 430, maxSize: 130, maxLines: 3, maxH: 360, onPhoto, cy: H / 2, accentIdx: 0, accentAll: true });
      if (left) regions.push(left.region);
      if (right) regions.push({ ...right.region, id: "headline" });
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 76, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = style.accent;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 64, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = luminance(style.accent) > 0.4 ? DARK : "#ffffff";
      ctx.font = `900 62px ${o.family}`;
      ctx.letterSpacing = "0px";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("VS", W / 2, H / 2 + 3);
      ctx.restore();
    } else if (template === "center") {
      const b = drawHeadline({ ctx, o, studio, label, kicker, x: W / 2, align: "center", maxW: 1100, maxSize: 190, maxLines: 3, maxH: 470, onPhoto, cy: H / 2, accentIdx: o.accentIdx });
      if (b) regions.push(b.region);
    } else if (template === "number" && o.stats) {
      const head = drawHeadline({ ctx, o, studio, label, kicker, x: PAD, align: "left", maxW: 900, maxSize: 92, maxLines: 2, maxH: 220, onPhoto, cy: 190, accentIdx: o.accentIdx });
      if (head) regions.push(head.region);
      // the hero number
      const big = o.stats.views;
      let ns = 320;
      ctx.font = `900 ${ns}px ${o.family}`;
      while (ns > 120 && ctx.measureText(big).width > 1000) { ns -= 10; ctx.font = `900 ${ns}px ${o.family}`; }
      ctx.save();
      ctx.letterSpacing = `${-Math.round(ns * 0.03)}px`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.shadowColor = onPhoto ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = style.accent;
      ctx.fillText(big, PAD - 6, 590);
      ctx.restore();
      ctx.font = `600 30px ${o.family}`;
      ctx.letterSpacing = "6px";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.textAlign = "left";
      ctx.fillText("VIEWS THIS WEEK", PAD, 640);
    } else {
      const maxW = wholePhoto ? 720 : o.photo && o.layout === "framed" ? 520 : o.photo || o.stats ? 640 : 1000;
      const b = drawHeadline({ ctx, o, studio, label, kicker, x: PAD, align: "left", maxW, maxSize: 156, maxLines: 3, maxH: 430, onPhoto, cy: H / 2, accentIdx: o.accentIdx });
      if (b) regions.push(b.region);
    }
  }

  const badge = drawBadge(ctx, o, studio);
  if (badge) regions.push(badge);
  const callout = drawCallout(ctx, studio);
  if (callout) regions.push(callout);
  return regions;
}
