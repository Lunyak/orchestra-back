import type { TheaterLayout } from "../../../shared/types/script";
import { resolveStageGeometry } from "./theater-stage-geometry";

export type TheaterSmokePosition = [number, number, number];

export const THEATER_SMOKE_INTENSITY_MIN = 0;
export const THEATER_SMOKE_INTENSITY_MAX = 1;
export const THEATER_SMOKE_INTENSITY_STEP = 0.01;
export const THEATER_SMOKE_INTENSITY_DEFAULT = 0.55;

/**
 * UI 0…1 → сила эмиссии.
 * Квадрат: низкие проценты заметно слабее (1–5% — лёгкая дымка).
 */
export function theaterSmokeEmitFactor(intensity: number): number {
  const level = clampSmokeUnit(intensity, 0);
  return level * level;
}

export const THEATER_SMOKE_SATURATION_MIN = 0;
export const THEATER_SMOKE_SATURATION_MAX = 1;
export const THEATER_SMOKE_SATURATION_STEP = 0.05;
export const THEATER_SMOKE_SATURATION_DEFAULT = 0.55;

export const THEATER_SMOKE_SIZE_MIN = 0.3;
export const THEATER_SMOKE_SIZE_MAX = 2.5;
export const THEATER_SMOKE_SIZE_STEP = 0.05;
export const THEATER_SMOKE_SIZE_DEFAULT = 1;

/** Точка по умолчанию — центр сцены, чуть над полом. */
export function resolveDefaultSmokePosition(layout: TheaterLayout): TheaterSmokePosition {
  const geom = resolveStageGeometry(layout);
  const stageSpan = Math.max(1, geom.prosceniumZ - geom.backZ);
  const z = geom.backZ + stageSpan * 0.42;
  return [0, 0.18, z];
}

export function resolveSmokePosition(
  layout: TheaterLayout,
  stored: TheaterSmokePosition | null | undefined,
): TheaterSmokePosition {
  if (
    stored &&
    stored.length === 3 &&
    stored.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    return [stored[0], stored[1], stored[2]];
  }
  return resolveDefaultSmokePosition(layout);
}

export function clampSmokeUnit(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

export function clampSmokeSize(value: number) {
  if (!Number.isFinite(value)) return THEATER_SMOKE_SIZE_DEFAULT;
  return Math.min(THEATER_SMOKE_SIZE_MAX, Math.max(THEATER_SMOKE_SIZE_MIN, value));
}
