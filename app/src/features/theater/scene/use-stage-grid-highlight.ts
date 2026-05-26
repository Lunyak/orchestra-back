import { useMemo } from "react";
import type { TheaterLayout, TheaterSpotlight } from "../../../shared/types/script";
import { pointToGridCell } from "../model/theater-zone-grid";
import type { TheaterViewPrefs } from "../model/theater-view-prefs-storage";

export type StageGridCell = { col: number; row: number };

/**
 * Resolves which stage grid cell to highlight from spotlight target (source of truth).
 */
export function useStageGridHighlight(
  layout: TheaterLayout,
  activeSpotlight: TheaterSpotlight | undefined,
  spotlightAimMode: TheaterViewPrefs["spotlightAimMode"],
): StageGridCell | null {
  return useMemo(() => {
    if (!activeSpotlight) return null;
    const hasBinding =
      activeSpotlight.gridCol != null &&
      activeSpotlight.gridRow != null &&
      Number.isFinite(activeSpotlight.gridCol) &&
      Number.isFinite(activeSpotlight.gridRow);
    if (spotlightAimMode !== "cell" && !hasBinding) return null;
    const cell = pointToGridCell(
      layout,
      activeSpotlight.target[0],
      activeSpotlight.target[2],
    );
    if (cell) return cell;
    if (!hasBinding) return null;
    return {
      col: Math.trunc(activeSpotlight.gridCol!),
      row: Math.trunc(activeSpotlight.gridRow!),
    };
  }, [activeSpotlight, layout, spotlightAimMode]);
}
