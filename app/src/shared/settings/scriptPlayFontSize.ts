const SCRIPT_PLAY_FONT_SIZE_KEY = "orchestra:script.playFontSizePx";

export const DEFAULT_SCRIPT_PLAY_FONT_SIZE_PX = 16;
export const MIN_SCRIPT_PLAY_FONT_SIZE_PX = 12;
export const MAX_SCRIPT_PLAY_FONT_SIZE_PX = 28;

export function clampScriptPlayFontSizePx(value: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_SCRIPT_PLAY_FONT_SIZE_PX;
  return Math.max(
    MIN_SCRIPT_PLAY_FONT_SIZE_PX,
    Math.min(MAX_SCRIPT_PLAY_FONT_SIZE_PX, parsed),
  );
}

export function getScriptPlayFontSizePx(): number {
  if (typeof window === "undefined") return DEFAULT_SCRIPT_PLAY_FONT_SIZE_PX;
  try {
    const stored = localStorage.getItem(SCRIPT_PLAY_FONT_SIZE_KEY);
    if (stored == null) return DEFAULT_SCRIPT_PLAY_FONT_SIZE_PX;
    return clampScriptPlayFontSizePx(Number(stored));
  } catch {
    return DEFAULT_SCRIPT_PLAY_FONT_SIZE_PX;
  }
}

export function setScriptPlayFontSizePx(value: number): number {
  const next = clampScriptPlayFontSizePx(value);
  if (typeof window === "undefined") return next;
  try {
    localStorage.setItem(SCRIPT_PLAY_FONT_SIZE_KEY, String(next));
  } catch {
    // ignore
  }
  return next;
}

export function applyScriptPlayFontSizePx(value?: number): number {
  const bodyPx = clampScriptPlayFontSizePx(value ?? getScriptPlayFontSizePx());
  if (typeof document === "undefined") return bodyPx;

  const root = document.documentElement;
  root.style.setProperty("--script-font-size-body", `${bodyPx}px`);
  root.style.setProperty("--script-font-size-heading", `${Math.round(bodyPx * 1.5)}px`);
  root.style.setProperty("--script-font-size-label", `${Math.round(bodyPx * 0.92)}px`);
  return bodyPx;
}
