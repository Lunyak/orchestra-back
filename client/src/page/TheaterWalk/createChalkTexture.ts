import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import type { SiteEvent } from "../../shared/model/siteContent";

const CHALK_FONT_FAMILY = "Chalkduster";
const CHALK_FONT_STACK = `"${CHALK_FONT_FAMILY}", "Segoe UI", Arial, sans-serif`;
const CHALK_FONT_URL = "/theater/fonts/Chalkduster.ttf";

const CHALK = "245, 238, 220";
const CHALK_DIM = "205, 198, 182";

let chalkFontReady: Promise<string> | null = null;

export function ensureChalkFont(): Promise<string> {
  if (typeof document === "undefined") return Promise.resolve(CHALK_FONT_STACK);
  if (!chalkFontReady) {
    const face = new FontFace(CHALK_FONT_FAMILY, `url(${CHALK_FONT_URL})`, {
      style: "normal",
      weight: "400",
      display: "swap",
    });
    chalkFontReady = face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        return document.fonts.load(`48px ${CHALK_FONT_STACK}`);
      })
      .then(() => CHALK_FONT_STACK)
      .catch(() => CHALK_FONT_STACK);
  }
  return chalkFontReady;
}

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function paintWall(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);
}

function drawChalkText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  rand: () => number,
  opts?: { color?: string; maxWidth?: number }
) {
  const color = opts?.color ?? CHALK;
  const maxWidth = opts?.maxWidth;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  let cursorX = x;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (maxWidth != null && cursorX - x > maxWidth) break;

    const glyphSize = size * (0.96 + rand() * 0.08);
    const rot = (rand() - 0.5) * 0.05;
    const dy = (rand() - 0.5) * size * 0.05;

    ctx.save();
    ctx.translate(cursorX, y + dy);
    ctx.rotate(rot);
    ctx.font = `${glyphSize}px ${CHALK_FONT_STACK}`;

    // Soft chalk dust under glyph
    for (let p = 0; p < 3; p += 1) {
      ctx.globalAlpha = 0.12 + rand() * 0.18;
      ctx.fillStyle = `rgb(${color})`;
      ctx.fillText(ch, (rand() - 0.5) * 2, (rand() - 0.5) * 2);
    }

    ctx.globalAlpha = 0.88 + rand() * 0.12;
    ctx.fillStyle = `rgb(${color})`;
    ctx.fillText(ch, 0, 0);

    const advance = ctx.measureText(ch).width * (0.96 + rand() * 0.06);
    ctx.restore();

    const dustN = 4 + Math.floor(rand() * 10);
    for (let d = 0; d < dustN; d += 1) {
      ctx.globalAlpha = 0.1 + rand() * 0.28;
      ctx.fillStyle = `rgb(${color})`;
      ctx.fillRect(
        cursorX + rand() * Math.max(advance, 4),
        y - rand() * glyphSize * 0.85,
        1 + rand() * 1.5,
        1
      );
    }

    cursorX += advance;
  }

  ctx.globalAlpha = 1;
  return cursorX - x;
}

function isVassaEvent(event: SiteEvent) {
  const slug = (event.slug || "").toLowerCase();
  const name = (event.name || "").toLowerCase();
  return slug.includes("железнов") || name.includes("железнов") || name.includes("васса");
}

/** Slavic solar mark (alatyr / sun-wheel) — chalk ethno-underground doodle */
function drawChalkSolarSign(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rand: () => number
) {
  const color = CHALK;
  const strokePasses = (draw: () => void) => {
    for (let p = 0; p < 3; p += 1) {
      ctx.save();
      ctx.translate((rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4);
      ctx.strokeStyle = `rgba(${color},${0.35 + rand() * 0.45})`;
      ctx.lineWidth = 1.6 + rand() * 1.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      draw();
      ctx.restore();
    }
  };

  // Outer ring
  strokePasses(() => {
    ctx.beginPath();
    const steps = 28;
    for (let i = 0; i <= steps; i += 1) {
      const a = (i / steps) * Math.PI * 2;
      const wobble = 1 + (rand() - 0.5) * 0.06;
      const x = cx + Math.cos(a) * radius * wobble;
      const y = cy + Math.sin(a) * radius * wobble;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  });

  // Eight solar rays through center
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + (rand() - 0.5) * 0.04;
    const inner = radius * 0.18;
    const outer = radius * (0.88 + rand() * 0.1);
    strokePasses(() => {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
    });
  }

  // Inner diamond (alatyr core)
  strokePasses(() => {
    const r = radius * 0.38;
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const a = -Math.PI / 2 + (i / 4) * Math.PI * 2 + (rand() - 0.5) * 0.05;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  });

  // Center dot
  ctx.fillStyle = `rgba(${color},${0.7 + rand() * 0.25})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.2 + rand(), 0, Math.PI * 2);
  ctx.fill();

  // Dust around mark
  for (let i = 0; i < 28; i += 1) {
    const a = rand() * Math.PI * 2;
    const d = radius * (0.7 + rand() * 0.55);
    ctx.fillStyle = `rgba(${color},${rand() * 0.35})`;
    ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + rand(), 1);
  }
}

function drawChalkLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rand: () => number
) {
  const strokes = 2 + Math.floor(rand() * 2);
  for (let s = 0; s < strokes; s += 1) {
    ctx.strokeStyle = `rgba(${CHALK_DIM},${0.25 + rand() * 0.4})`;
    ctx.lineWidth = 0.8 + rand() * 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    const yOff = (rand() - 0.5) * 3;
    ctx.moveTo(x0 + rand() * 3, y0 + yOff);
    const steps = 18 + Math.floor(rand() * 10);
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      if (rand() < 0.08) continue;
      ctx.lineTo(
        x0 + (x1 - x0) * t + (rand() - 0.5) * 4,
        y0 + (y1 - y0) * t + yOff + (rand() - 0.5) * 3
      );
    }
    ctx.stroke();
  }

  for (let i = 0; i < 40; i += 1) {
    const t = rand();
    ctx.fillStyle = `rgba(${CHALK_DIM},${rand() * 0.35})`;
    ctx.fillRect(x0 + (x1 - x0) * t, y0 + 2 + rand() * 6, 1 + rand() * 2, 1);
  }
}

export function createChalkTexture(events: SiteEvent[]): CanvasTexture {
  const width = 1600;
  const height = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);

  const rand = seededRandom(91 + events.length * 13);
  paintWall(ctx, width, height);

  drawChalkText(ctx, "АФИША", 90, 140, 100, rand);
  drawChalkText(ctx, "театр «Дофамин»", 96, 205, 38, rand, { color: CHALK_DIM });
  drawChalkLine(ctx, 90, 235, 560, 242, rand);

  const rows = events.slice(0, 7);
  let y = 320;
  const left = 90;
  const right = width - 100;

  rows.forEach((event) => {
    const title = (event.name || "Спектакль").trim();
    const date = event.soon
      ? "скоро"
      : (event.date || "").trim() || "дата уточняется";
    const showSolar = isVassaEvent(event);

    const lineY = y + (rand() - 0.5) * 6;
    const solarGap = showSolar ? 70 : 0;
    const titleX = left + solarGap;
    const titleMax = right - titleX - 280;

    if (showSolar) {
      drawChalkSolarSign(ctx, left + 26, lineY - 14, 26, rand);
    }

    drawChalkText(ctx, title, titleX, lineY, 48, rand, { maxWidth: titleMax });

    ctx.font = `36px ${CHALK_FONT_STACK}`;
    const dateW = ctx.measureText(date).width;
    drawChalkText(ctx, date, right - dateW - 10, lineY, 36, rand, { color: CHALK_DIM });

    drawChalkLine(ctx, left, lineY + 30, right, lineY + 36 + (rand() - 0.5) * 4, rand);
    y += 94;
  });

  if (!rows.length) {
    drawChalkText(ctx, "афиша загружается…", left, 360, 44, rand);
  }

  drawChalkText(ctx, "билеты — на странице спектакля", 90, height - 70, 30, rand, {
    color: CHALK_DIM,
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
