export interface ScriptStep {
  id: number;
  title: string;
  markdown: string;
  playMarkdown?: string;
  /** Режиссёрская экспликация для шага (markdown). */
  explicationMarkdown?: string;
  /** Длительность шага в минутах (для планирования сессий / слотов). */
  durationMin?: number;
  requisites?: ScriptRequisite[];
  lightPlot?: LightFixture[];
  /** Таймлайн световых cue для шага */
  lightCues?: LightCue[];
  /** Световые картины (look на границе ### Картина N) */
  lightKadrs?: StepLightKadrsDataV1;
  theaterSpotlights?: TheaterSpotlight[];
  theaterActiveSpotlightId?: number;
  theaterModels?: TheaterModel[];
  /** Декор сцены (если задан — GLB/служебные модели остаются в theaterModels). */
  theaterDecor?: TheaterModel[];
  theaterActiveModelId?: number;
  /**
   * Канбан-статус готовности "сцены" (шаг сценария).
   * Хранится в Step и синкается как часть шага.
   */
  kanbanStatus?: "raw" | "text-learned" | "almost-ready" | "ready";
  /** Порядок карточки в колонке канбана (не влияет на порядок шагов в сценарии). */
  kanbanOrder?: number;
}

export interface ScriptRequisite {
  id: number;
  label: string;
  checked: boolean;
  /** Кто выставляет/подготавливает реквизит для шага. */
  setupAssignees?: string[];
  /** Кто уносит/убирает реквизит после шага. */
  removeAssignees?: string[];
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

/** Снимок света для картины (### Картина N + <!-- lk:id -->). */
export interface StepLightKadrV1 {
  id: string;
  kadrNo: number;
  title?: string;
  programId: number;
  faders: StepLightKadrFaderStateV1[];
  /** K, отмеченные в toggles при «Записать свет». */
  recordChannels?: number[];
  nextProgramId?: number;
  blackout?: boolean;
  note?: string;
  updatedAt?: string;
}

export type StepLightKadrFaderStateV1 = {
  faderId: number;
  /** K на пульте при записи (не путать с faderId: F8 на K1 → channel 1). */
  channel?: number;
  intensity?: number;
  enabled?: boolean;
};

export type StepLightKadrsDataV1 = {
  v: 1;
  kadrs: StepLightKadrV1[];
};

/** Ключевой кадр света на таймлайне шага (секунды от начала). */
export interface LightCue {
  id: number;
  /** Секунды от начала шага */
  tSec: number;
  /** Номер светового канала (строка, как в lightPlot) */
  channel: string;
  intensity?: number;
  enabled?: boolean;
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
  /** Скрыт в редакторе (данные сохраняются) */
  hidden?: boolean;
  channel?: number;
  /** Номер ползунка пульта, к которому привязан софит. */
  faderId?: number;
  isRgb?: boolean;
  /** Привязка цели к ячейке сетки сцены (столбец, ряд от задника) */
  gridCol?: number;
  gridRow?: number;
}

export interface TheaterModel {
  id: number;
  name: string;
  file?: string;
  type?: "file" | "builtin";
  builtin?:
    | "table"
    | "roundTable"
    | "chair"
    | "sofa"
    | "bench"
    | "cabinet"
    | "blackCube"
    | "strawGrid"
    | "actor"
    | "humanStanding"
    | "humanSitting"
    | "humanSmoothStanding"
    | "humanSmoothSitting"
    | "fence"
    | "dancer"
    | "flat"
    | "curtain"
    | "hangingFabric"
    | "platform"
    | "screen";
  /** Размеры параметрического декора в метрах: ширина, высота, глубина */
  decorSize?: [number, number, number];
  decorColor?: string;
  /** preset:velvet-crimson или file:images/photo.jpg */
  decorTexture?: string;
  /** Плиток текстуры на 1 метр (режим «Плитка») */
  decorTextureRepeat?: number;
  /** repeat — плитка, cover — заполнить, contain — вместить */
  decorTextureMode?: "repeat" | "cover" | "contain" | "once";
  /** Грани параметрического декора с текстурой (flat, platform, screen) */
  decorTextureFaces?: Array<"front" | "back" | "top" | "bottom">;
  /** Для тонких поверхностей декора: видна только лицевая сторона. */
  decorOneSided?: boolean;
  decorOpacity?: number;
  decorRoughness?: number;
  decorMetalness?: number;
  decorEmissiveColor?: string;
  decorEmissiveIntensity?: number;
  decorMaterialSide?: "front" | "back" | "double";
  /** Цвета встроенных моделей людей. Работают, если GLB содержит части Skin/Shirt/Pants/Shoes. */
  humanSkinColor?: string;
  humanTopColor?: string;
  humanBottomColor?: string;
  humanShoeColor?: string;
  allowOutOfBounds?: boolean;
  /** Отключает откат трансформации при пересечении с другими моделями. */
  ignoreCollisions?: boolean;
  /** Скрыт в редакторе (данные сохраняются) */
  hidden?: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export type TheaterDoorWall = "left" | "right" | "back" | "front";

/** Форма сцены в плане (контур стен) */
export type TheaterStageShape = "rectangle" | "trapezoid" | "t-shape" | "custom";

/** Углубление / ниша в стене сцены */
export type TheaterWallRecessWall = "left" | "right" | "back";

export interface TheaterWallRecess {
  id: number;
  wall: TheaterWallRecessWall;
  /** Позиция вдоль стены: Z для left/right, X для back */
  pos: number;
  /** Длина вдоль стены, м */
  width: number;
  /** Глубина углубления внутрь сцены, м */
  depth: number;
}

export interface TheaterDoor {
  id: number;
  wall: TheaterDoorWall;
  /** Позиция вдоль стены: Z для left/right, X для back/front */
  pos: number;
  width: number;
  height: number;
}

export type TheaterSurfaceTextureMode = "repeat" | "cover" | "contain" | "once";

export interface TheaterSurfaceMaterial {
  color?: string;
  texture?: string;
  textureRepeat?: number;
  textureMode?: TheaterSurfaceTextureMode;
}

export interface TheaterLayout {
  hallWidth: number;
  hallDepth: number;
  wallHeight: number;
  audienceStartZ: number;
  /** Z передней линии сцены (сторона к залу); не зависит от кресел */
  stageFrontZ?: number;
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
  /** Несколько дверей; если пусто — используются doorWidth/doorHeight/doorZ */
  doors?: TheaterDoor[];
  /** Ширина сцены у задней стены, м (по умолчанию = hallWidth) */
  stageBackWidth?: number;
  /** Ширина у линии зала / «ножки» Т-сцены, м (по умолчанию = hallWidth) */
  prosceniumWidth?: number;
  /** Высота проёма арки, м (по умолчанию = wallHeight) */
  prosceniumHeight?: number;
  /** Включить портал (сужение к залу); если false — прямоугольные боковые стены */
  prosceniumEnabled?: boolean;
  /** Форма контура сцены */
  stageShape?: TheaterStageShape;
  /** Z-координата «перелома» Т-сцены (где сужается к залу) */
  tJunctionZ?: number;
  /** Углубления в стенах сцены */
  wallRecesses?: TheaterWallRecess[];
  /** Вершины контура сцены [x, z] в метрах (для stageShape = custom) */
  stageOutline?: [number, number][];
  /** Индексы рёбер без стены (обычно сторона к залу) */
  stageOutlineOpenEdges?: number[];
  /** Сетка зон на полу сцены */
  zoneGrid?: TheaterZoneGrid;
  /** Макрозоны (полосы сетки), каждая может делиться на подзоны */
  zones?: TheaterZone[];
  /** Материалы основных поверхностей 3D-театра. */
  stageFloorMaterial?: TheaterSurfaceMaterial;
  hallFloorMaterial?: TheaterSurfaceMaterial;
  backWallMaterial?: TheaterSurfaceMaterial;
  sideWallsMaterial?: TheaterSurfaceMaterial;
  portalMaterial?: TheaterSurfaceMaterial;
}

/** Сетка пола сцены: cols по ширине, rows от задника к авансцене */
export interface TheaterZoneGrid {
  cols: number;
  rows: number;
}

/** Пресет зоны — для шаблонов и подписей */
export type TheaterZonePreset = "custom" | "avanscena" | "center" | "depth";

export interface TheaterZone {
  id: number;
  label: string;
  preset?: TheaterZonePreset;
  /** Ячейки сетки (включительно), col — ширина, row 0 — зад сцены */
  col0: number;
  col1: number;
  row0: number;
  row1: number;
  /** Деление зоны на подзоны */
  subCols?: number;
  subRows?: number;
  color?: string;
  hidden?: boolean;
  /** Контур для отрисовки (вычисляется из сетки и контура сцены) */
  outline?: [number, number][];
}
