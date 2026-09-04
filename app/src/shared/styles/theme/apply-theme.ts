import {
  THEME_SWITCHING_ENABLED,
  getActiveThemeId,
  getCustomThemeById,
  setActiveThemeId as persistActiveThemeId,
} from "../../settings/themePreferences";
import { THEME_EDITOR_TOKENS } from "./types";
import type { ThemeId } from "./types";

let appliedInlineVars: string[] = [];

function clearInlineThemeVars(root: HTMLElement): void {
  for (const key of appliedInlineVars) {
    root.style.removeProperty(key);
  }
  appliedInlineVars = [];
}

function applyCustomVariables(root: HTMLElement, variables: Record<string, string>): void {
  clearInlineThemeVars(root);
  for (const [key, value] of Object.entries(variables)) {
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (!trimmedKey.startsWith("--") || !trimmedValue) continue;
    root.style.setProperty(trimmedKey, trimmedValue);
    appliedInlineVars.push(trimmedKey);
  }
}

export function applyTheme(themeId: ThemeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (themeId.startsWith("custom:")) {
    const custom = getCustomThemeById(themeId);
    root.dataset.theme = "custom";
    root.dataset.customThemeId = custom?.id ?? themeId.slice("custom:".length);
    if (custom) applyCustomVariables(root, custom.variables);
    else clearInlineThemeVars(root);
    return;
  }

  root.dataset.customThemeId = "";
  clearInlineThemeVars(root);
  root.dataset.theme = themeId;
}

export function bootstrapTheme(): ThemeId {
  const id = THEME_SWITCHING_ENABLED ? getActiveThemeId() : "orchestra";
  applyTheme(id);
  if (typeof document !== "undefined" && !document.documentElement.dataset.theme) {
    document.documentElement.dataset.theme = "orchestra";
  }
  return id;
}

export function setActiveTheme(themeId: ThemeId): void {
  persistActiveThemeId(themeId);
  applyTheme(themeId);
  window.dispatchEvent(new CustomEvent("orchestra-theme-change", { detail: { themeId } }));
}

export function readCurrentThemeTokenValues(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const out: Record<string, string> = {};
  for (const token of THEME_EDITOR_TOKENS) {
    out[token.key] = styles.getPropertyValue(token.key).trim();
  }
  return out;
}

export function getActiveThemeIdLive(): ThemeId {
  return getActiveThemeId();
}
