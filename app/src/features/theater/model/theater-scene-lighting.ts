/** Параметры сценического освещения (редактор театра). */

/**
 * Дежурка (рабочий свет): ярко и ровно по залу/сцене,
 * чтобы читались софиты, кресла и объём зала.
 */
export const THEATER_HEMISPHERE_INTENSITY = 1.05;
export const THEATER_AMBIENT_FILL_INTENSITY = 0.42;
export const THEATER_KEY_FILL_INTENSITY = 0.78;

/** Тон-маппинг Canvas (чуть выше 1 — зал читается при мягком свете). */
export const THEATER_SCENE_TONE_EXPOSURE = 1.12;

/** Софит Three.js: мягкий край луча, физически правдоподобное затухание. */
export const THEATER_SPOTLIGHT_PENUMBRA = 0.92;
export const THEATER_SPOTLIGHT_DECAY = 2;
/** UI «Свет» 1.0 → мощный театральный софит в Three.js. */
export const THEATER_SPOTLIGHT_INTENSITY_SCALE = 42;
/** RGB-софиты заметнее цветных лучей на сцене */
export const THEATER_SPOTLIGHT_RGB_INTENSITY_MULT = 2.2;

/** Стартовая яркость новых софитов (UI), с запасом для затемненной сцены. */
export const THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY = 2;
export const THEATER_SPOTLIGHT_RGB_DEFAULT_UI_INTENSITY = 2.4;

/** Фейдер яркости софита в панели и настройках. */
export const THEATER_SPOTLIGHT_UI_INTENSITY_MIN = 0;
export const THEATER_SPOTLIGHT_UI_INTENSITY_MAX = 16;
export const THEATER_SPOTLIGHT_UI_INTENSITY_STEP = 0.1;

/** Дым-машина: лёгкий haze + мягкие лучи (основной объём — частицы). */
export const THEATER_SMOKE_FOG_NEAR = 14;
export const THEATER_SMOKE_FOG_FAR = 70;
export const THEATER_SMOKE_BEAM_OPACITY_MAX = 0.22;

export function theaterSmokeBeamOpacity(
  uiIntensity: number,
  smokeSaturation = 1,
): number {
  const max = THEATER_SPOTLIGHT_UI_INTENSITY_MAX;
  if (!Number.isFinite(uiIntensity) || max <= 0 || uiIntensity <= 0) return 0;
  const level = Math.min(1, uiIntensity / max);
  const saturation = Number.isFinite(smokeSaturation)
    ? Math.min(1, Math.max(0, smokeSaturation))
    : 1;
  return THEATER_SMOKE_BEAM_OPACITY_MAX * (0.35 + level * 0.65) * (0.25 + saturation * 0.75);
}

export function theaterSpotlightDistance(
  position: [number, number, number],
  target: [number, number, number],
): number {
  const dx = position[0] - target[0];
  const dy = position[1] - target[1];
  const dz = position[2] - target[2];
  const len = Math.hypot(dx, dy, dz);
  return Math.max(12, len * 1.35 + 4);
}

export function theaterSpotlightLightIntensity(
  uiIntensity: number,
  isRgb = false,
): number {
  const base = Math.max(0, uiIntensity) * THEATER_SPOTLIGHT_INTENSITY_SCALE;
  return isRgb ? base * THEATER_SPOTLIGHT_RGB_INTENSITY_MULT : base;
}
