/** Короткий алиас для readThemeColor. */
export function tc(name: `--${string}`): string {
  return readThemeColor(name);
}

/** Читает CSS-переменную из :root (для Canvas, Three.js, вычислений). */
export function readThemeColor(name: `--${string}`): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Разрешает `var(--token)` или возвращает исходное значение. */
export function resolveThemeColor(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^var\((--[^,)]+)(?:,\s*([^)]+))?\)$/);
  if (!match) return trimmed;
  const resolved = readThemeColor(match[1] as `--${string}`);
  return resolved || (match[2]?.trim() ?? trimmed);
}

/** Преобразует CSS-цвет в hex (#rrggbb) для вычислений яркости. */
export function themeColorToHex(color: string): string | null {
  const resolved = resolveThemeColor(color);
  if (resolved.startsWith("#")) {
    const hex = resolved.slice(1);
    if (hex.length === 6) return `#${hex}`;
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    return null;
  }
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = resolved;
  const normalized = ctx.fillStyle;
  if (typeof normalized !== "string" || !normalized.startsWith("#")) return null;
  return normalized.length === 7 ? normalized : null;
}
