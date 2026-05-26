import type { TheaterLayout, TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import {
  buildAudienceBoundaryPlanLine,
  buildSpotlightWashPlanLine,
  buildFloorPlanGridLines,
  buildModelFootprints,
  createFloorPlanViewport,
  enumerateSeatPositions,
  getFloorPlanHallLayout,
  worldLengthToPlanPx,
  worldToPlanPoint,
} from "./theater-floor-plan-geometry";

export type FloorPlanExportOptions = {
  layout: TheaterLayout;
  models: TheaterModel[];
  spotlights: TheaterSpotlight[];
  showSeats: boolean;
  showSpotlights: boolean;
  showGrid: boolean;
  gridStep: number;
  width?: number;
  height?: number;
  title?: string;
};

const DEFAULT_EXPORT_SIZE = { width: 420, height: 340 };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildFloorPlanSvg(options: FloorPlanExportOptions): string {
  const width = options.width ?? DEFAULT_EXPORT_SIZE.width;
  const height = options.height ?? DEFAULT_EXPORT_SIZE.height;
  const viewport = createFloorPlanViewport(width, height);
  const { layout, models, spotlights, showSeats, showSpotlights, showGrid, gridStep } =
    options;

  const hall = getFloorPlanHallLayout(layout, viewport);
  const hallPath = [
    [hall.offsetX, hall.offsetY],
    [hall.offsetX + hall.drawW, hall.offsetY],
    [hall.offsetX + hall.drawW, hall.offsetY + hall.drawH],
    [hall.offsetX, hall.offsetY + hall.drawH],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  const parts: string[] = [];
  parts.push(
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#f4f4f5"/>`,
  );
  parts.push(
    `<polygon points="${hallPath}" fill="#e8e8ea" stroke="#9ca3af" stroke-width="1.5"/>`,
  );

  if (showGrid && gridStep > 0) {
    for (const line of buildFloorPlanGridLines(layout, viewport, gridStep)) {
      const stroke = line.major ? "#9ca3af" : "#d1d5db";
      const strokeWidth = line.major ? 0.75 : 0.5;
      parts.push(
        `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
      );
    }
  }

  parts.push(
    `<text x="${hall.offsetX + hall.drawW / 2}" y="${hall.offsetY + 12}" text-anchor="middle" font-size="10" fill="#6b7280">Сцена</text>`,
  );

  const audienceLine = buildAudienceBoundaryPlanLine(layout, viewport);
  parts.push(
    `<line x1="${audienceLine.x1}" y1="${audienceLine.y1}" x2="${audienceLine.x2}" y2="${audienceLine.y2}" stroke="#6366f1" stroke-width="2" stroke-dasharray="6 4"/>`,
  );

  const washLine = showSpotlights ? buildSpotlightWashPlanLine(layout, viewport) : null;
  if (washLine) {
    parts.push(
      `<line x1="${washLine.x1}" y1="${washLine.y1}" x2="${washLine.x2}" y2="${washLine.y2}" stroke="#2563eb" stroke-width="2" stroke-dasharray="3 5"/>`,
    );
  }

  if (showSeats) {
    for (const [x, z] of enumerateSeatPositions(layout)) {
      const [sx, sy] = worldToPlanPoint(x, z, layout, viewport);
      parts.push(
        `<rect x="${sx - 2}" y="${sy - 2}" width="4" height="4" rx="1" fill="#d1d5db"/>`,
      );
    }
  }

  if (showSpotlights) {
    for (const item of spotlights) {
      const [sx, sy] = worldToPlanPoint(
        item.position[0],
        item.position[2],
        layout,
        viewport,
      );
      const [tx, ty] = worldToPlanPoint(
        item.target[0],
        item.target[2],
        layout,
        viewport,
      );
      parts.push(
        `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="#f59e0b" stroke-width="1" opacity="0.7"/>`,
        `<circle cx="${tx}" cy="${ty}" r="3.5" fill="#fbbf24"/>`,
        `<circle cx="${sx}" cy="${sy}" r="4.5" fill="#f97316"/>`,
      );
    }
  }

  for (const item of buildModelFootprints(models)) {
    const [sx, sy] = worldToPlanPoint(item.cx, item.cz, layout, viewport);
    const w = Math.max(4, worldLengthToPlanPx(item.halfW * 2, layout, viewport));
    const h = Math.max(4, worldLengthToPlanPx(item.halfD * 2, layout, viewport));
    const deg = -(item.rotationY * 180) / Math.PI;
    const decorFill = item.kind === "decor" ? "#a78bfa" : "#94a3b8";
    const resolvedFill = item.color ?? decorFill;
    parts.push(
      `<rect x="${sx - w / 2}" y="${sy - h / 2}" width="${w}" height="${h}" fill="${resolvedFill}" fill-opacity="0.85" stroke="#374151" stroke-width="0.75" transform="rotate(${deg} ${sx} ${sy})"/>`,
      `<title>${escapeXml(item.label)}</title>`,
    );
  }

  const title = options.title ? escapeXml(options.title) : "План зала";
  const scalePx = worldLengthToPlanPx(5, layout, viewport);
  const scaleX = hall.offsetX + hall.drawW / 2 - scalePx / 2;
  const scaleY = height - 28;
  parts.push(
    `<line x1="${scaleX}" y1="${scaleY}" x2="${scaleX + scalePx}" y2="${scaleY}" stroke="#374151" stroke-width="2"/>`,
    `<text x="${scaleX + scalePx / 2}" y="${scaleY + 12}" text-anchor="middle" font-size="9" fill="#6b7280">5 м</text>`,
    `<text x="8" y="${height - 36}" font-size="9" fill="#6b7280">— линия зала</text>`,
    `<line x1="8" y1="${height - 40}" x2="28" y2="${height - 40}" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 3"/>`,
    `<text x="8" y="${height - 22}" font-size="9" fill="#6b7280">● софит  ■ декор</text>`,
    `<text x="${width - 8}" y="${height - 8}" text-anchor="end" font-size="9" fill="#9ca3af">${title}</text>`,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
}

export function downloadFloorPlanSvg(
  options: FloorPlanExportOptions,
  filename = "theater-floor-plan.svg",
): void {
  const blob = new Blob([buildFloorPlanSvg(options)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadFloorPlanPng(
  options: FloorPlanExportOptions,
  filename = "theater-floor-plan.png",
): Promise<void> {
  const width = options.width ?? DEFAULT_EXPORT_SIZE.width;
  const height = options.height ?? DEFAULT_EXPORT_SIZE.height;
  const svg = buildFloorPlanSvg({ ...options, width, height });
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!pngBlob) return;
    const pngUrl = URL.createObjectURL(pngBlob);
    const anchor = document.createElement("a");
    anchor.href = pngUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(pngUrl);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyFloorPlanToClipboard(
  options: FloorPlanExportOptions,
): Promise<boolean> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    return false;
  }
  const width = options.width ?? DEFAULT_EXPORT_SIZE.width;
  const height = options.height ?? DEFAULT_EXPORT_SIZE.height;
  const svg = buildFloorPlanSvg({ ...options, width, height });
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!pngBlob) return false;
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": pngBlob }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadFloorPlanPdf(options: FloorPlanExportOptions): void {
  const svg = buildFloorPlanSvg(options);
  const html = `<!DOCTYPE html><html><head><title>План зала</title></head><body style="margin:0">${svg}</body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
