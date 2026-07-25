/** Стандартная театральная палитра: RGB + CMY + популярные wash. */
export const THEATER_RGB_COLOR_PRESETS = [
  { id: "white", label: "Белый", token: "--color-light-white" },
  { id: "red", label: "Красный", token: "--color-light-red" },
  { id: "green", label: "Зелёный", token: "--color-light-green" },
  { id: "blue", label: "Синий", token: "--color-light-blue" },
  { id: "cyan", label: "Голубой", token: "--color-light-cyan" },
  { id: "magenta", label: "Пурпурный", token: "--color-light-magenta" },
  { id: "yellow", label: "Жёлтый", token: "--color-warning-bright" },
  { id: "orange", label: "Янтарный", token: "--color-light-orange" },
  { id: "pink", label: "Розовый", token: "--color-light-pink" },
  { id: "purple", label: "Фиолетовый", token: "--color-light-purple" },
  { id: "sky", label: "Небесный", token: "--color-light-sky" },
  { id: "amber", label: "Тёплый", token: "--color-light-yellow" },
] as const;

export type TheaterRgbColorPresetId = (typeof THEATER_RGB_COLOR_PRESETS)[number]["id"];
