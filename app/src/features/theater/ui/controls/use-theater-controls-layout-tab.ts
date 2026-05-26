import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STAGE_SHAPE_LABELS } from "../../model/theater-stage-geometry";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";

export function useTheaterControlsLayoutTab(vm: TheaterSceneViewModel) {
  const [hallTemplatePick, setHallTemplatePick] = useState("");
  const [outlineFitSeats, setOutlineFitSeats] = useState(90);
  const outlineFitSeatsFocusedRef = useRef(false);

  const hallTemplateOptions = useMemo(
    () =>
      vm.hallTemplates.map((template) => ({
        value: template.id,
        label: `${template.label} — ${template.description}`,
      })),
    [vm.hallTemplates],
  );

  useEffect(() => {
    if (outlineFitSeatsFocusedRef.current) return;
    const total = (vm.layout.seatRows ?? 0) * (vm.layout.seatsPerRow ?? 0);
    if (total > 0) setOutlineFitSeats(total);
  }, [vm.layout.seatRows, vm.layout.seatsPerRow]);

  const commitOutlineFitSeats = useCallback(() => {
    vm.beginTheaterHistoryTransaction();
    vm.applyTargetSeatCount(outlineFitSeats);
    vm.endTheaterHistoryTransaction();
  }, [
    outlineFitSeats,
    vm.applyTargetSeatCount,
    vm.beginTheaterHistoryTransaction,
    vm.endTheaterHistoryTransaction,
  ]);

  const layoutSeatTotal = (vm.layout.seatRows ?? 0) * (vm.layout.seatsPerRow ?? 0);
  const layoutSeatBadge =
    layoutSeatTotal > 0
      ? `${layoutSeatTotal} мест · ${vm.layout.seatRows}×${vm.layout.seatsPerRow}`
      : "Без кресел";
  const layoutHallBadge = `${vm.layout.hallWidth}×${vm.layout.hallDepth} м`;
  const layoutShapeLabel = STAGE_SHAPE_LABELS[vm.layout.stageShape ?? "rectangle"];
  const isCustomStageOutline = (vm.layout.stageShape ?? "rectangle") === "custom";

  return {
    hallTemplatePick,
    setHallTemplatePick,
    outlineFitSeats,
    setOutlineFitSeats,
    outlineFitSeatsFocusedRef,
    hallTemplateOptions,
    commitOutlineFitSeats,
    layoutSeatBadge,
    layoutHallBadge,
    layoutShapeLabel,
    isCustomStageOutline,
  };
}
