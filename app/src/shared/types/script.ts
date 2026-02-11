export interface ScriptStep {
  id: number;
  title: string;
  markdown: string;
  playMarkdown?: string;
  requisites?: ScriptRequisite[];
  lightPlot?: LightFixture[];
  theaterSpotlights?: TheaterSpotlight[];
  theaterActiveSpotlightId?: number;
  theaterModels?: TheaterModel[];
  theaterActiveModelId?: number;
  /**
   * Канбан-статус готовности "сцены" (шаг сценария).
   * Хранится в rawJson сцены и синкается как часть steps.
   */
  kanbanStatus?: "raw" | "text-learned" | "almost-ready" | "ready";
  /** Порядок карточки в колонке канбана (не влияет на порядок шагов в сценарии). */
  kanbanOrder?: number;
  /** Назначения ролей: роль -> исполнитель (любая строка: имя/почта). */
  cast?: Record<string, string>;
}

export interface ScriptRequisite {
  id: number;
  label: string;
  checked: boolean;
}

export interface LightFixture {
  id: number;
  label: string;
  channel: string;
  x: number;
  y: number;
  angle?: number;
  length?: number;
}

export interface TheaterSpotlight {
  id: number;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  angleDeg: number;
  intensity: number;
  color?: string;
  enabled?: boolean;
  channel?: number;
  isRgb?: boolean;
}

export interface TheaterModel {
  id: number;
  name: string;
  file?: string;
  type?: "file" | "builtin";
  builtin?:
    | "roundTable"
    | "chair"
    | "bench"
    | "cabinet"
    | "blackCube"
    | "strawGrid"
    | "actor"
    | "fence"
    | "dancer";
  allowOutOfBounds?: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface TheaterLayout {
  hallWidth: number;
  hallDepth: number;
  wallHeight: number;
  audienceStartZ: number;
  seatRows: number;
  seatsPerRow: number;
  seatSpacing: number;
  rowSpacing: number;
  rowRise: number;
  aisleWidth: number;
  aisleCenterX: number;
  doorWidth: number;
  doorHeight: number;
  doorZ: number;
}
