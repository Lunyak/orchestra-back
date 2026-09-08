import type { TheaterAudienceLayout, TheaterLayout } from "../../../shared/types/script";
import { resolveLayoutAisles, totalAisleWidth } from "./theater-aisles";
import {
  buildSeatRowXs,
  isAudienceSeatInHall,
  resolveAudienceStartZ,
  roundM,
} from "./theater-metrics";
import { resolveStageGeometry } from "./theater-stage-geometry";

export const AUDIENCE_LAYOUT_LABELS: Record<TheaterAudienceLayout, string> = {
  rows: "Ряды",
  arc: "Полукруг",
  surround: "Вокруг",
};

export const AUDIENCE_LAYOUT_HINTS: Record<TheaterAudienceLayout, string> = {
  rows: "Прямые ряды напротив сцены.",
  arc: "Концентрические дуги, как в греческом театре.",
  surround: "Места заходят по бокам и обнимают орхестру.",
};

const ARC_SWEEP = Math.PI;
const SURROUND_SWEEP = Math.PI * 1.5;

export type AudienceSeatPose = {
  x: number;
  z: number;
  yaw: number;
  row: number;
};

export function resolveAudienceLayout(
  layout: Pick<TheaterLayout, "audienceLayout">,
): TheaterAudienceLayout {
  if (layout.audienceLayout === "arc" || layout.audienceLayout === "surround") {
    return layout.audienceLayout;
  }
  return "rows";
}

export function isRadialAudience(layout: Pick<TheaterLayout, "audienceLayout">) {
  return resolveAudienceLayout(layout) !== "rows";
}

export function getAudienceArcSweep(layout: Pick<TheaterLayout, "audienceLayout">) {
  return resolveAudienceLayout(layout) === "surround" ? SURROUND_SWEEP : ARC_SWEEP;
}

export function getAudienceArcCenter(layout: TheaterLayout) {
  const geom = resolveStageGeometry(layout);
  if (geom.stageShape === "semicircle") {
    return { x: 0, z: geom.backZ };
  }
  if (geom.stageShape === "circle") {
    return { x: 0, z: (geom.backZ + geom.prosceniumZ) / 2 };
  }
  return { x: 0, z: geom.prosceniumZ };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function firstArcRadius(layout: TheaterLayout, centerZ: number) {
  const geom = resolveStageGeometry(layout);
  const fromSlider = resolveAudienceStartZ(layout) - centerZ;
  let orchestra = 0;
  if (geom.stageShape === "semicircle") {
    orchestra = Math.max(0.5, geom.prosceniumZ - geom.backZ);
  } else if (geom.stageShape === "circle") {
    orchestra = Math.max(0.5, (geom.prosceniumZ - geom.backZ) / 2);
  }
  return Math.max(0.55, fromSlider, orchestra + 0.8);
}

function buildArcAngles(layout: TheaterLayout, radius: number, sweep: number) {
  const seats = Math.max(1, Math.round(layout.seatsPerRow));
  const half = sweep / 2;
  if (seats === 1) return [0];
  const aisles = resolveLayoutAisles(layout).filter((aisle) => aisle.width > 0);
  if (aisles.length === 0) {
    return Array.from({ length: seats }, (_, index) =>
      -half + (sweep * index) / (seats - 1),
    );
  }

  const gaps = aisles
    .map((aisle) => {
      const gap = Math.min((aisle.width * 0.5) / Math.max(radius, 0.4), half * 0.4);
      const angle = clamp(aisle.centerX / Math.max(radius, 0.4), -half * 0.45, half * 0.45);
      return { left: angle - gap, right: angle + gap };
    })
    .sort((a, b) => a.left - b.left);

  const spans: { start: number; end: number }[] = [];
  let cursor = -half;
  for (const gap of gaps) {
    const start = cursor;
    const end = Math.max(start + 0.04, gap.left);
    if (end - start > 0.04) spans.push({ start, end });
    cursor = Math.max(cursor, gap.right);
  }
  if (half - cursor > 0.04) spans.push({ start: cursor, end: half });
  if (spans.length === 0) {
    return Array.from({ length: seats }, (_, index) =>
      -half + (sweep * index) / Math.max(seats - 1, 1),
    );
  }

  const totalSpan = spans.reduce((sum, span) => sum + (span.end - span.start), 0);
  const counts: number[] = [];
  let assigned = 0;
  for (let index = 0; index < spans.length; index += 1) {
    const isLast = index === spans.length - 1;
    if (isLast) {
      counts.push(Math.max(1, seats - assigned));
      break;
    }
    const share = (spans[index].end - spans[index].start) / totalSpan;
    const count = Math.max(1, Math.round(seats * share));
    counts.push(count);
    assigned += count;
  }
  const overflow = counts.reduce((sum, count) => sum + count, 0) - seats;
  if (overflow > 0) {
    let remaining = overflow;
    for (let index = counts.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const reducible = counts[index] - 1;
      if (reducible <= 0) continue;
      const take = Math.min(reducible, remaining);
      counts[index] -= take;
      remaining -= take;
    }
  }

  const angles: number[] = [];
  counts.forEach((count, index) => {
    const span = spans[index];
    if (!span || count <= 0) return;
    const width = span.end - span.start;
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      angles.push(span.start + width * t);
    }
  });
  return angles;
}

function enumerateRowSeats(layout: TheaterLayout): AudienceSeatPose[] {
  const seats: AudienceSeatPose[] = [];
  const seatXs = buildSeatRowXs(layout);
  const startZ = resolveAudienceStartZ(layout);
  for (let row = 0; row < layout.seatRows; row += 1) {
    const z = startZ + row * layout.rowSpacing;
    for (const x of seatXs) {
      if (!isAudienceSeatInHall(layout, x, z)) continue;
      seats.push({ x, z, yaw: Math.PI, row });
    }
  }
  return seats;
}

function enumerateArcSeats(layout: TheaterLayout): AudienceSeatPose[] {
  const seats: AudienceSeatPose[] = [];
  const center = getAudienceArcCenter(layout);
  const sweep = getAudienceArcSweep(layout);
  const r0 = firstArcRadius(layout, center.z);
  for (let row = 0; row < layout.seatRows; row += 1) {
    const radius = r0 + row * layout.rowSpacing;
    for (const theta of buildArcAngles(layout, radius, sweep)) {
      const x = roundM(center.x + radius * Math.sin(theta));
      const z = roundM(center.z + radius * Math.cos(theta));
      if (!isAudienceSeatInHall(layout, x, z)) continue;
      seats.push({ x, z, yaw: theta + Math.PI, row });
    }
  }
  return seats;
}

export function enumerateAudienceSeats(layout: TheaterLayout): AudienceSeatPose[] {
  if (layout.seatRows <= 0) return [];
  return isRadialAudience(layout) ? enumerateArcSeats(layout) : enumerateRowSeats(layout);
}

export function getAudienceSeatBlockMetrics(layout: TheaterLayout) {
  if (isRadialAudience(layout)) {
    const seats = enumerateAudienceSeats(layout);
    if (seats.length > 0) {
      let minX = seats[0].x;
      let maxX = seats[0].x;
      let minZ = seats[0].z;
      let maxZ = seats[0].z;
      for (const seat of seats) {
        minX = Math.min(minX, seat.x);
        maxX = Math.max(maxX, seat.x);
        minZ = Math.min(minZ, seat.z);
        maxZ = Math.max(maxZ, seat.z);
      }
      const width = Math.max(1, maxX - minX);
      const boxDepth = Math.max(0.35, maxZ - minZ);
      return {
        blockDepth: maxZ - minZ,
        startZ: minZ,
        endZ: maxZ,
        centerZ: (minZ + maxZ) / 2,
        width,
        boxDepth,
      };
    }
  }
  const blockDepth =
    layout.seatRows > 0 ? (layout.seatRows - 1) * layout.rowSpacing : 0;
  const startZ = resolveAudienceStartZ(layout);
  const endZ = startZ + blockDepth;
  const centerZ = startZ + blockDepth / 2;
  const width = Math.max(
    1,
    (layout.seatsPerRow - 1) * layout.seatSpacing + totalAisleWidth(layout),
  );
  const boxDepth = Math.max(0.35, blockDepth + 0.35);
  return { blockDepth, startZ, endZ, centerZ, width, boxDepth };
}

export function buildAudienceArcPolyline(
  layout: TheaterLayout,
  samples = 24,
): { x: number; z: number }[] {
  const center = getAudienceArcCenter(layout);
  const sweep = getAudienceArcSweep(layout);
  const radius = firstArcRadius(layout, center.z);
  const half = sweep / 2;
  return Array.from({ length: samples + 1 }, (_, index) => {
    const theta = -half + (sweep * index) / samples;
    return {
      x: center.x + radius * Math.sin(theta),
      z: center.z + radius * Math.cos(theta),
    };
  });
}

export function countFittingArcRows(layout: TheaterLayout) {
  const center = getAudienceArcCenter(layout);
  const sweep = getAudienceArcSweep(layout);
  const r0 = firstArcRadius(layout, center.z);
  const halfW = layout.hallWidth / 2 - 0.15;
  const halfD = layout.hallDepth / 2 - 0.15;
  const halfSweep = sweep / 2;
  const rMaxZ = halfD - center.z;
  const sinH = Math.sin(halfSweep);
  const rMaxX = sinH > 0.05 ? halfW / sinH : Number.POSITIVE_INFINITY;
  const rMax = Math.max(r0, Math.min(rMaxZ, rMaxX));
  return 1 + Math.floor(Math.max(0, rMax - r0) / Math.max(layout.rowSpacing, 0.55));
}

export function countFittingArcSeatsPerRow(layout: TheaterLayout) {
  const first = enumerateAudienceSeats({ ...layout, seatRows: Math.max(1, layout.seatRows) }).filter(
    (seat) => seat.row === 0,
  );
  return first.length;
}
