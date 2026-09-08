import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { TheaterFloorPlanSvg } from "./floor-plan/TheaterFloorPlanSvg";
import type { TheaterFloorPlanProps } from "./floor-plan/theater-floor-plan-types";
import { clampFloorPlanMaxSide } from "./floor-plan/theater-floor-plan-types";
import { useTheaterFloorPlanGeometry } from "./floor-plan/use-theater-floor-plan-geometry";
import { useTheaterFloorPlanInteraction } from "./floor-plan/use-theater-floor-plan-interaction";

export type { TheaterFloorPlanProps } from "./floor-plan/theater-floor-plan-types";

export function TheaterFloorPlan(props: TheaterFloorPlanProps) {
  const {
    maxSide,
    onChangeMaxSide,
    activeTab,
    decorPlaceMode,
    outlineDrawMode = false,
    activeOutlineVertexIndex = null,
    spotlightAimMode = "point",
    models,
    spotlights,
    showSpotlights,
    showSpotlightGuideLines,
    activeDoorId,
    activeRecessId,
    activeOpeningId,
    hoveredModelId,
    selectedModelIds = [],
    activeSpotlightId,
    selectedSpotlightIds = [],
    onSelectSpotlight,
    onSelectModel,
    onModelContextMenu,
  } = props;

  const geometry = useTheaterFloorPlanGeometry(props);
  const interaction = useTheaterFloorPlanInteraction(props, geometry);
  const resizeRef = useRef<{ startX: number; startY: number; startSide: number } | null>(
    null,
  );

  const { canEditOutline } = geometry;
  const canPlaceDecor = activeTab === "decor" && decorPlaceMode;
  const canDrawOutline = canEditOutline && outlineDrawMode;

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startSide: maxSide,
    };
  };

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = resizeRef.current;
    if (!drag) return;
    const deltaX = drag.startX - event.clientX;
    const deltaY = drag.startY - event.clientY;
    const delta = Math.max(deltaX, deltaY);
    onChangeMaxSide(clampFloorPlanMaxSide(drag.startSide + delta));
  };

  const handleResizePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="theater-floor-plan">
      <div className="theater-floor-plan-canvas">
        <TheaterFloorPlanSvg
          {...geometry}
          {...interaction}
          models={models}
          spotlights={spotlights}
          showSpotlights={showSpotlights}
          showSpotlightGuideLines={showSpotlightGuideLines}
          activeDoorId={activeDoorId}
          activeRecessId={activeRecessId}
          activeOpeningId={activeOpeningId}
          activeOutlineVertexIndex={activeOutlineVertexIndex}
          selectedModelIds={selectedModelIds}
          hoveredModelId={hoveredModelId}
          activeSpotlightId={activeSpotlightId}
          selectedSpotlightIds={selectedSpotlightIds}
          canPlaceDecor={canPlaceDecor}
          canDrawOutline={canDrawOutline}
          spotlightAimMode={spotlightAimMode}
          activeTab={activeTab}
          onSelectSpotlight={onSelectSpotlight}
          onSelectModel={onSelectModel}
          onModelContextMenu={onModelContextMenu}
        />
        <button
          type="button"
          className="theater-floor-plan-resize"
          aria-label="Изменить размер плана"
          title="Потянуть для изменения размера"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
        />
      </div>
    </div>
  );
}
