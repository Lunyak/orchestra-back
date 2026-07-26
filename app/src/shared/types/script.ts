export interface ScriptScene {
  id: number;
  title: string;
  markdown: string;
  playMarkdown?: string;
  /** Режиссёрская экспликация для сцены (markdown). */
  explicationMarkdown?: string;
  /** Длительность сцены в минутах (для планирования сессий / слотов). */
  durationMin?: number;
  requisites?: ScriptRequisite[];
  lightPlot?: LightFixture[];
  /** Таймлайн световых cue для сцены */
  lightCues?: LightCue[];
  /** Картины сцены (свет / звук / проектор). Источник истины — JSON, не markdown. */
  lightKadrs?: SceneLightKadrsDataV1;
  /** Дым-машина включена на сцене. */
  theaterSmokeMachine?: boolean;
  theaterSpotlights?: TheaterSpotlight[];
  theaterActiveSpotlightId?: number;
  theaterModels?: TheaterModel[];
  /** Декор сцены (если задан — GLB/служебные модели остаются в theaterModels). */
  theaterDecor?: TheaterModel[];
  theaterActiveModelId?: number;
  /**
   * Канбан-статус готовности сцены сценария.
   * Хранится в ScriptScene и синкается как часть сцены.
   */
  kanbanStatus?: "raw" | "text-learned" | "almost-ready" | "ready";
  /** Порядок карточки в колонке канбана (не влияет на порядок сцен в сценарии). */
  kanbanOrder?: number;
}

/** Назначение реквизита на сцене: занести / унести / манипуляции. */
export type ScriptRequisiteDuty = "setup" | "strike" | "use";

export interface ScriptRequisite {
  id: number;
  label: string;
  checked: boolean;
  /** Связь с моделью 3D-театра (если реквизит создан из flagged-модели). */
  theaterModelId?: number;
  /** Ключ файла аватарки реквизита в project files. */
  avatarKey?: string;
  /** Ответственный (email участника театра). */
  assigneeEmail?: string;
  /** Действие ответственного. */
  duty?: ScriptRequisiteDuty;
  /** Куда ставить (для duty=setup / занести). */
  placeNote?: string;
  /** Что сделать (для duty=use / манипуляции). */
  actionNote?: string;
}

/** Действие с реквизитом на картине. */
export type SceneLightKadrRequisiteActionV1 = "setup" | "strike" | "use";

export type SceneLightKadrRequisiteCueV1 = {
  requisiteId: number;
  action: SceneLightKadrRequisiteActionV1;
};

export interface LightFixture {
  id: number;
  label: string;
  channel: string;
  x: number;
  y: number;
  angle?: number;
  length?: number;
}

/** Звук картины (плейлист / SFX). */
export type SceneLightKadrSoundCueV1 = {
  playTrackIds?: number[];
  soundIds?: number[];
  /** Громкость плеера 0…1. */
  volume?: number;
  fadeMs?: number;
};

/** Проектор / видео картины. */
export type SceneLightKadrProjectorCueV1 =
  | { mode: "hold"; holdId?: number }
  | { mode: "video"; videoId: number; muted?: boolean };

/** Картина сцены: look + медиа (источник истины — JSON). */
export interface SceneLightKadrV1 {
  id: string;
  kadrNo: number;
  title?: string;
  programId: number;
  faders: SceneLightKadrFaderStateV1[];
  /** K, отмеченные в toggles при «Записать свет». */
  recordChannels?: number[];
  nextProgramId?: number;
  blackout?: boolean;
  /** Дым-машина активна на этом шаге. */
  smokeMachine?: boolean;
  sound?: SceneLightKadrSoundCueV1;
  projector?: SceneLightKadrProjectorCueV1;
  /** Реквизит на картине: вынести / убрать / использовать. */
  requisites?: SceneLightKadrRequisiteCueV1[];
  transitionText?: string;
  commentText?: string;
  blackoutDurationSec?: number;
  smokeDurationSec?: number;
  /** Markdown-фрагмент картинки для превью в ленте. */
  imageMarkdown?: string;
  note?: string;
  updatedAt?: string;
}

export type SceneLightKadrFaderStateV1 = {
  faderId: number;
  /** K на пульте при записи (не путать с faderId: F8 на K1 → channel 1). */
  channel?: number;
  intensity?: number;
  enabled?: boolean;
};

export type SceneLightKadrsDataV1 = {
  v: 1;
  kadrs: SceneLightKadrV1[];
};

/** Ключевой кадр света на таймлайне сцены (секунды от начала). */
export interface LightCue {
  id: number;
  /** Секунды от начала сцены */
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
  modelLowDetail?: boolean;
  mountModelId?: number;
  mountPointId?: string;
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
    | "stageActor"
    | "stageSpotlight"
    | "lightTruss6m"
    | "libraryWoodenChair"
    | "libraryVelvetArmchair"
    | "libraryVelvetSofa"
    | "libraryDiningTable"
    | "libraryRoundPedestalTable"
    | "libraryBarStool"
    | "libraryWoodenBench"
    | "libraryDisplayCabinet"
    | "libraryDresser"
    | "libraryBookshelf"
    | "librarySingleBed"
    | "libraryRoomDivider"
    | "librarySpiralStaircase"
    | "libraryTravelTrunk"
    | "libraryVintageSuitcase"
    | "libraryWoodenBarrel"
    | "libraryWoodenCrate"
    | "libraryFloorLamp"
    | "libraryCandelabrum"
    | "libraryStandingMirror"
    | "libraryCoatRack"
    | "libraryGramophone"
    | "libraryRotaryTelephone"
    | "libraryCeramicVase"
    | "libraryGildedPictureFrame"
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
  actorPose?: "stand" | "sit" | "lie";
  modelLowDetail?: boolean;
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
  /** Модель помечена как реквизит сцены. */
  isRequisite?: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export type TheaterDoorWall = "left" | "right" | "back" | "front";

/** Форма сцены в плане (контур стен) */
export type TheaterStageShape =
  "rectangle" | "trapezoid" | "t-shape" | "custom";

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

export type TheaterDoorStyle = "wood" | "metal";

export interface TheaterDoor {
  id: number;
  wall: TheaterDoorWall;
  /** Позиция вдоль стены: Z для left/right, X для back/front */
  pos: number;
  width: number;
  height: number;
  /** Внешний вид 3D-модели двери */
  style?: TheaterDoorStyle;
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
  /** Смещение центра зала по X, м (для одностороннего расширения) */
  hallOffsetX?: number;
  /** Смещение центра зала по Z, м (для одностороннего расширения) */
  hallOffsetZ?: number;
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
