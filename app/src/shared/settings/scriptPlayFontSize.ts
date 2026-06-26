const SCRIPT_PLAY_FONT_SIZE_KEY = "orchestra:script.playFontSizePx";
const SCRIPT_PLAY_TEXT_COLOR_KEY = "orchestra:script.playTextColor";
const SCRIPT_PLAY_FONT_FAMILY_KEY = "orchestra:script.playFontFamilyId";
const SCRIPT_PLAY_LABEL_FONT_SIZE_KEY = "orchestra:script.playLabelFontSizePx";
const SCRIPT_PLAY_LABEL_TEXT_COLOR_KEY = "orchestra:script.playLabelTextColor";
const SCRIPT_PLAY_LABEL_BG_COLOR_KEY = "orchestra:script.playLabelBgColor";
const SCRIPT_PLAY_LABEL_FONT_FAMILY_KEY = "orchestra:script.playLabelFontFamilyId";
const SCRIPT_PLAY_LABEL_FONT_WEIGHT_KEY = "orchestra:script.playLabelFontWeight";
const SCRIPT_PLAY_LABEL_TEXT_TRANSFORM_KEY = "orchestra:script.playLabelTextTransform";
const SCRIPT_PLAY_LINE_HEIGHT_KEY = "orchestra:script.playLineHeight";
const SCRIPT_PLAY_LABEL_TEXT_GAP_KEY = "orchestra:script.playLabelTextGapPx";
const SCRIPT_PLAY_PARAGRAPH_GAP_KEY = "orchestra:script.playParagraphGapEm";

export const DEFAULT_SCRIPT_PLAY_FONT_SIZE_PX = 16;
export const MIN_SCRIPT_PLAY_FONT_SIZE_PX = 12;
export const MAX_SCRIPT_PLAY_FONT_SIZE_PX = 28;

export const DEFAULT_SCRIPT_PLAY_LINE_HEIGHT = 1.5;
export const MIN_SCRIPT_PLAY_LINE_HEIGHT = 1;
export const MAX_SCRIPT_PLAY_LINE_HEIGHT = 2.5;

export const DEFAULT_SCRIPT_PLAY_LABEL_TEXT_GAP_PX = 4;
export const MIN_SCRIPT_PLAY_LABEL_TEXT_GAP_PX = 0;
export const MAX_SCRIPT_PLAY_LABEL_TEXT_GAP_PX = 24;

export const DEFAULT_SCRIPT_PLAY_PARAGRAPH_GAP_EM = 0.75;
export const MIN_SCRIPT_PLAY_PARAGRAPH_GAP_EM = 0;
export const MAX_SCRIPT_PLAY_PARAGRAPH_GAP_EM = 3;

export const MIN_SCRIPT_PLAY_LABEL_FONT_SIZE_PX = 9;
export const MAX_SCRIPT_PLAY_LABEL_FONT_SIZE_PX = 24;

export type ScriptPlayLabelTextTransform = "capitalize" | "uppercase" | "none";

export const SCRIPT_PLAY_LABEL_FONT_WEIGHT_OPTIONS = [
  { value: 100, label: "Тонкий (100)" },
  { value: 400, label: "Обычный (400)" },
  { value: 600, label: "Полужирный (600)" },
  { value: 700, label: "Жирный (700)" },
] as const;

export const SCRIPT_PLAY_LABEL_TEXT_TRANSFORM_OPTIONS: Array<{
  value: ScriptPlayLabelTextTransform;
  label: string;
}> = [
  { value: "capitalize", label: "Capitalize" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "none", label: "Как в тексте" },
];

export type ScriptPlayLabelFontFamilyId = ScriptPlayFontFamilyId | "inherit";

export type ScriptPlayFontFamilyId =
  | "courier"
  | "jetbrains-mono"
  | "ibm-plex-mono"
  | "mono-system"
  | "inter"
  | "roboto"
  | "literata"
  | "pt-serif"
  | "merriweather"
  | "serif";

export type ScriptPlayFontFamilyPreset = {
  id: ScriptPlayFontFamilyId;
  label: string;
  value: string;
};

export const SCRIPT_PLAY_FONT_FAMILY_PRESETS: ScriptPlayFontFamilyPreset[] = [
  {
    id: "courier",
    label: "Courier Prime",
    value:
      '"Courier Prime", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    value:
      '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    value:
      '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  },
  {
    id: "mono-system",
    label: "Системный моноширинный",
    value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  },
  {
    id: "inter",
    label: "Inter",
    value:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: "roboto",
    label: "Roboto",
    value: 'Roboto, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  {
    id: "literata",
    label: "Literata",
    value: '"Literata", Georgia, "Times New Roman", Times, serif',
  },
  {
    id: "pt-serif",
    label: "PT Serif",
    value: '"PT Serif", Georgia, "Times New Roman", Times, serif',
  },
  {
    id: "merriweather",
    label: "Merriweather",
    value: 'Merriweather, Georgia, "Times New Roman", Times, serif',
  },
  {
    id: "serif",
    label: "Georgia (системный)",
    value: 'Georgia, "Times New Roman", Times, serif',
  },
];

export const DEFAULT_SCRIPT_PLAY_FONT_FAMILY_ID: ScriptPlayFontFamilyId = "courier";
export const DEFAULT_SCRIPT_PLAY_LABEL_FONT_WEIGHT = 100;
export const DEFAULT_SCRIPT_PLAY_LABEL_TEXT_TRANSFORM: ScriptPlayLabelTextTransform = "capitalize";
export const DEFAULT_SCRIPT_PLAY_LABEL_FONT_FAMILY_ID: ScriptPlayLabelFontFamilyId = "inherit";

const SCRIPT_PLAY_FONT_FAMILY_BY_ID = new Map(
  SCRIPT_PLAY_FONT_FAMILY_PRESETS.map((preset) => [preset.id, preset]),
);

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

function normalizeScriptPlayTextColor(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return "";
}

export function getScriptPlayTextColor(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = localStorage.getItem(SCRIPT_PLAY_TEXT_COLOR_KEY);
    return normalizeScriptPlayTextColor(stored);
  } catch {
    return "";
  }
}

export function setScriptPlayTextColor(value: string): string {
  const next = normalizeScriptPlayTextColor(value);
  if (typeof window === "undefined") return next;
  try {
    if (next) localStorage.setItem(SCRIPT_PLAY_TEXT_COLOR_KEY, next);
    else localStorage.removeItem(SCRIPT_PLAY_TEXT_COLOR_KEY);
  } catch {
    // ignore
  }
  return next;
}

export function isScriptPlayFontFamilyId(value: unknown): value is ScriptPlayFontFamilyId {
  return typeof value === "string" && SCRIPT_PLAY_FONT_FAMILY_BY_ID.has(value as ScriptPlayFontFamilyId);
}

export function getScriptPlayFontFamilyId(): ScriptPlayFontFamilyId {
  if (typeof window === "undefined") return DEFAULT_SCRIPT_PLAY_FONT_FAMILY_ID;
  try {
    const stored = localStorage.getItem(SCRIPT_PLAY_FONT_FAMILY_KEY);
    if (stored === "sans") return "inter";
    if (isScriptPlayFontFamilyId(stored)) return stored;
  } catch {
    // ignore
  }
  return DEFAULT_SCRIPT_PLAY_FONT_FAMILY_ID;
}

export function setScriptPlayFontFamilyId(value: ScriptPlayFontFamilyId): ScriptPlayFontFamilyId {
  const next = isScriptPlayFontFamilyId(value) ? value : DEFAULT_SCRIPT_PLAY_FONT_FAMILY_ID;
  if (typeof window === "undefined") return next;
  try {
    if (next === DEFAULT_SCRIPT_PLAY_FONT_FAMILY_ID) {
      localStorage.removeItem(SCRIPT_PLAY_FONT_FAMILY_KEY);
    } else {
      localStorage.setItem(SCRIPT_PLAY_FONT_FAMILY_KEY, next);
    }
  } catch {
    // ignore
  }
  return next;
}

export function getScriptPlayFontFamilyValue(id?: ScriptPlayFontFamilyId): string {
  const presetId = id ?? getScriptPlayFontFamilyId();
  return SCRIPT_PLAY_FONT_FAMILY_BY_ID.get(presetId)?.value ?? SCRIPT_PLAY_FONT_FAMILY_PRESETS[0]!.value;
}

export function clampScriptPlayLabelFontSizePx(value: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return MIN_SCRIPT_PLAY_LABEL_FONT_SIZE_PX;
  return Math.max(
    MIN_SCRIPT_PLAY_LABEL_FONT_SIZE_PX,
    Math.min(MAX_SCRIPT_PLAY_LABEL_FONT_SIZE_PX, parsed),
  );
}

export function getScriptPlayLabelFontSizePx(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SCRIPT_PLAY_LABEL_FONT_SIZE_KEY);
    if (stored == null || stored.trim() === "") return null;
    return clampScriptPlayLabelFontSizePx(Number(stored));
  } catch {
    return null;
  }
}

export function setScriptPlayLabelFontSizePx(value: number | null): number | null {
  const next = value == null ? null : clampScriptPlayLabelFontSizePx(value);
  if (typeof window === "undefined") return next;
  try {
    if (next == null) localStorage.removeItem(SCRIPT_PLAY_LABEL_FONT_SIZE_KEY);
    else localStorage.setItem(SCRIPT_PLAY_LABEL_FONT_SIZE_KEY, String(next));
  } catch {
    // ignore
  }
  return next;
}

export function getScriptPlayLabelTextColor(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizeScriptPlayTextColor(localStorage.getItem(SCRIPT_PLAY_LABEL_TEXT_COLOR_KEY));
  } catch {
    return "";
  }
}

export function setScriptPlayLabelTextColor(value: string): string {
  const next = normalizeScriptPlayTextColor(value);
  if (typeof window === "undefined") return next;
  try {
    if (next) localStorage.setItem(SCRIPT_PLAY_LABEL_TEXT_COLOR_KEY, next);
    else localStorage.removeItem(SCRIPT_PLAY_LABEL_TEXT_COLOR_KEY);
  } catch {
    // ignore
  }
  return next;
}

export function getScriptPlayLabelBgColor(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizeScriptPlayTextColor(localStorage.getItem(SCRIPT_PLAY_LABEL_BG_COLOR_KEY));
  } catch {
    return "";
  }
}

export function setScriptPlayLabelBgColor(value: string): string {
  const next = normalizeScriptPlayTextColor(value);
  if (typeof window === "undefined") return next;
  try {
    if (next) localStorage.setItem(SCRIPT_PLAY_LABEL_BG_COLOR_KEY, next);
    else localStorage.removeItem(SCRIPT_PLAY_LABEL_BG_COLOR_KEY);
  } catch {
    // ignore
  }
  return next;
}

export function isScriptPlayLabelFontFamilyId(value: unknown): value is ScriptPlayLabelFontFamilyId {
  return value === "inherit" || isScriptPlayFontFamilyId(value);
}

export function getScriptPlayLabelFontFamilyId(): ScriptPlayLabelFontFamilyId {
  if (typeof window === "undefined") return DEFAULT_SCRIPT_PLAY_LABEL_FONT_FAMILY_ID;
  try {
    const stored = localStorage.getItem(SCRIPT_PLAY_LABEL_FONT_FAMILY_KEY);
    if (isScriptPlayLabelFontFamilyId(stored)) return stored;
  } catch {
    // ignore
  }
  return DEFAULT_SCRIPT_PLAY_LABEL_FONT_FAMILY_ID;
}

export function setScriptPlayLabelFontFamilyId(
  value: ScriptPlayLabelFontFamilyId,
): ScriptPlayLabelFontFamilyId {
  const next = isScriptPlayLabelFontFamilyId(value)
    ? value
    : DEFAULT_SCRIPT_PLAY_LABEL_FONT_FAMILY_ID;
  if (typeof window === "undefined") return next;
  try {
    if (next === DEFAULT_SCRIPT_PLAY_LABEL_FONT_FAMILY_ID) {
      localStorage.removeItem(SCRIPT_PLAY_LABEL_FONT_FAMILY_KEY);
    } else {
      localStorage.setItem(SCRIPT_PLAY_LABEL_FONT_FAMILY_KEY, next);
    }
  } catch {
    // ignore
  }
  return next;
}

export function getScriptPlayLabelFontFamilyValue(id?: ScriptPlayLabelFontFamilyId): string | null {
  const presetId = id ?? getScriptPlayLabelFontFamilyId();
  if (presetId === "inherit") return null;
  return getScriptPlayFontFamilyValue(presetId);
}

function normalizeScriptPlayLabelFontWeight(value: unknown): number {
  const parsed = Math.trunc(Number(value));
  const allowed = SCRIPT_PLAY_LABEL_FONT_WEIGHT_OPTIONS.map((option) => option.value);
  if (allowed.includes(parsed as (typeof allowed)[number])) return parsed;
  return DEFAULT_SCRIPT_PLAY_LABEL_FONT_WEIGHT;
}

export function getScriptPlayLabelFontWeight(): number {
  if (typeof window === "undefined") return DEFAULT_SCRIPT_PLAY_LABEL_FONT_WEIGHT;
  try {
    const stored = localStorage.getItem(SCRIPT_PLAY_LABEL_FONT_WEIGHT_KEY);
    if (stored == null || stored.trim() === "") return DEFAULT_SCRIPT_PLAY_LABEL_FONT_WEIGHT;
    return normalizeScriptPlayLabelFontWeight(stored);
  } catch {
    return DEFAULT_SCRIPT_PLAY_LABEL_FONT_WEIGHT;
  }
}

export function setScriptPlayLabelFontWeight(value: number): number {
  const next = normalizeScriptPlayLabelFontWeight(value);
  if (typeof window === "undefined") return next;
  try {
    if (next === DEFAULT_SCRIPT_PLAY_LABEL_FONT_WEIGHT) {
      localStorage.removeItem(SCRIPT_PLAY_LABEL_FONT_WEIGHT_KEY);
    } else {
      localStorage.setItem(SCRIPT_PLAY_LABEL_FONT_WEIGHT_KEY, String(next));
    }
  } catch {
    // ignore
  }
  return next;
}

function normalizeScriptPlayLabelTextTransform(value: unknown): ScriptPlayLabelTextTransform {
  const raw = String(value ?? "").trim();
  if (raw === "uppercase" || raw === "none" || raw === "capitalize") return raw;
  return DEFAULT_SCRIPT_PLAY_LABEL_TEXT_TRANSFORM;
}

export function getScriptPlayLabelTextTransform(): ScriptPlayLabelTextTransform {
  if (typeof window === "undefined") return DEFAULT_SCRIPT_PLAY_LABEL_TEXT_TRANSFORM;
  try {
    const stored = localStorage.getItem(SCRIPT_PLAY_LABEL_TEXT_TRANSFORM_KEY);
    if (stored == null || stored.trim() === "") return DEFAULT_SCRIPT_PLAY_LABEL_TEXT_TRANSFORM;
    return normalizeScriptPlayLabelTextTransform(stored);
  } catch {
    return DEFAULT_SCRIPT_PLAY_LABEL_TEXT_TRANSFORM;
  }
}

export function setScriptPlayLabelTextTransform(value: ScriptPlayLabelTextTransform): ScriptPlayLabelTextTransform {
  const next = normalizeScriptPlayLabelTextTransform(value);
  if (typeof window === "undefined") return next;
  try {
    if (next === DEFAULT_SCRIPT_PLAY_LABEL_TEXT_TRANSFORM) {
      localStorage.removeItem(SCRIPT_PLAY_LABEL_TEXT_TRANSFORM_KEY);
    } else {
      localStorage.setItem(SCRIPT_PLAY_LABEL_TEXT_TRANSFORM_KEY, next);
    }
  } catch {
    // ignore
  }
  return next;
}

export function clampScriptPlayLineHeight(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SCRIPT_PLAY_LINE_HEIGHT;
  const rounded = Math.round(parsed * 100) / 100;
  return Math.max(MIN_SCRIPT_PLAY_LINE_HEIGHT, Math.min(MAX_SCRIPT_PLAY_LINE_HEIGHT, rounded));
}

export function getScriptPlayLineHeight(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SCRIPT_PLAY_LINE_HEIGHT_KEY);
    if (stored == null || stored.trim() === "") return null;
    return clampScriptPlayLineHeight(Number(stored));
  } catch {
    return null;
  }
}

export function setScriptPlayLineHeight(value: number | null): number | null {
  const next = value == null ? null : clampScriptPlayLineHeight(value);
  if (typeof window === "undefined") return next;
  try {
    if (next == null || next === DEFAULT_SCRIPT_PLAY_LINE_HEIGHT) {
      localStorage.removeItem(SCRIPT_PLAY_LINE_HEIGHT_KEY);
      return null;
    }
    localStorage.setItem(SCRIPT_PLAY_LINE_HEIGHT_KEY, String(next));
  } catch {
    // ignore
  }
  return next;
}

export function clampScriptPlayLabelTextGapPx(value: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_SCRIPT_PLAY_LABEL_TEXT_GAP_PX;
  return Math.max(
    MIN_SCRIPT_PLAY_LABEL_TEXT_GAP_PX,
    Math.min(MAX_SCRIPT_PLAY_LABEL_TEXT_GAP_PX, parsed),
  );
}

export function getScriptPlayLabelTextGapPx(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SCRIPT_PLAY_LABEL_TEXT_GAP_KEY);
    if (stored == null || stored.trim() === "") return null;
    return clampScriptPlayLabelTextGapPx(Number(stored));
  } catch {
    return null;
  }
}

export function setScriptPlayLabelTextGapPx(value: number | null): number | null {
  const next = value == null ? null : clampScriptPlayLabelTextGapPx(value);
  if (typeof window === "undefined") return next;
  try {
    if (next == null || next === DEFAULT_SCRIPT_PLAY_LABEL_TEXT_GAP_PX) {
      localStorage.removeItem(SCRIPT_PLAY_LABEL_TEXT_GAP_KEY);
      return null;
    }
    localStorage.setItem(SCRIPT_PLAY_LABEL_TEXT_GAP_KEY, String(next));
  } catch {
    // ignore
  }
  return next;
}

export function clampScriptPlayParagraphGapEm(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SCRIPT_PLAY_PARAGRAPH_GAP_EM;
  const rounded = Math.round(parsed * 100) / 100;
  return Math.max(
    MIN_SCRIPT_PLAY_PARAGRAPH_GAP_EM,
    Math.min(MAX_SCRIPT_PLAY_PARAGRAPH_GAP_EM, rounded),
  );
}

export function getScriptPlayParagraphGapEm(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SCRIPT_PLAY_PARAGRAPH_GAP_KEY);
    if (stored == null || stored.trim() === "") return null;
    return clampScriptPlayParagraphGapEm(Number(stored));
  } catch {
    return null;
  }
}

export function setScriptPlayParagraphGapEm(value: number | null): number | null {
  const next = value == null ? null : clampScriptPlayParagraphGapEm(value);
  if (typeof window === "undefined") return next;
  try {
    if (next == null || next === DEFAULT_SCRIPT_PLAY_PARAGRAPH_GAP_EM) {
      localStorage.removeItem(SCRIPT_PLAY_PARAGRAPH_GAP_KEY);
      return null;
    }
    localStorage.setItem(SCRIPT_PLAY_PARAGRAPH_GAP_KEY, String(next));
  } catch {
    // ignore
  }
  return next;
}

/** Inline-стили виджета [[РОЛЬ]] в CodeMirror (вкладка «Текст»): var() на :root обновляются без пересборки чипов. */
export const SCRIPT_PLAY_SPEAKER_LABEL_WIDGET_STYLE =
  "display:inline-flex;align-items:center;white-space:nowrap;padding:0 6px;letter-spacing:0.25px;vertical-align:baseline;" +
  "margin-right:var(--script-play-label-text-gap,4px);" +
  "font-weight:var(--script-play-label-font-weight,100);" +
  "font-size:var(--script-play-label-font-size,var(--script-font-size-label));" +
  "font-family:var(--script-play-label-font-family,inherit);" +
  "color:var(--script-play-label-color,var(--script-play-text-color,var(--color-text-primary)));" +
  "background:var(--script-play-label-bg,var(--color-blue-bg));" +
  "text-transform:var(--script-play-label-text-transform,capitalize);";

export function applyScriptPlayTextAppearance(): void {
  applyScriptPlayFontSizePx();
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const color = getScriptPlayTextColor();
  if (color) root.style.setProperty("--script-play-text-color", color);
  else root.style.removeProperty("--script-play-text-color");

  const fontFamilyId = getScriptPlayFontFamilyId();
  if (fontFamilyId === DEFAULT_SCRIPT_PLAY_FONT_FAMILY_ID) {
    root.style.removeProperty("--script-play-font-family");
  } else {
    root.style.setProperty("--script-play-font-family", getScriptPlayFontFamilyValue(fontFamilyId));
  }

  const labelFontSizePx = getScriptPlayLabelFontSizePx();
  if (labelFontSizePx != null) {
    root.style.setProperty("--script-play-label-font-size", `${labelFontSizePx}px`);
  } else {
    root.style.removeProperty("--script-play-label-font-size");
  }

  const labelColor = getScriptPlayLabelTextColor();
  if (labelColor) root.style.setProperty("--script-play-label-color", labelColor);
  else root.style.removeProperty("--script-play-label-color");

  const labelBgColor = getScriptPlayLabelBgColor();
  if (labelBgColor) root.style.setProperty("--script-play-label-bg", labelBgColor);
  else root.style.removeProperty("--script-play-label-bg");

  const labelFontFamily = getScriptPlayLabelFontFamilyValue();
  if (labelFontFamily) root.style.setProperty("--script-play-label-font-family", labelFontFamily);
  else root.style.removeProperty("--script-play-label-font-family");

  const labelFontWeight = getScriptPlayLabelFontWeight();
  if (labelFontWeight === DEFAULT_SCRIPT_PLAY_LABEL_FONT_WEIGHT) {
    root.style.removeProperty("--script-play-label-font-weight");
  } else {
    root.style.setProperty("--script-play-label-font-weight", String(labelFontWeight));
  }

  const labelTextTransform = getScriptPlayLabelTextTransform();
  if (labelTextTransform === DEFAULT_SCRIPT_PLAY_LABEL_TEXT_TRANSFORM) {
    root.style.removeProperty("--script-play-label-text-transform");
  } else {
    root.style.setProperty("--script-play-label-text-transform", labelTextTransform);
  }

  const lineHeight = getScriptPlayLineHeight();
  if (lineHeight != null) {
    root.style.setProperty("--script-play-line-height", String(lineHeight));
  } else {
    root.style.removeProperty("--script-play-line-height");
  }

  const labelTextGapPx = getScriptPlayLabelTextGapPx();
  if (labelTextGapPx != null) {
    root.style.setProperty("--script-play-label-text-gap", `${labelTextGapPx}px`);
  } else {
    root.style.removeProperty("--script-play-label-text-gap");
  }

  const paragraphGapEm = getScriptPlayParagraphGapEm();
  if (paragraphGapEm != null) {
    root.style.setProperty("--script-play-paragraph-gap", `${paragraphGapEm}em`);
  } else {
    root.style.removeProperty("--script-play-paragraph-gap");
  }
}
