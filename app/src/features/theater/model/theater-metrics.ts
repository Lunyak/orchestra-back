import type { TheaterLayout } from "../../../shared/types/script";
import { normalizeLayoutDoorsFields } from "./theater-doors";
import { normalizeLayoutWallRecessFields } from "./theater-wall-recesses";
import type { TheaterStageShape } from "../../../shared/types/script";
import { resolveStageGeometry, resolveStageShape } from "./theater-stage-geometry";
import { normalizeStageOutlineFields } from "./theater-custom-outline";
import { normalizeTheaterZonesFields } from "./theater-zones";
import { normalizeTheaterSurfaceMaterials } from "./theater-surface-materials";

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
  chairDepthRatio: 0.58,
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
  return `${name}, ${THEATER_UNIT}`;
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
  const width = roundM(pitch * METRIC.chairWidthRatio);
  const depth = roundM(pitch * METRIC.chairDepthRatio);
  return {
    width,
    depth,
    seatThickness: 0.08,
    backHeight: roundM(width * 0.86),
    leg: roundM(width * 0.11),
    floorY: METRIC.chairSeatHeight,
  };
}

/** Шаг мест по ширине зала (центры кресел). */
export function computeSeatSpacing(layout: Pick<TheaterLayout, "hallWidth" | "seatsPerRow">) {
  const seats = clampInt(layout.seatsPerRow, 1, 200);
  if (seats <= 1) return METRIC.seatPitch;
  const usable = layout.hallWidth - 2 * METRIC.sideClearance;
  const pitch = usable / (seats - 1);
  return roundM(clamp(pitch, 0.45, 1.2));
}

export function getAudienceStartZBounds(
  layout: Pick<TheaterLayout, "hallDepth" | "seatRows" | "rowSpacing">,
) {
  const halfD = layout.hallDepth / 2;
  const min = -halfD + METRIC.backClearance;
  const hallMax = halfD - METRIC.stageClearance;
  const blockDepth =
    layout.seatRows > 0 ? (layout.seatRows - 1) * layout.rowSpacing : 0;
  const max = layout.seatRows > 0 ? Math.max(min, hallMax - blockDepth) : hallMax;
  return { min, max };
}

/** Линия между сценой и зрительским залом (первая линия рядов). */
export function getAudienceBoundaryZ(
  layout: Pick<TheaterLayout, "audienceStartZ">,
): number {
  return layout.audienceStartZ;
}

export function getStageFrontZBounds(
  layout: Pick<TheaterLayout, "hallDepth">,
) {
  const halfD = layout.hallDepth / 2;
  const min = -halfD + METRIC.backClearance + 0.5;
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

/** Первая линия рядов: по умолчанию блок кресел по центру зала по Z. */
export function computeAudienceStartZ(
  layout: Pick<TheaterLayout, "hallDepth" | "seatRows" | "rowSpacing">,
) {
  const { min, max } = getAudienceStartZBounds(layout);
  if (layout.seatRows <= 0) return roundM(min);
  const blockDepth = (layout.seatRows - 1) * layout.rowSpacing;
  const halfD = layout.hallDepth / 2;
  const hallMin = -halfD + METRIC.backClearance;
  const hallMax = halfD - METRIC.stageClearance;
  const centered = hallMin + (hallMax - hallMin - blockDepth) / 2;
  return roundM(clamp(centered, min, max));
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
  const halfW = hallWidth / 2;
  const halfD = hallDepth / 2;

  const seatRows = clampInt(layout.seatRows, 0, 80);
  const seatsPerRow = clampInt(layout.seatsPerRow, 1, 200);

  const rowSpacing = roundM(clamp(layout.rowSpacing, 0.55, 1.5));
  const rowRise = roundM(clamp(layout.rowRise, 0, 0.6));

  const draft = {
    ...layout,
    hallWidth,
    hallDepth,
    wallHeight,
    seatRows,
    seatsPerRow,
    rowSpacing,
    rowRise,
  };

  const seatSpacing = computeSeatSpacing(draft);
  const { min: minAudienceZ, max: maxAudienceStartZ } = getAudienceStartZBounds({
    hallDepth,
    seatRows,
    rowSpacing,
  });
  let audienceStartZ: number;
  if (options?.preserveAudienceStartZ) {
    audienceStartZ = roundM(clamp(layout.audienceStartZ, minAudienceZ, maxAudienceStartZ));
  } else if (seatRows > 0) {
    audienceStartZ = computeAudienceStartZ({ hallDepth, seatRows, rowSpacing });
  } else {
    audienceStartZ = roundM(clamp(layout.audienceStartZ, minAudienceZ, maxAudienceStartZ));
  }

  const { min: minStageFrontZ, max: maxStageFrontZ } = getStageFrontZBounds({ hallDepth });
  let stageFrontZ: number;
  if (layout.stageFrontZ != null && Number.isFinite(layout.stageFrontZ)) {
    stageFrontZ = roundM(clamp(layout.stageFrontZ, minStageFrontZ, maxStageFrontZ));
  } else {
    stageFrontZ = roundM(clamp(layout.audienceStartZ, minStageFrontZ, maxStageFrontZ));
  }

  const aisleWidth = roundM(clamp(layout.aisleWidth, 0.6, hallWidth * 0.45));
  const aisleHalf = aisleWidth / 2;
  const aisleCenterX = roundM(
    clamp(layout.aisleCenterX, -halfW + aisleHalf, halfW - aisleHalf),
  );

  const stageBackWidth = roundM(clamp(layout.stageBackWidth ?? hallWidth, 2, hallWidth));
  const prosceniumWidth = roundM(clamp(layout.prosceniumWidth ?? hallWidth, 2, hallWidth));
  const prosceniumHeight = roundM(clamp(layout.prosceniumHeight ?? wallHeight, 2, wallHeight));
  const stageShape: TheaterStageShape = resolveStageShape(layout);
  const prosceniumEnabled = layout.prosceniumEnabled === true;

  const geomDraft = resolveStageGeometry({
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
    stageBackWidth,
    prosceniumWidth,
    prosceniumHeight,
    stageShape,
    prosceniumEnabled,
    tJunctionZ,
    ...recessFields,
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
    seatRows,
    seatsPerRow,
    seatSpacing,
    rowSpacing,
    rowRise,
    aisleWidth,
    aisleCenterX,
    stageBackWidth,
    prosceniumWidth,
    prosceniumHeight,
    stageShape,
    prosceniumEnabled,
    tJunctionZ,
    ...recessFields,
    ...outlineFields,
    ...stageGridFields,
    ...surfaceMaterialFields,
    ...doorFields,
  };
}
