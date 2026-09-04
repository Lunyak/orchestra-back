import type { CustomTheme, ThemeId } from "../styles/theme/types";

/** Смена темы скрыта в UI, пока палитры не доработаны. */
export const THEME_SWITCHING_ENABLED: boolean = false;

const ACTIVE_THEME_KEY = "orchestra:theme.activeId";
const CUSTOM_THEMES_KEY = "orchestra:theme.custom";

export function isCustomThemeId(id: string): id is `custom:${string}` {
  return id.startsWith("custom:");
}

export function getActiveThemeId(): ThemeId {
  if (typeof window === "undefined") return "orchestra";
  const stored = localStorage.getItem(ACTIVE_THEME_KEY);
  if (!stored) return "orchestra";
  if (stored === "orchestra" || stored === "light" || stored === "midnight") {
    return stored;
  }
  if (isCustomThemeId(stored)) return stored;
  return "orchestra";
}

export function setActiveThemeId(id: ThemeId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_THEME_KEY, id);
}

export function getCustomThemes(): CustomTheme[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomTheme[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: CustomTheme[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
}

export function getCustomThemeById(id: string): CustomTheme | null {
  const pureId = id.startsWith("custom:") ? id.slice("custom:".length) : id;
  return getCustomThemes().find((t) => t.id === pureId) ?? null;
}

export function upsertCustomTheme(theme: CustomTheme): void {
  const themes = getCustomThemes();
  const idx = themes.findIndex((t) => t.id === theme.id);
  if (idx >= 0) themes[idx] = theme;
  else themes.push(theme);
  saveCustomThemes(themes);
}

export function deleteCustomTheme(id: string): void {
  const pureId = id.startsWith("custom:") ? id.slice("custom:".length) : id;
  saveCustomThemes(getCustomThemes().filter((t) => t.id !== pureId));
  if (getActiveThemeId() === `custom:${pureId}`) {
    setActiveThemeId("orchestra");
  }
}

export function createThemeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
