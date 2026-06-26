import cn from "classnames";
import { TheaterStageLayoutGuide } from "./TheaterStageLayoutGuide";
import { TheaterFloorPlanSvg } from "./floor-plan/TheaterFloorPlanSvg";
import type { TheaterFloorPlanProps } from "./floor-plan/theater-floor-plan-types";
import { useTheaterFloorPlanGeometry } from "./floor-plan/use-theater-floor-plan-geometry";
import { useTheaterFloorPlanInteraction } from "./floor-plan/use-theater-floor-plan-interaction";

export type { TheaterFloorPlanProps } from "./floor-plan/theater-floor-plan-types";

export function TheaterFloorPlan(props: TheaterFloorPlanProps) {
  const {
    expanded,
    onToggleExpanded,
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

  const { isLayoutEdit, shapeLabel, canEditOutline } = geometry;
  const canPlaceDecor = activeTab === "decor" && decorPlaceMode;
  const canDrawOutline = canEditOutline && outlineDrawMode;

  return (
    <div
      className={cn("theater-floor-plan", expanded && "theater-floor-plan--expanded")}
    >
      <div className="theater-floor-plan-header">
        <span>План{isLayoutEdit ? ` · ${shapeLabel}` : " сверху"}</span>
        <button
          type="button"
          className="theater-floor-plan-toggle"
          onClick={onToggleExpanded}
          title={expanded ? "Свернуть план" : "Развернуть план"}
        >
          {expanded ? "−" : "+"}
        </button>
      </div>
      {isLayoutEdit ? (
        <TheaterStageLayoutGuide layout={geometry.layout} compact />
      ) : null}
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
      </div>
    </div>
  );
}
