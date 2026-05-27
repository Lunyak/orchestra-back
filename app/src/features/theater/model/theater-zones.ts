import type {
  TheaterLayout,
  TheaterSpotlight,
  TheaterZone,
  TheaterZoneGrid,
  TheaterZonePreset,
} from "../../../shared/types/script";
import {
  buildPresetBand,
  buildZoneSubCells,
  findSubZoneAtPoint,
  findZoneAtCell,
  inferBandFromOutline,
  isPointInZoneOutline,
  pointToGridCell,
  resolveZoneGrid,
  resolveZoneWithOutline,
  type TheaterSubZoneRef,
  type TheaterZoneCellSlice,
} from "./theater-zone-grid";

export type { TheaterSubZoneRef, TheaterZoneCellSlice };

export const MAX_THEATER_ZONES = 8;

const ZONE_COLORS: Record<TheaterZonePreset, string> = {
  avanscena: "rgba(231, 138, 78, 0.42)",
  center: "rgba(96, 165, 250, 0.34)",
  depth: "rgba(167, 139, 250, 0.32)",
  custom: "rgba(148, 163, 184, 0.28)",
};

const ZONE_LABELS: Record<TheaterZonePreset, string> = {
  avanscena: "Авансцена",
  center: "Центр",
  depth: "Глубина",
  custom: "Зона",
};

function nextZoneId(zones: TheaterZone[]) {
  return zones.reduce((acc, zone) => Math.max(acc, zone.id), 0) + 1;
}

function normalizeZonePreset(value: unknown): TheaterZonePreset {
  if (value === "avanscena" || value === "center" || value === "depth" || value === "custom") {
    return value;
  }
  return "custom";
}

function readLegacyOutline(raw: Record<string, unknown>): [number, number][] | null {
  const outline = raw.outline;
  if (!Array.isArray(outline)) return null;
  const points: [number, number][] = [];
  for (const item of outline) {
    if (!Array.isArray(item) || item.length < 2) continue;
    points.push([Number(item[0]), Number(item[1])]);
  }
  return points.length >= 3 ? points : null;
}

function normalizeZoneBand(
  raw: Record<string, unknown>,
  layout: TheaterLayout,
): Pick<TheaterZone, "col0" | "col1" | "row0" | "row1"> {
  const grid = resolveZoneGrid(layout);
  const hasBand =
    raw.col0 != null ||
    raw.col1 != null ||
    raw.row0 != null ||
    raw.row1 != null;
  if (hasBand) {
    return {
      col0: Math.min(grid.cols - 1, Math.max(0, Math.trunc(Number(raw.col0) || 0))),
      col1: Math.min(grid.cols - 1, Math.max(0, Math.trunc(Number(raw.col1) || grid.cols - 1))),
      row0: Math.min(grid.rows - 1, Math.max(0, Math.trunc(Number(raw.row0) || 0))),
      row1: Math.min(grid.rows - 1, Math.max(0, Math.trunc(Number(raw.row1) || grid.rows - 1))),
    };
  }
  const legacy = readLegacyOutline(raw);
  if (legacy) return inferBandFromOutline(layout, legacy);
  return buildPresetBand(layout, "center");
}

export function resolveLayoutZones(layout: TheaterLayout): TheaterZone[] {
  return normalizeTheaterZones(layout.zones ?? [], layout);
}

export function normalizeTheaterZones(
  zones: TheaterZone[],
  layout: TheaterLayout,
): TheaterZone[] {
  const seen = new Set<number>();
  const normalized: TheaterZone[] = [];
  for (const raw of zones.slice(0, MAX_THEATER_ZONES)) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as unknown as Record<string, unknown>;
    const id = Math.trunc(Number(record.id));
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    const preset = normalizeZonePreset(record.preset);
    const band = normalizeZoneBand(record, layout);
    const subCols = Math.max(1, Math.min(6, Math.trunc(Number(record.subCols) || 1)));
    const subRows = Math.max(1, Math.min(6, Math.trunc(Number(record.subRows) || 1)));
    const label = String(record.label ?? "").trim() || ZONE_LABELS[preset];
    const zone: TheaterZone = {
      id,
      label,
      preset,
      ...band,
      subCols: subCols > 1 ? subCols : undefined,
      subRows: subRows > 1 ? subRows : undefined,
      color: String(record.color ?? "").trim() || ZONE_COLORS[preset],
      hidden: record.hidden === true,
    };
    normalized.push(resolveZoneWithOutline(layout, zone));
  }
  return normalized;
}

export function normalizeTheaterZoneGridFields(
  layout: TheaterLayout,
): Pick<TheaterLayout, "zoneGrid"> {
  return { zoneGrid: resolveZoneGrid(layout) };
}

function stripZonesForPersist(zones: TheaterZone[]): TheaterZone[] {
  return zones.map(({ outline: _outline, ...zone }) => zone);
}

export function normalizeTheaterZonesFields(
  layout: TheaterLayout,
): Pick<TheaterLayout, "zones" | "zoneGrid"> {
  const zoneGrid = resolveZoneGrid(layout);
  const zones = layout.zones?.length
    ? stripZonesForPersist(
        normalizeTheaterZones(layout.zones, { ...layout, zoneGrid }),
      )
    : undefined;
  return {
    zoneGrid,
    zones: zones?.length ? zones : undefined,
  };
}

export function isPointInZone(x: number, z: number, zone: TheaterZone): boolean {
  const layoutZone = zone as TheaterZone & { outline?: [number, number][] };
  const outline = layoutZone.outline;
  if (outline?.length) return isPointInZoneOutline(x, z, outline);
  return false;
}

export function spotlightHitsZone(
  spotlight: TheaterSpotlight,
  zone: TheaterZone,
  layout: TheaterLayout,
  subZone?: TheaterSubZoneRef | null,
): boolean {
  const x = spotlight.target[0];
  const z = spotlight.target[2];
  if (subZone) {
    const slices = buildZoneSubCells(layout, zone);
    const slice = slices.find(
      (item) =>
        (item.subCol ?? 0) === subZone.subCol && (item.subRow ?? 0) === subZone.subRow,
    );
    return slice ? isPointInZoneOutline(x, z, slice.outline) : false;
  }
  return isPointInZone(x, z, zone);
}

export function spotlightsInZone(
  spotlights: TheaterSpotlight[],
  zone: TheaterZone,
  layout: TheaterLayout,
  subZone?: TheaterSubZoneRef | null,
): TheaterSpotlight[] {
  return spotlights.filter((item) => spotlightHitsZone(item, zone, layout, subZone));
}

export function hitTestZoneSubCell(
  layout: TheaterLayout,
  zones: TheaterZone[],
  x: number,
  z: number,
): { zone: TheaterZone; subZone: TheaterSubZoneRef } | null {
  const cell = pointToGridCell(layout, x, z);
  if (!cell) return null;
  const zone = findZoneAtCell(layout, zones, cell.col, cell.row);
  if (!zone) return null;
  const sub = findSubZoneAtPoint(layout, zone, x, z);
  if (!sub) return null;
  return { zone, subZone: sub };
}

export function hitTestZoneBody(
  layout: TheaterLayout,
  x: number,
  z: number,
): TheaterZone | null {
  const zones = resolveLayoutZones(layout).filter((zone) => !zone.hidden);
  const cell = pointToGridCell(layout, x, z);
  if (!cell) return null;
  return findZoneAtCell(layout, zones, cell.col, cell.row);
}

export function createZoneFromPreset(
  layout: TheaterLayout,
  preset: Exclude<TheaterZonePreset, "custom">,
  zones: TheaterZone[],
): TheaterZone {
  const band = buildPresetBand(layout, preset);
  return resolveZoneWithOutline(layout, {
    id: nextZoneId(zones),
    label: ZONE_LABELS[preset],
    preset,
    ...band,
    color: ZONE_COLORS[preset],
  });
}

export function seedStandardStageZones(layout: TheaterLayout): TheaterZone[] {
  const presets: Array<Exclude<TheaterZonePreset, "custom">> = [
    "avanscena",
    "center",
    "depth",
  ];
  const next = [...resolveLayoutZones(layout)];
  for (const preset of presets) {
    if (next.some((zone) => zone.preset === preset)) continue;
    next.push(createZoneFromPreset(layout, preset, next));
  }
  return next;
}

export function seedAvanscenaZone(layout: TheaterLayout): TheaterZone[] {
  const zones = resolveLayoutZones(layout);
  if (zones.some((zone) => zone.preset === "avanscena")) return zones;
  return [...zones, createZoneFromPreset(layout, "avanscena", zones)];
}

export function patchLayoutZone(
  layout: TheaterLayout,
  zoneId: number,
  patch: Partial<
    Pick<
      TheaterZone,
      | "label"
      | "color"
      | "hidden"
      | "preset"
      | "col0"
      | "col1"
      | "row0"
      | "row1"
      | "subCols"
      | "subRows"
    >
  >,
): TheaterZone[] {
  const zones = resolveLayoutZones(layout);
  return zones.map((zone) => {
    if (zone.id !== zoneId) return zone;
    const merged = { ...zone, ...patch, preset: patch.preset ?? zone.preset ?? "custom" };
    return resolveZoneWithOutline(layout, merged);
  });
}

export function removeLayoutZone(layout: TheaterLayout, zoneId: number): TheaterZone[] {
  return resolveLayoutZones(layout).filter((zone) => zone.id !== zoneId);
}

export function patchLayoutZoneGrid(
  layout: TheaterLayout,
  patch: Partial<TheaterZoneGrid>,
): Pick<TheaterLayout, "zoneGrid" | "zones"> {
  const zoneGrid = resolveZoneGrid({ ...layout, zoneGrid: { ...resolveZoneGrid(layout), ...patch } });
  const zones = layout.zones?.length
    ? normalizeTheaterZones(layout.zones, { ...layout, zoneGrid })
    : undefined;
  return { zoneGrid, zones };
}

export { resolveZoneGrid, buildZoneSubCells, pointToGridCell, findZoneAtCell };
