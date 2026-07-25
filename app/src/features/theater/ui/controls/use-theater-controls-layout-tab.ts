import { STAGE_SHAPE_LABELS } from "../../model/theater-stage-geometry";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";

export type TheaterControlsLayoutTabModel = ReturnType<typeof useTheaterControlsLayoutTab>;

export function useTheaterControlsLayoutTab(vm: TheaterSceneViewModel) {
  const layoutSeatTotal = (vm.layout.seatRows ?? 0) * (vm.layout.seatsPerRow ?? 0);
  const layoutSeatBadge =
    layoutSeatTotal > 0
      ? `${layoutSeatTotal} мест · ${vm.layout.seatRows}×${vm.layout.seatsPerRow}`
      : "Без кресел";
  const layoutHallBadge = `${vm.layout.hallWidth}×${vm.layout.hallDepth}`;
  const layoutShapeLabel = STAGE_SHAPE_LABELS[vm.layout.stageShape ?? "rectangle"];
  const isCustomStageOutline = (vm.layout.stageShape ?? "rectangle") === "custom";

  return {
    layoutSeatBadge,
    layoutHallBadge,
    layoutShapeLabel,
    isCustomStageOutline,
  };
}
