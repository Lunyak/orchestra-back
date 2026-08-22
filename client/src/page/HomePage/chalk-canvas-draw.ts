const CHALK = "245, 238, 220";
const CHALK_DIM = "205, 198, 182";

export function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pointRand(seed: number, index: number) {
  return seededRandom(seed + index * 991)();
}

export function easeOutCubic(t: number) {
  const c = 1 - Math.max(0, Math.min(1, t));
  return 1 - c * c * c;
}

type ChalkIntensity = "grid" | "mark";

type ChalkLineOptions = {
  intensity?: ChalkIntensity;
};

function chalkDust(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  spread: number,
  seed: number
) {
  for (let i = 0; i < count; i += 1) {
    const r = pointRand(seed, i);
    const r2 = pointRand(seed + 17, i);
    const r3 = pointRand(seed + 33, i);
    ctx.fillStyle = `rgba(${CHALK_DIM},${0.1 + r * 0.38})`;
    ctx.fillRect(
      x + (r2 - 0.5) * spread,
      y + (r3 - 0.5) * spread,
      1 + r * 2,
      1
    );
  }
}

function chalkTipSmudge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
  size: number
) {
  const puffs = 6 + Math.floor(pointRand(seed, 0) * 8);
  for (let i = 0; i < puffs; i += 1) {
    const r = pointRand(seed, i + 1);
    const angle = pointRand(seed, i + 2) * Math.PI * 2;
    const dist = r * size * 0.45;
    const puffX = x + Math.cos(angle) * dist;
    const puffY = y + Math.sin(angle) * dist;
    ctx.fillStyle = `rgba(${CHALK_DIM},${0.12 + r * 0.28})`;
    ctx.fillRect(puffX, puffY, 1 + r * 2.5, 1 + r);
  }
}

function chalkDustAlongPath(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  progress: number,
  seed: number,
  spread: number
) {
  const samples = Math.floor(28 * progress);
  for (let i = 0; i < samples; i += 1) {
    const t = (i / Math.max(1, samples - 1)) * progress;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    const n = 1 + Math.floor(pointRand(seed, i) * 3);
    chalkDust(ctx, px, py, n, spread, seed + i * 3);
  }
}

export function drawChalkLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  seed: number,
  progress = 1,
  options?: ChalkLineOptions
) {
  const intensity = options?.intensity ?? "grid";
  const isMark = intensity === "mark";
  const endT = Math.max(0, Math.min(1, progress));
  if (endT <= 0) return;

  const strokeLayers = isMark ? 4 + Math.floor(pointRand(seed, 99) * 2) : 2 + Math.floor(pointRand(seed, 0) * 2);
  const tipX = x0 + (x1 - x0) * endT;
  const tipY = y0 + (y1 - y0) * endT;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let s = 0; s < strokeLayers; s += 1) {
    const yOff = (pointRand(seed, s + 1) - 0.5) * (isMark ? 3.2 : 2.2);
    const alpha = isMark ? 0.18 + pointRand(seed, s + 2) * 0.28 : 0.22 + pointRand(seed, s + 2) * 0.35;
    const width = isMark
      ? 2.4 + pointRand(seed, s + 3) * 3.6
      : 1 + pointRand(seed, s + 3) * 2;

    ctx.shadowBlur = isMark ? 5 : 2;
    ctx.shadowColor = `rgba(${CHALK_DIM}, 0.28)`;
    ctx.strokeStyle = `rgba(${isMark ? CHALK : CHALK_DIM},${alpha})`;
    ctx.lineWidth = width;
    ctx.beginPath();

    const steps = isMark ? 32 + Math.floor(pointRand(seed, s + 4) * 14) : 22 + Math.floor(pointRand(seed, s + 4) * 10);
    const visibleSteps = Math.max(1, Math.floor(steps * endT));

    ctx.moveTo(x0 + pointRand(seed, s + 5) * 2.5, y0 + yOff);
    for (let i = 1; i <= visibleSteps; i += 1) {
      const t = i / steps;
      const skip = pointRand(seed, s * 50 + i);
      if (skip < 0.06) continue;
      ctx.lineTo(
        x0 + (x1 - x0) * t + (pointRand(seed, s * 50 + i + 10) - 0.5) * (isMark ? 4.5 : 3),
        y0 + (y1 - y0) * t + yOff + (pointRand(seed, s * 50 + i + 20) - 0.5) * (isMark ? 3.5 : 2.5)
      );
    }
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  chalkDustAlongPath(ctx, x0, y0, x1, y1, endT, seed + 200, isMark ? 14 : 8);

  if (endT < 1) {
    chalkTipSmudge(ctx, tipX, tipY, seed + 400, isMark ? 10 : 6);
  }

  if (isMark && endT >= 1) {
    chalkDust(ctx, tipX, tipY, 14 + Math.floor(pointRand(seed, 500) * 10), 16, seed + 600);
    chalkDust(ctx, x0, y0, 6, 8, seed + 610);
    chalkDust(ctx, x1, y1, 6, 8, seed + 620);
  }

  ctx.restore();
}

function drawChalkStrokePasses(
  ctx: CanvasRenderingContext2D,
  draw: () => void,
  seed: number,
  passes = 3
) {
  const passCount = Math.max(1, passes);
  for (let p = 0; p < passCount; p += 1) {
    ctx.save();
    if (passCount > 1) {
      ctx.translate((pointRand(seed, p + 1) - 0.5) * 2.2, (pointRand(seed, p + 2) - 0.5) * 2.2);
    }
    draw();
    ctx.restore();
  }
}

function splitXProgress(raw: number) {
  const t = Math.max(0, Math.min(1, raw));
  const line1End = 0.38;
  const pauseEnd = 0.46;

  if (t <= line1End) {
    return { first: easeOutCubic(t / line1End), second: 0 };
  }
  if (t <= pauseEnd) {
    return { first: 1, second: 0 };
  }

  const secondT = (t - pauseEnd) / (1 - pauseEnd);
  return { first: 1, second: easeOutCubic(secondT) };
}

function chalkDustAlongArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  sweep: number,
  seed: number,
  spread: number
) {
  const samples = Math.max(4, Math.floor(36 * (sweep / (Math.PI * 2))));
  for (let i = 0; i < samples; i += 1) {
    const t = samples <= 1 ? 0 : i / (samples - 1);
    const angle = startAngle + sweep * t;
    const wobbleR = radius * (0.88 + pointRand(seed, i) * 0.22);
    const px = cx + Math.cos(angle) * wobbleR;
    const py = cy + Math.sin(angle) * wobbleR;
    const n = 1 + Math.floor(pointRand(seed, i + 50) * 4);
    chalkDust(ctx, px, py, n, spread, seed + i * 5);
  }
}

function drawChalkCircleArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  startAngle: number,
  sweep: number,
  strokeLayers: number
) {
  if (sweep <= 0) return;

  const steps = 58 + Math.floor(pointRand(seed, 0) * 14);
  const rx = radius * (1 + (pointRand(seed, 1) - 0.5) * 0.1);
  const ry = radius * (1 + (pointRand(seed, 2) - 0.5) * 0.1);

  for (let layer = 0; layer < strokeLayers; layer += 1) {
    const layerSeed = seed + layer * 173;
    const layerRx = rx * (0.95 + pointRand(layerSeed, 3) * 0.08);
    const layerRy = ry * (0.95 + pointRand(layerSeed, 4) * 0.08);
    const tilt = (pointRand(layerSeed, 5) - 0.5) * 0.14;

    ctx.save();
    ctx.translate((pointRand(layerSeed, 6) - 0.5) * 2.8, (pointRand(layerSeed, 7) - 0.5) * 2.8);
    ctx.shadowBlur = 5;
    ctx.shadowColor = `rgba(${CHALK_DIM}, 0.32)`;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = `rgba(${CHALK},${0.2 + pointRand(layerSeed, 8) * 0.38})`;
    ctx.lineWidth = 2.4 + pointRand(layerSeed, 9) * 4.2;

    ctx.beginPath();
    let hasPath = false;

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const angle = startAngle + sweep * t + tilt;
      const gap = pointRand(layerSeed, i + 20);

      if (gap < 0.06) {
        if (hasPath) {
          ctx.stroke();
          ctx.beginPath();
          hasPath = false;
        }
        continue;
      }

      const wobble = 1 + (pointRand(layerSeed, i + 40) - 0.5) * 0.12;
      const x = cx + Math.cos(angle) * layerRx * wobble;
      const y = cy + Math.sin(angle) * layerRy * wobble;

      if (!hasPath) {
        ctx.moveTo(x, y);
        hasPath = true;
      } else {
        ctx.lineTo(x, y);
      }
    }

    if (hasPath) ctx.stroke();
    ctx.restore();
  }
}

function splitOProgress(raw: number) {
  const t = Math.max(0, Math.min(1, raw));
  const drawEnd = 0.78;
  const pauseEnd = 0.84;

  if (t <= drawEnd) {
    const p = easeOutCubic(t / drawEnd);
    return { sweep: p * 0.88, close: 0 };
  }
  if (t <= pauseEnd) {
    return { sweep: 0.88, close: 0 };
  }

  const closeT = easeOutCubic((t - pauseEnd) / (1 - pauseEnd));
  return { sweep: 0.88 + closeT * 0.12, close: closeT };
}

const MARK_LINE = { intensity: "mark" as ChalkIntensity };

export function drawChalkX(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  half: number,
  seed: number,
  progress = 1,
  layerPasses = 3
) {
  const x0 = cx - half;
  const y0 = cy - half;
  const x1 = cx + half;
  const y1 = cy + half;
  const { first, second } = splitXProgress(progress);

  drawChalkStrokePasses(
    ctx,
    () => drawChalkLine(ctx, x0, y0, x1, y1, seed + 1, first, MARK_LINE),
    seed + 2,
    layerPasses
  );

  if (second > 0) {
    drawChalkStrokePasses(
      ctx,
      () => drawChalkLine(ctx, x1, y0, x0, y1, seed + 3, second, MARK_LINE),
      seed + 4,
      layerPasses
    );
  }

  if (progress >= 1) {
    chalkDust(ctx, cx, cy, 24 + Math.floor(pointRand(seed, 6) * 12), half * 1.6, seed + 6);
  } else {
    chalkDust(ctx, cx, cy, Math.floor(10 * progress), half * 1.2, seed + 6);
  }
}

export function drawChalkO(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  progress = 1,
  layerPasses = 3
) {
  const startAngle = -Math.PI / 2;
  const fullTurn = Math.PI * 2;
  const split = splitOProgress(progress);
  const sweep = fullTurn * split.sweep;

  if (progress >= 1) {
    const loops = layerPasses + 3;
    for (let loop = 0; loop < loops; loop += 1) {
      const loopRadius = radius * (0.96 + pointRand(seed, loop + 30) * 0.07);
      drawChalkCircleArc(ctx, cx, cy, loopRadius, seed + loop * 23, startAngle, fullTurn, 1);
    }

    chalkDustAlongArc(ctx, cx, cy, radius, startAngle, fullTurn, seed + 7, 20);
    chalkDust(ctx, cx, cy, 32 + Math.floor(pointRand(seed, 8) * 16), radius * 1.85, seed + 9);
    return;
  }

  if (sweep > 0) {
    drawChalkCircleArc(ctx, cx, cy, radius, seed, startAngle, sweep, 2);
    chalkDustAlongArc(ctx, cx, cy, radius, startAngle, sweep, seed + 10, 14);

    const tipAngle = startAngle + sweep;
    const tipR = radius * (0.92 + pointRand(seed, 11) * 0.14);
    const tipX = cx + Math.cos(tipAngle) * tipR;
    const tipY = cy + Math.sin(tipAngle) * tipR;
    chalkTipSmudge(ctx, tipX, tipY, seed + 12, 16);
  }

  if (split.close > 0) {
    const overlapStart = startAngle + fullTurn * 0.84;
    const overlapSweep = fullTurn * 0.16 * split.close;
    const closeRadius = radius * (0.94 + pointRand(seed, 13) * 0.08);
    drawChalkCircleArc(ctx, cx, cy, closeRadius, seed + 200, overlapStart, overlapSweep, 2);
    chalkTipSmudge(ctx, cx, cy - radius * 0.92, seed + 14, 12);
    chalkDust(ctx, cx, cy - radius * 0.95, 8, 10, seed + 15);
  }
}

export function drawChalkGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  progress = 1
) {
  const v1 = width / 3;
  const v2 = (width * 2) / 3;
  const h1 = height / 3;
  const h2 = (height * 2) / 3;
  const inset = 2;

  const segments = [
    [v1, inset, v1, height - inset],
    [v2, inset, v2, height - inset],
    [inset, h1, width - inset, h1],
    [inset, h2, width - inset, h2],
  ] as const;

  const segmentProgress = easeOutCubic(progress) * segments.length;

  segments.forEach(([x0, y0, x1, y1], index) => {
    const local = Math.max(0, Math.min(1, segmentProgress - index));
    if (local <= 0) return;
    drawChalkLine(ctx, x0, y0, x1, y1, seed + index * 11, local);
  });
}

const NEON_CYAN = "0, 251, 255";
const NEON_CORE = "210, 255, 255";

function traceLogoTrianglePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  height: number
) {
  const width = height * 1.167;
  const topY = cy - height * 0.5;
  const bottomY = cy + height * 0.5;
  const leftX = cx - width * 0.5;
  const rightX = cx + width * 0.5;

  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(rightX, bottomY);
  ctx.lineTo(leftX, bottomY);
  ctx.closePath();
}

function drawNeonTriangleSparks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  height: number,
  seed: number,
  intensity: number
) {
  const width = height * 1.167;
  const topY = cy - height * 0.5;
  const bottomY = cy + height * 0.5;
  const leftX = cx - width * 0.5;
  const rightX = cx + width * 0.5;
  const corners = [
    [cx, topY],
    [rightX, bottomY],
    [leftX, bottomY],
  ];

  const sparkCount = Math.floor(28 * intensity);

  for (let i = 0; i < sparkCount; i += 1) {
    const edge = i % 3;
    const edgeT = pointRand(seed, i);
    const [ax, ay] = corners[edge];
    const [bx, by] = corners[(edge + 1) % 3];
    const px = ax + (bx - ax) * edgeT;
    const py = ay + (by - ay) * edgeT;
    const spread = 3 + pointRand(seed, i + 40) * 10;
    const alpha = (0.15 + pointRand(seed, i + 80) * 0.55) * intensity;
    const sx = px + (pointRand(seed, i + 120) - 0.5) * spread;
    const sy = py + (pointRand(seed, i + 160) - 0.5) * spread;
    const sparkW = 1 + pointRand(seed, i + 200) * 2.2;

    ctx.fillStyle = `rgba(${NEON_CYAN}, ${alpha})`;
    ctx.fillRect(sx, sy, sparkW, 1);
  }
}

export function drawNeonLogoTriangle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  progress = 1,
  seed = 911
) {
  const t = easeOutCubic(Math.max(0, Math.min(1, progress)));
  const height = size * (0.25 + t * 0.75);

  ctx.save();
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";

  traceLogoTrianglePath(ctx, cx, cy, height);

  const bloomPasses = [
    { blur: 32, alpha: 0.12, width: 9 },
    { blur: 22, alpha: 0.2, width: 6.5 },
    { blur: 14, alpha: 0.35, width: 5 },
  ];

  for (const pass of bloomPasses) {
    ctx.shadowBlur = pass.blur * t;
    ctx.shadowColor = `rgba(${NEON_CYAN}, ${pass.alpha * t})`;
    ctx.strokeStyle = `rgba(${NEON_CYAN}, ${pass.alpha * 0.65 * t})`;
    ctx.lineWidth = pass.width * t;
    traceLogoTrianglePath(ctx, cx, cy, height);
    ctx.stroke();
  }

  ctx.shadowBlur = 18 * t;
  ctx.shadowColor = `rgba(${NEON_CYAN}, ${0.55 * t})`;
  ctx.fillStyle = `rgba(${NEON_CYAN}, ${0.04 * t})`;
  traceLogoTrianglePath(ctx, cx, cy, height);
  ctx.fill();

  ctx.shadowBlur = 12 * t;
  ctx.shadowColor = `rgba(${NEON_CYAN}, ${0.9 * t})`;
  ctx.strokeStyle = `rgba(${NEON_CYAN}, ${0.92 * t})`;
  ctx.lineWidth = 5 * t;
  traceLogoTrianglePath(ctx, cx, cy, height);
  ctx.stroke();

  ctx.shadowBlur = 5 * t;
  ctx.shadowColor = `rgba(${NEON_CORE}, ${0.85 * t})`;
  ctx.strokeStyle = `rgba(${NEON_CORE}, ${0.95 * t})`;
  ctx.lineWidth = 1.8 * t;
  traceLogoTrianglePath(ctx, cx, cy, height);
  ctx.stroke();

  if (t > 0.15) {
    const sparkIntensity = ((t - 0.15) / 0.85) * t;
    ctx.shadowBlur = 8;
    ctx.shadowColor = `rgba(${NEON_CYAN}, 0.6)`;
    drawNeonTriangleSparks(ctx, cx, cy, height, seed + 700, sparkIntensity);
  }

  ctx.restore();
}
