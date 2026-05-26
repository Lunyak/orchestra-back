import type { TheaterLayout } from "../../../shared/types/script";
import { resolveSpotlightWashLineZ } from "./spotlight-batch-layout";

export const ALIGN_GUIDE_THRESHOLD = 0.15;

export type ActiveAlignGuide = {
  axis: "x" | "z";
  value: number;
};

export type AlignGuideSnapOptions = {
  /** Магнит к линии заливки перед залом (для софитов). */
  spotlightWashLine?: boolean;
};

export function applyAlignGuideSnap(
  x: number,
  z: number,
  layout: TheaterLayout,
  enabled: boolean,
  options?: AlignGuideSnapOptions,
): { x: number; z: number; guides: ActiveAlignGuide[] } {
  if (!enabled) return { x, z, guides: [] };

  const guides: ActiveAlignGuide[] = [];
  let nextX = x;
  let nextZ = z;
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;

  if (Math.abs(x) <= ALIGN_GUIDE_THRESHOLD) {
    nextX = 0;
    guides.push({ axis: "x", value: 0 });
  }
  if (Math.abs(z) <= ALIGN_GUIDE_THRESHOLD) {
    nextZ = 0;
    guides.push({ axis: "z", value: 0 });
  }
  if (Math.abs(z - layout.audienceStartZ) <= ALIGN_GUIDE_THRESHOLD) {
    nextZ = layout.audienceStartZ;
    guides.push({ axis: "z", value: layout.audienceStartZ });
  }
  if (options?.spotlightWashLine) {
    const washZ = resolveSpotlightWashLineZ(layout);
    if (
      washZ != null &&
      Math.abs(z - washZ) <= ALIGN_GUIDE_THRESHOLD &&
      !guides.some((guide) => guide.axis === "z" && guide.value === washZ)
    ) {
      nextZ = washZ;
      guides.push({ axis: "z", value: washZ });
    }
  }
  if (Math.abs(x + halfW) <= ALIGN_GUIDE_THRESHOLD) {
    nextX = -halfW;
    guides.push({ axis: "x", value: -halfW });
  }
  if (Math.abs(x - halfW) <= ALIGN_GUIDE_THRESHOLD) {
    nextX = halfW;
    guides.push({ axis: "x", value: halfW });
  }
  if (Math.abs(z + halfD) <= ALIGN_GUIDE_THRESHOLD) {
    nextZ = -halfD;
    guides.push({ axis: "z", value: -halfD });
  }
  if (Math.abs(z - halfD) <= ALIGN_GUIDE_THRESHOLD) {
    nextZ = halfD;
    guides.push({ axis: "z", value: halfD });
  }

  return { x: nextX, z: nextZ, guides };
}
