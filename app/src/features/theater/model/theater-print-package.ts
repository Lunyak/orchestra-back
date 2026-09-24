import { buildFloorPlanSvg, type FloorPlanExportOptions } from "./theater-floor-plan-export";
import {
  buildInstrumentScheduleRows,
  type InstrumentScheduleRow,
} from "./theater-instrument-schedule";

export type PrintPackageOptions = FloorPlanExportOptions & {
  projectName?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrintedAt(date: Date): string {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderScheduleRow(row: InstrumentScheduleRow): string {
  const name = row.name ? `<div class="instrument-name">${escapeHtml(row.name)}</div>` : "";
  const off = row.enabled ? "" : `<div class="instrument-off">выкл</div>`;
  return `<tr>
    <td>${escapeHtml(row.numberLabel)}${name}${off}</td>
    <td>${escapeHtml(row.channelLabel)}</td>
    <td><span class="swatch" style="background:${escapeHtml(row.colorHex)}"></span>${escapeHtml(row.colorLabel)}</td>
    <td>${escapeHtml(row.trussLabel)}</td>
    <td>${escapeHtml(row.aimLabel)}</td>
  </tr>`;
}

export function buildPrintPackageHtml(
  options: PrintPackageOptions,
  printedAt = new Date(),
): string {
  const title = options.title?.trim() || "Сцена";
  const project = options.projectName?.trim();
  const heading = project && project !== title ? `${project} — ${title}` : title;
  const svg = buildFloorPlanSvg({
    ...options,
    width: options.width ?? 980,
    height: options.height ?? 640,
    title,
  }).replace(/^<\?xml[^>]*>\s*/, "");
  const rows = buildInstrumentScheduleRows(options.spotlights, options.models);
  const body = rows.length
    ? rows.map(renderScheduleRow).join("")
    : `<tr><td colspan="5" class="empty">Софитов на сцене нет</td></tr>`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>Пакет · ${escapeHtml(heading)}</title>
  <style>
    @page { margin: 14mm; }
    body { margin: 0; color: #111; font: 13px/1.35 Arial, sans-serif; }
    h1 { margin: 0 0 4px; font-size: 18px; font-weight: 700; }
    .meta { margin: 0 0 12px; color: #444; font-size: 12px; }
    .plan { width: 100%; }
    .plan svg { width: 100%; height: auto; display: block; }
    h2 { margin: 18px 0 8px; font-size: 15px; page-break-before: always; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #111; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
    .swatch { display: inline-block; width: 12px; height: 12px; margin-right: 6px; border: 1px solid #111; vertical-align: -1px; }
    .instrument-name, .instrument-off { color: #444; font-size: 11px; }
    .empty { text-align: center; color: #444; }
  </style>
</head>
<body>
  <h1>${escapeHtml(heading)}</h1>
  <p class="meta">План зала · ${escapeHtml(formatPrintedAt(printedAt))}</p>
  <div class="plan">${svg}</div>
  <h2>Лист приборов</h2>
  <table>
    <thead>
      <tr>
        <th>Номер</th>
        <th>Канал</th>
        <th>Цвет</th>
        <th>Ферма</th>
        <th>Наведение</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
}

export function printTheaterPackage(options: PrintPackageOptions): boolean {
  const html = buildPrintPackageHtml(options);
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
