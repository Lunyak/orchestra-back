import type { TheaterLayout } from "../../../shared/types/script";
import { normalizeLayoutDoorsFields } from "./theater-doors";
import { normalizeLayoutWallOpeningFields } from "./theater-wall-openings";
import { normalizeLayoutWallRecessFields } from "./theater-wall-recesses";
import type { TheaterStageShape } from "../../../shared/types/script";
import {
  normalizeHiddenWalls,
  resolveStageGeometry,
  resolveStageRise,
  resolveStageShape,
} from "./theater-stage-geometry";
import { normalizeStageOutlineFields } from "./theater-custom-outline";
import { normalizeTheaterZonesFields } from "./theater-zones";
import { normalizeTheaterSurfaceMaterials } from "./theater-surface-materials";
import {
  normalizeLayoutAisleFields,
  resolveLayoutAisles,
  totalAisleWidth,
} from "./theater-aisles";

/** Все размеры сцены — в метрах (СИ). */
export const THEATER_UNIT = "м";

export const METRIC = {
  seatPitch: 0.55,
  rowPitch: 0.85,
  rowRise: 0.3,
  aisleWidth: 1.2,
  wallHeight: 4,
  sideClearance: 0.5,
  stageClearance: 0.8,
  backClearance: 0.8,
  chairSeatHeight: 0.45,
  chairWidthRatio: 0.88,
  chairWidthMax: 0.6,
  chairDepth: 0.45,
} as const;

export type ChairMetrics = {
  width: number;
  depth: number;
  seatThickness: number;
  backHeight: number;
  leg: number;
  floorY: number;
};

export function labelM(name: string) {
  return name;
}

export function roundM(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.trunc(clamp(value, min, max));
}

export function getChairMetrics(seatSpacing: number): ChairMetrics {
  const pitch = clamp(seatSpacing, 0.45, 1.2);
  const width = roundM(Math.min(METRIC.chairWidthMax, pitch * METRIC.chairWidthRatio));
  return {
    width,
    depth: METRIC.chairDepth,
    seatThickness: 0.08,
    backHeight: roundM(width * 0.86),
    leg: roundM(width * 0.11),
    floorY: METRIC.chairSeatHeight,
  };
}

/** Шаг центров кресел: 0.55 м, сжимается только если ряд не влезает. */
export function computeSeatSpacing(
  layout: Pick<TheaterLayout, "hallWidth" | "seatsPerRow" | "aisleWidth" | "aisleCenterX" | "aisles">,
) {
  const seats = clampInt(layout.seatsPerRow, 1, 200);
  if (seats <= 1) return METRIC.seatPitch;
  const aisle = clamp(totalAisleWidth(layout), 0, layout.hallWidth * 0.55);
  const usable = layout.hallWidth - 2 * METRIC.sideClearance - aisle;
  const fitPitch = usable / Math.max(seats - 1, 1);
  return roundM(clamp(Math.min(METRIC.seatPitch, fitPitch), 0.45, METRIC.seatPitch));
}

/** Центры кресел одного ряда: проходы раздвигают места, а не вырезают их. */
export function buildSeatRowXs(
  layout: Pick<
    TheaterLayout,
    "seatsPerRow" | "seatSpacing" | "aisleWidth" | "aisleCenterX" | "aisles"
  >,
): number[] {
  const seats = clampInt(layout.seatsPerRow, 1, 200);
  const spacing = layout.seatSpacing;
  const aisles = resolveLayoutAisles(layout)
    .filter((aisle) => aisle.width > 0)
    .sort((a, b) => a.centerX - b.centerX);
  if (seats <= 0) return [];
  if (aisles.length === 0 || seats === 1) {
    const offset = (seats - 1) * spacing * 0.5;
    return Array.from({ length: seats }, (_, index) =>
      roundM(index * spacing - offset),
    );
  }

  const offset = (seats - 1) * spacing * 0.5;
  const splits = aisles.map((aisle) => {
    let leftCount = 0;
    for (let index = 0; index < seats; index += 1) {
      if (index * spacing - offset < aisle.centerX) leftCount += 1;
      else break;
    }
    return leftCount;
  });

  const packed: number[] = [];
  for (let index = 0; index < seats; index += 1) {
    let extra = 0;
    for (let aisleIndex = 0; aisleIndex < aisles.length; aisleIndex += 1) {
      if (index >= splits[aisleIndex]) extra += aisles[aisleIndex].width;
    }
    packed.push(index * spacing + extra);
  }

  let shiftSum = 0;
  for (let aisleIndex = 0; aisleIndex < aisles.length; aisleIndex += 1) {
    const aisle = aisles[aisleIndex];
    const leftCount = splits[aisleIndex];
    const extraBefore = aisles
      .slice(0, aisleIndex)
      .reduce((sum, item) => sum + item.width, 0);
    const lastLeft =
      leftCount > 0 ? (leftCount - 1) * spacing + extraBefore : extraBefore - aisle.width;
    const firstRight =
      leftCount < seats
        ? leftCount * spacing + extraBefore + aisle.width
        : lastLeft + aisle.width;
    const gapCenter = (lastLeft + firstRight) / 2;
    shiftSum += aisle.centerX - gapCenter;
  }
  const shift = shiftSum / aisles.length;
  return packed.map((x) => roundM(x + shift));
}

export function getAudienceHallEndZ(layout: Pick<TheaterLayout, "hallDepth">) {
  return layout.hallDepth / 2 - METRIC.stageClearance;
}

function explicitStageFrontZ(
  layout: Pick<TheaterLayout, "stageFrontZ">,
): number | null {
  if (layout.stageFrontZ != null && Number.isFinite(layout.stageFrontZ)) {
    return layout.stageFrontZ;
  }
  return null;
}

type AudienceZLayout = Pick<TheaterLayout, "hallDepth" | "seatRows" | "rowSpacing"> &
  Partial<Pick<TheaterLayout, "stageFrontZ" | "audienceStartZ">>;

export function getAudienceStartZBounds(layout: AudienceZLayout) {
  const halfD = layout.hallDepth / 2;
  const hallEnd = getAudienceHallEndZ(layout);
  const hallMin = -halfD + METRIC.backClearance;
  const stageFront = explicitStageFrontZ(layout);
  const afterStage = stageFront ?? hallMin;
  const min = roundM(Math.min(hallEnd, Math.max(hallMin, afterStage)));
  const blockDepth =
    layout.seatRows > 0 ? (layout.seatRows - 1) * layout.rowSpacing : 0;
  const max = layout.seatRows > 0 ? roundM(Math.max(min, hallEnd - blockDepth)) : hallEnd;
  return { min, max };
}

export function countFittingAudienceRows(
  layout: Pick<TheaterLayout, "hallDepth" | "rowSpacing"> &
    Partial<Pick<TheaterLayout, "stageFrontZ">>,
) {
  const { min } = getAudienceStartZBounds({ ...layout, seatRows: 1 });
  const hallEnd = getAudienceHallEndZ(layout);
  const span = Math.max(0, hallEnd - min);
  return 1 + Math.floor(span / Math.max(layout.rowSpacing, 0.55));
}

export function resolveAudienceStartZ(layout: AudienceZLayout & Pick<TheaterLayout, "audienceStartZ">) {
  const { min, max } = getAudienceStartZBounds(layout);
  return roundM(clamp(layout.audienceStartZ, min, max));
}

export function countFittingSeatsPerRow(
  layout: Pick<
    TheaterLayout,
    | "hallWidth"
    | "hallDepth"
    | "seatsPerRow"
    | "seatSpacing"
    | "aisleWidth"
    | "aisleCenterX"
    | "aisles"
    | "seatRows"
    | "rowSpacing"
    | "audienceStartZ"
  > &
    Partial<Pick<TheaterLayout, "stageFrontZ">>,
) {
  const startZ = resolveAudienceStartZ(layout);
  return buildSeatRowXs(layout).filter((x) => isAudienceSeatInHall(layout, x, startZ)).length;
}

export function isAudienceSeatInHall(
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth" | "stageFrontZ" | "audienceLayout">,
  x: number,
  z: number,
) {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const hallEnd = getAudienceHallEndZ(layout);
  if (z < -halfD + 0.15 || z > halfD - 0.15) return false;
  if (Math.abs(x) > halfW - 0.15) return false;
  const radial = layout.audienceLayout === "arc" || layout.audienceLayout === "surround";
  if (radial) return true;
  const stageFront = explicitStageFrontZ(layout);
  if (stageFront != null && z < Math.min(stageFront, hallEnd) - 0.05) return false;
  return true;
}

/** Линия между сценой и зрительским залом (первая линия рядов). */
export function getAudienceBoundaryZ(
  layout: Pick<TheaterLayout, "audienceStartZ">,
): number {
  return layout.audienceStartZ;
}

const MIN_STAGE_SPAN = 0.5;

export function getStageBackZ(
  layout: Pick<TheaterLayout, "hallDepth" | "stageBackZ">,
) {
  const halfD = layout.hallDepth / 2;
  if (layout.stageBackZ != null && Number.isFinite(layout.stageBackZ)) {
    return layout.stageBackZ;
  }
  return -halfD;
}

export function getStageBackZBounds(
  layout: Pick<TheaterLayout, "hallDepth" | "stageFrontZ" | "audienceStartZ">,
) {
  const halfD = layout.hallDepth / 2;
  const front = getStageFrontZ(layout);
  return {
    min: roundM(-halfD),
    max: roundM(front - MIN_STAGE_SPAN),
  };
}

export function getStageFrontZBounds(
  layout: Pick<TheaterLayout, "hallDepth" | "stageBackZ">,
) {
  const halfD = layout.hallDepth / 2;
  const back = getStageBackZ(layout);
  const min = Math.max(-halfD + METRIC.backClearance + MIN_STAGE_SPAN, back + MIN_STAGE_SPAN);
  const max = halfD - METRIC.stageClearance;
  return { min: roundM(min), max: roundM(max) };
}

/** Передняя грань сцены (стены), независимо от расположения кресел. */
export function getStageFrontZ(
  layout: Pick<TheaterLayout, "hallDepth" | "stageFrontZ" | "audienceStartZ">,
): number {
  if (layout.stageFrontZ != null && Number.isFinite(layout.stageFrontZ)) {
    return layout.stageFrontZ;
  }
  return layout.audienceStartZ;
}

export function centerStageInHall(
  layout: Pick<TheaterLayout, "hallDepth" | "stageFrontZ" | "stageBackZ" | "audienceStartZ">,
) {
  const front = getStageFrontZ(layout);
  const back = getStageBackZ(layout);
  const depth = Math.max(MIN_STAGE_SPAN, front - back);
  const maxDepth = Math.max(MIN_STAGE_SPAN, layout.hallDepth - 0.2);
  const used = Math.min(depth, maxDepth);
  return {
    stageBackZ: roundM(-used / 2),
    stageFrontZ: roundM(used / 2),
  };
}

/** Первая линия рядов: блок кресел у стены зала (+Z), сцена занимает остаток. */
export function computeAudienceStartZ(
  layout: Pick<TheaterLayout, "hallDepth" | "seatRows" | "rowSpacing">,
) {
  const { min, max } = getAudienceStartZBounds(layout);
  if (layout.seatRows <= 0) return roundM(min);
  return roundM(max);
}

/** Нормализация сохранённого плана (не пересчитывать Z кресел). */
export function normalizePersistedTheaterLayout(layout: TheaterLayout): TheaterLayout {
  return normalizeTheaterLayout(layout, { preserveAudienceStartZ: true });
}

export function normalizeTheaterLayout(
  layout: TheaterLayout,
  options?: { preserveAudienceStartZ?: boolean },
): TheaterLayout {
  const hallWidth = roundM(clamp(layout.hallWidth, 4, 80));
  const hallDepth = roundM(clamp(layout.hallDepth, 4, 80));
  const wallHeight = roundM(clamp(layout.wallHeight, 2.5, 20));
  const hallOffsetX = roundM(
    Number.isFinite(layout.hallOffsetX) ? (layout.hallOffsetX as number) : 0,
  );
  const hallOffsetZ = roundM(
    Number.isFinite(layout.hallOffsetZ) ? (layout.hallOffsetZ as number) : 0,
  );

  const seatRows = clampInt(layout.seatRows, 0, 80);
  const seatsPerRow = clampInt(layout.seatsPerRow, 1, 200);

  const rowSpacing = roundM(clamp(layout.rowSpacing, 0.55, 1.5));
  const rowRise = roundM(clamp(layout.rowRise, 0, 0.6));
  const aisleFields = normalizeLayoutAisleFields({
    ...layout,
    hallWidth,
  });
  const aisleWidth = aisleFields.aisleWidth;
  const aisleCenterX = aisleFields.aisleCenterX;
  const aisles = aisleFields.aisles;

  const draft = {
    ...layout,
    hallWidth,
    hallDepth,
    wallHeight,
    seatRows,
    seatsPerRow,
    rowSpacing,
    rowRise,
    aisleWidth,
    aisleCenterX,
    aisles,
  };

  const seatSpacing = computeSeatSpacing(draft);
  const { min: minAudienceZ, max: maxAudienceStartZ } = getAudienceStartZBounds({
    hallDepth,
    seatRows,
    rowSpacing,
    stageFrontZ: layout.stageFrontZ,
  });
  let audienceStartZ: number;
  if (options?.preserveAudienceStartZ) {
    audienceStartZ = roundM(clamp(layout.audienceStartZ, minAudienceZ, maxAudienceStartZ));
  } else if (seatRows > 0) {
    audienceStartZ = computeAudienceStartZ({ hallDepth, seatRows, rowSpacing });
  } else {
    audienceStartZ = roundM(clamp(layout.audienceStartZ, minAudienceZ, maxAudienceStartZ));
  }

  const defaultBackZ = -hallDepth / 2;
  const rawBackZ = getStageBackZ({ hallDepth, stageBackZ: layout.stageBackZ });
  const { min: minStageFrontZ, max: maxStageFrontZ } = getStageFrontZBounds({
    hallDepth,
    stageBackZ: rawBackZ,
  });
  let stageFrontZ: number;
  if (layout.stageFrontZ != null && Number.isFinite(layout.stageFrontZ)) {
    stageFrontZ = roundM(clamp(layout.stageFrontZ, minStageFrontZ, maxStageFrontZ));
  } else {
    stageFrontZ = roundM(clamp(audienceStartZ, minStageFrontZ, maxStageFrontZ));
  }
  const { min: minStageBackZ, max: maxStageBackZ } = getStageBackZBounds({
    hallDepth,
    stageFrontZ,
    audienceStartZ,
  });
  const stageBackZ = roundM(clamp(rawBackZ, minStageBackZ, maxStageBackZ));

  const stageBackWidth = roundM(clamp(layout.stageBackWidth ?? hallWidth, 2, hallWidth));
  const prosceniumWidth = roundM(clamp(layout.prosceniumWidth ?? hallWidth, 2, hallWidth));
  const stageHallFollowDebt = roundM(Math.max(0, layout.stageHallFollowDebt ?? 0));
  const prosceniumHeight = roundM(clamp(layout.prosceniumHeight ?? wallHeight, 2, wallHeight));
  const stageShape: TheaterStageShape = resolveStageShape(layout);
  const audienceLayout =
    layout.audienceLayout === "arc" || layout.audienceLayout === "surround"
      ? layout.audienceLayout
      : layout.audienceLayout === "rows"
        ? "rows"
        : undefined;
  const prosceniumEnabled = layout.prosceniumEnabled === true;
  const stageRise = roundM(resolveStageRise(layout));
  const hiddenWalls = normalizeHiddenWalls(layout);

  const geomDraft = resolveStageGeometry({
    ...layout,
    hallWidth,
    hallDepth,
    wallHeight,
    audienceStartZ,
    stageFrontZ,
    stageBackZ,
    stageBackWidth,
    prosceniumWidth,
    prosceniumHeight,
    stageShape,
    prosceniumEnabled,
  });
  const tJunctionZ = roundM(
    clamp(
      layout.tJunctionZ ?? geomDraft.tJunctionZ,
      geomDraft.backZ + (geomDraft.prosceniumZ - geomDraft.backZ) * 0.2,
      geomDraft.prosceniumZ - (geomDraft.prosceniumZ - geomDraft.backZ) * 0.15,
    ),
  );

  const recessFields = normalizeLayoutWallRecessFields({
    ...layout,
    hallWidth,
    hallDepth,
    wallHeight,
    audienceStartZ,
    stageFrontZ,
    stageBackWidth,
    prosceniumWidth,
    prosceniumHeight,
    stageShape,
    prosceniumEnabled,
    tJunctionZ,
  });

  const openingFields = normalizeLayoutWallOpeningFields({
    ...layout,
    hallWidth,
    hallDepth,
    wallHeight,
    audienceStartZ,
    stageFrontZ,
    stageBackWidth,
    prosceniumWidth,
    prosceniumHeight,
    stageShape,
    prosceniumEnabled,
    tJunctionZ,
  });

  const outlineFields = normalizeStageOutlineFields({
    ...layout,
    hallWidth,
    hallDepth,
    stageShape,
    ...recessFields,
  });

  const stageGridFields = normalizeTheaterZonesFields(layout);
  const surfaceMaterialFields = normalizeTheaterSurfaceMaterials(layout);

  const doorFields = normalizeLayoutDoorsFields({
    ...layout,
    hallWidth,
    hallDepth,
    wallHeight,
    seatRows,
    seatsPerRow,
    seatSpacing,
    rowSpacing,
    rowRise,
    audienceStartZ,
    stageFrontZ,
    aisleWidth,
    aisleCenterX,
    aisles,
    stageBackWidth,
    prosceniumWidth,
    prosceniumHeight,
    stageShape,
    prosceniumEnabled,
    tJunctionZ,
    ...recessFields,
    ...openingFields,
    ...outlineFields,
    ...stageGridFields,
    ...surfaceMaterialFields,
  });

  return {
    hallWidth,
    hallDepth,
    wallHeight,
    hallOffsetX,
    hallOffsetZ,
    audienceStartZ,
    stageFrontZ,
    ...(Math.abs(stageBackZ - defaultBackZ) > 0.01 ? { stageBackZ } : {}),
    seatRows,
    seatsPerRow,
    seatSpacing,
    rowSpacing,
    rowRise,
    aisleWidth,
    aisleCenterX,
    aisles: aisles ?? [],
    stageBackWidth,
    ...(stageHallFollowDebt > 0 ? { stageHallFollowDebt } : {}),
    prosceniumWidth,
    prosceniumHeight,
    stageShape,
    ...(audienceLayout ? { audienceLayout } : {}),
    prosceniumEnabled,
    tJunctionZ,
    stageRise,
    ...(hiddenWalls ? { hiddenWalls } : {}),
    ...recessFields,
    ...openingFields,
    ...outlineFields,
    ...stageGridFields,
    ...surfaceMaterialFields,
    ...doorFields,
  };
}
