/** Нормализация секунды превью ролика. */
export function normalizeVideoPreviewTimeSec(
  value: unknown,
  durationSec?: number,
): number | null {
  if (value == null || value === "") return null;
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw) || raw < 0) return null;
  const cappedByDuration =
    durationSec != null && Number.isFinite(durationSec) && durationSec > 0
      ? Math.min(raw, Math.max(0, durationSec - 0.05))
      : raw;
  return Math.round(cappedByDuration * 100) / 100;
}

/** Длительность fade между шагами проектора, мс. 0 = жёсткий cut. */
export function normalizeProjectorTransitionMs(value: unknown): number {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(3000, Math.round(raw));
}

export const DEFAULT_VIDEO_PREVIEW_TIME_SEC = 0.25;

export function resolveVideoPreviewSeekTime(
  previewTimeSec: number | null | undefined,
  durationSec?: number,
): number {
  const chosen = normalizeVideoPreviewTimeSec(previewTimeSec, durationSec);
  if (chosen != null) return chosen;
  if (durationSec != null && Number.isFinite(durationSec) && durationSec > 0) {
    return Math.min(0.25, Math.max(0.05, durationSec * 0.02));
  }
  return DEFAULT_VIDEO_PREVIEW_TIME_SEC;
}
