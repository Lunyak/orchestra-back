export type TheaterViewPrefs = {
  showGrid: boolean;
  /** Столбцы/ряды на полу сцены (софиты, план) */
  showStageGrid: boolean;
  snapToGrid: boolean;
  gridStep: number;
  showSeats: boolean;
  wallsOpaque: boolean;
  wallsHidden: boolean;
  wallsHideFromCamera: boolean;
  showFloorPlan: boolean;
  /** Длинная сторона области 2D-плана (px). */
  floorPlanMaxSide: number;
  spectaclePreviewMode: boolean;
  alignGuidesEnabled: boolean;
  activeTab: "navigate" | "spotlights" | "models" | "view" | "layout" | "decor";
  /** Пульт света внизу сцены (переключатель в меню «Вид», не вкладка). */
  lightConsoleExpanded: boolean;
  outlineDrawMode: boolean;
  /** Режим «Настройки сцены» (панели слева/справа вместо «Музыка и сцены»). */
  swapTheaterPanels: boolean;
  showTheaterControls: boolean;
  /** Точечная цель софита или привязка кликом по ячейке сетки */
  spotlightAimMode: "point" | "cell";
  /** Общий рабочий свет сцены: выключен = светят только софиты. */
  dutyLightEnabled: boolean;
  /** Цвет фона 3D-сцены вокруг театра. */
  sceneBackgroundColor: string;
  /** Направляющие линии от источника софита к цели в 3D и на плане. */
  showSpotlightGuideLines: boolean;
  /**
   * При растягивании зала ручками объекты (декор, софиты) остаются на месте.
   * Выключи — поедут вместе со стенами.
   */
  hallResizeKeepObjects: boolean;
};

export const DEFAULT_THEATER_VIEW_PREFS: TheaterViewPrefs = {
  showGrid: true,
  showStageGrid: true,
  snapToGrid: true,
  gridStep: 0.5,
  showSeats: true,
  wallsOpaque: false,
  wallsHidden: false,
  wallsHideFromCamera: true,
  showFloorPlan: true,
  floorPlanMaxSide: 196,
  spectaclePreviewMode: false,
  alignGuidesEnabled: true,
  activeTab: "spotlights",
  outlineDrawMode: false,
  swapTheaterPanels: false,
  showTheaterControls: true,
  spotlightAimMode: "point",
  dutyLightEnabled: true,
  sceneBackgroundColor: "#6b7280",
  showSpotlightGuideLines: true,
  lightConsoleExpanded: false,
  hallResizeKeepObjects: true,
};

export function theaterViewPrefsStorageKey(projectName: string) {
  return `orchestra-theater-view:${projectName || "default"}`;
}

function readBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number, min?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (min != null) return Math.max(min, value);
  return value;
}

function readHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function readTab(value: unknown): TheaterViewPrefs["activeTab"] {
  if (value === "console") return "spotlights";
  if (
    value === "navigate" ||
    value === "spotlights" ||
    value === "models" ||
    value === "view" ||
    value === "layout" ||
    value === "decor"
  ) {
    return value;
  }
  return DEFAULT_THEATER_VIEW_PREFS.activeTab;
}

export function readTheaterViewPrefs(projectName: string): TheaterViewPrefs {
  try {
    const raw = localStorage.getItem(theaterViewPrefsStorageKey(projectName));
    if (!raw) return DEFAULT_THEATER_VIEW_PREFS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      showGrid: readBool(parsed.showGrid, DEFAULT_THEATER_VIEW_PREFS.showGrid),
      showStageGrid: readBool(
        parsed.showStageGrid,
        DEFAULT_THEATER_VIEW_PREFS.showStageGrid,
      ),
      snapToGrid: readBool(parsed.snapToGrid, DEFAULT_THEATER_VIEW_PREFS.snapToGrid),
      gridStep: readNumber(parsed.gridStep, DEFAULT_THEATER_VIEW_PREFS.gridStep, 0.1),
      showSeats: readBool(parsed.showSeats, DEFAULT_THEATER_VIEW_PREFS.showSeats),
      wallsOpaque: readBool(parsed.wallsOpaque, DEFAULT_THEATER_VIEW_PREFS.wallsOpaque),
      wallsHidden: readBool(parsed.wallsHidden, DEFAULT_THEATER_VIEW_PREFS.wallsHidden),
      wallsHideFromCamera: readBool(
        parsed.wallsHideFromCamera,
        DEFAULT_THEATER_VIEW_PREFS.wallsHideFromCamera,
      ),
      showFloorPlan: readBool(parsed.showFloorPlan, DEFAULT_THEATER_VIEW_PREFS.showFloorPlan),
      floorPlanMaxSide: Math.min(
        720,
        readNumber(
          parsed.floorPlanMaxSide,
          parsed.floorPlanExpanded === true
            ? 420
            : DEFAULT_THEATER_VIEW_PREFS.floorPlanMaxSide,
          140,
        ),
      ),
      spectaclePreviewMode: readBool(
        parsed.spectaclePreviewMode,
        DEFAULT_THEATER_VIEW_PREFS.spectaclePreviewMode,
      ),
      alignGuidesEnabled: readBool(
        parsed.alignGuidesEnabled,
        DEFAULT_THEATER_VIEW_PREFS.alignGuidesEnabled,
      ),
      activeTab: readTab(parsed.activeTab),
      outlineDrawMode: readBool(parsed.outlineDrawMode, DEFAULT_THEATER_VIEW_PREFS.outlineDrawMode),
      swapTheaterPanels: readBool(
        parsed.swapTheaterPanels,
        DEFAULT_THEATER_VIEW_PREFS.swapTheaterPanels,
      ),
      showTheaterControls: readBool(
        parsed.showTheaterControls,
        DEFAULT_THEATER_VIEW_PREFS.showTheaterControls,
      ),
      spotlightAimMode:
        parsed.spotlightAimMode === "cell" ? "cell" : DEFAULT_THEATER_VIEW_PREFS.spotlightAimMode,
      dutyLightEnabled: readBool(
        parsed.dutyLightEnabled,
        DEFAULT_THEATER_VIEW_PREFS.dutyLightEnabled,
      ),
      sceneBackgroundColor: readHexColor(
        parsed.sceneBackgroundColor,
        DEFAULT_THEATER_VIEW_PREFS.sceneBackgroundColor,
      ),
      showSpotlightGuideLines: readBool(
        parsed.showSpotlightGuideLines,
        DEFAULT_THEATER_VIEW_PREFS.showSpotlightGuideLines,
      ),
      lightConsoleExpanded: readBool(
        parsed.lightConsoleExpanded,
        parsed.activeTab === "console"
          ? true
          : DEFAULT_THEATER_VIEW_PREFS.lightConsoleExpanded,
      ),
      hallResizeKeepObjects: readBool(
        parsed.hallResizeKeepObjects,
        DEFAULT_THEATER_VIEW_PREFS.hallResizeKeepObjects,
      ),
    };
  } catch {
    return DEFAULT_THEATER_VIEW_PREFS;
  }
}

export function writeTheaterViewPrefs(projectName: string, prefs: Partial<TheaterViewPrefs>) {
  try {
    const merged: TheaterViewPrefs = {
      ...readTheaterViewPrefs(projectName),
      ...prefs,
    };
    localStorage.setItem(theaterViewPrefsStorageKey(projectName), JSON.stringify(merged));
  } catch {
    // ignore
  }
}

export function patchTheaterViewPrefs(projectName: string, patch: Partial<TheaterViewPrefs>) {
  writeTheaterViewPrefs(projectName, patch);
}
