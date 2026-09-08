export type BuiltInThemeId = "orchestra" | "light" | "midnight";

export type ThemeId = BuiltInThemeId | `custom:${string}`;

export type CustomTheme = {
  id: string;
  name: string;
  /** CSS-переменные, например --color-bg-primary */
  variables: Record<string, string>;
  createdAt: number;
  updatedAt: number;
};

export type ThemeDefinition = {
  id: BuiltInThemeId;
  name: string;
  description: string;
  preview: [string, string, string];
};

export const BUILT_IN_THEMES: ThemeDefinition[] = [
  {
    id: "orchestra",
    name: "Orchestra",
    description: "Тёплая тёмная тема по умолчанию",
    preview: ["#282828", "#e78a4e", "#888888"],
  },
  {
    id: "light",
    name: "Светлая",
    description: "Светлый интерфейс для дневной работы",
    preview: ["#f4f4f5", "#ea580c", "#52525b"],
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Холодная тёмная тема с голубым акцентом",
    preview: ["#0f172a", "#38bdf8", "#93c5fd"],
  },
];

export const THEME_EDITOR_TOKENS = [
  { key: "--color-bg-primary", label: "Фон приложения" },
  { key: "--color-bg-secondary", label: "Фон панелей" },
  { key: "--color-bg-quaternary", label: "Фон карточек" },
  { key: "--color-bg-tertiary", label: "Акцентный фон" },
  { key: "--color-active-ascent", label: "Активный акцент" },
  { key: "--color-text-primary", label: "Основной текст" },
  { key: "--color-text-ui", label: "Текст интерфейса" },
  { key: "--color-text-label", label: "Метки и подписи" },
  { key: "--color-button-primary", label: "Кнопка основная" },
  { key: "--color-button-secondary", label: "Кнопка вторичная" },
  { key: "--color-success-accent", label: "Успех" },
  { key: "--color-danger", label: "Ошибка" },
  { key: "--color-primary", label: "Ссылки / primary" },
  { key: "--color-border-visible", label: "Границы" },
  { key: "--field-control-bg", label: "Поля ввода" },
] as const;

export type ThemeEditorTokenKey = (typeof THEME_EDITOR_TOKENS)[number]["key"];
