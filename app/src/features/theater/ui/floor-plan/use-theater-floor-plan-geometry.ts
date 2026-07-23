import { useMemo } from "react";
import {
  buildModelFootprints,
  buildAudienceBoundaryPlanLine,
  buildSpotlightWashPlanLine,
  buildFloorPlanGridLines,
  buildFloorPlanWallOverlay,
  buildStageOutlinePlanPath,
  createFloorPlanViewport,
  enumerateSeatPositions,
  getFloorPlanHallLayout,
  worldToPlanPoint,
} from "../../model/theater-floor-plan-geometry";
import { resolveStageGeometry, resolveStageShape } from "../../model/theater-stage-geometry";
import { resolveStageOutlinePoints } from "../../model/theater-custom-outline";
import {
  buildStageGridPlanSegments,
  buildGridCellOutline,
} from "../../model/theater-zone-grid";
import {
  FLOOR_PLAN_NAV_MIN_SIDE,
  fitFloorPlanSize,
  type TheaterFloorPlanProps,
} from "./theater-floor-plan-types";

export function useTheaterFloorPlanGeometry({
  layout,
  models,
  showSeats,
  showSpotlights,
  maxSide,
  activeTab,
  gridStep,
  highlightGridCell = null,
  showStageGrid: showStageGridPref = true,
  onPreviewLayout,
  onCommitLayout,
}: Pick<
  TheaterFloorPlanProps,
  | "layout"
  | "models"
  | "showSeats"
  | "showSpotlights"
  | "maxSide"
  | "activeTab"
  | "gridStep"
  | "highlightGridCell"
  | "showStageGrid"
  | "onPreviewLayout"
  | "onCommitLayout"
>) {
  const size = useMemo(
    () => fitFloorPlanSize(layout.hallWidth, layout.hallDepth, maxSide),
    [layout.hallDepth, layout.hallWidth, maxSide],
  );
  const viewport = useMemo(
    () => createFloorPlanViewport(size.width, size.height),
    [size.height, size.width],
  );
  const planNavigationEnabled = maxSide >= FLOOR_PLAN_NAV_MIN_SIDE;
  const footprints = useMemo(
    () => buildModelFootprints(models, layout),
    [layout, models],
  );
  const seats = useMemo(
    () => (showSeats ? enumerateSeatPositions(layout) : []),
    [layout, showSeats],
  );

  const hallPath = useMemo(() => {
    const hall = getFloorPlanHallLayout(layout, viewport);
    const corners: [number, number][] = [
      [hall.offsetX, hall.offsetY],
      [hall.offsetX + hall.drawW, hall.offsetY],
      [hall.offsetX + hall.drawW, hall.offsetY + hall.drawH],
      [hall.offsetX, hall.offsetY + hall.drawH],
    ];
    return `M ${corners.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
  }, [layout, viewport]);

  const gridLines = useMemo(
    () => buildFloorPlanGridLines(layout, viewport, gridStep),
    [gridStep, layout, viewport],
  );

  const audienceBoundaryLine = useMemo(
    () => buildAudienceBoundaryPlanLine(layout, viewport),
    [layout, viewport],
  );

  const spotlightWashLine = useMemo(
    () => (showSpotlights ? buildSpotlightWashPlanLine(layout, viewport) : null),
    [layout, showSpotlights, viewport],
  );

  const wallOverlay = useMemo(
    () => buildFloorPlanWallOverlay(layout, viewport),
    [layout, viewport],
  );

  const stageOutlinePath = useMemo(
    () => buildStageOutlinePlanPath(layout, viewport),
    [layout, viewport],
  );

  const highlightCellPath = useMemo(() => {
    if (!highlightGridCell) return "";
    const outline = buildGridCellOutline(
      layout,
      highlightGridCell.col,
      highlightGridCell.row,
    );
    const planPoints = outline.map(([x, z]) => worldToPlanPoint(x, z, layout, viewport));
    return `M ${planPoints.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
  }, [highlightGridCell, layout, viewport]);

  const gridPlanSegments = useMemo(
    () => buildStageGridPlanSegments(layout),
    [layout],
  );

  const isLayoutEdit = activeTab === "layout";
  const showStageGridOnPlan =
    showStageGridPref &&
    (activeTab === "spotlights" || activeTab === "layout" || showSpotlights);
  const isCustomOutline = resolveStageShape(layout) === "custom";
  const canEditOutline =
    isLayoutEdit && isCustomOutline && Boolean(onPreviewLayout || onCommitLayout);
  const canEditDoor =
    isLayoutEdit && !isCustomOutline && Boolean(onPreviewLayout || onCommitLayout);

  const stageLabelPos = useMemo(() => {
    const geom = resolveStageGeometry(layout);
    const midZ = (geom.backZ + geom.prosceniumZ) / 2;
    const [x, y] = worldToPlanPoint(0, midZ, layout, viewport);
    return { x, y };
  }, [layout, viewport]);

  const audienceLabelPos = useMemo(() => {
    const halfD = layout.hallDepth / 2;
    const midZ = (layout.audienceStartZ + halfD) / 2;
    const [x, y] = worldToPlanPoint(0, midZ, layout, viewport);
    return { x, y: y + 12 };
  }, [layout, viewport]);

  const outlineVertices = useMemo(
    () => (isCustomOutline ? resolveStageOutlinePoints(layout) : []),
    [isCustomOutline, layout],
  );

  const outlineVertexPlan = useMemo(
    () =>
      outlineVertices.map((point) => {
        const [cx, cy] = worldToPlanPoint(point.x, point.z, layout, viewport);
        return { cx, cy };
      }),
    [layout, outlineVertices, viewport],
  );

  return {
    size,
    viewport,
    footprints,
    seats,
    hallPath,
    gridLines,
    audienceBoundaryLine,
    spotlightWashLine,
    wallOverlay,
    stageOutlinePath,
    highlightCellPath,
    gridPlanSegments,
    isLayoutEdit,
    showStageGridOnPlan,
    isCustomOutline,
    canEditOutline,
    canEditDoor,
    stageLabelPos,
    audienceLabelPos,
    planNavigationEnabled,
    outlineVertices,
    outlineVertexPlan,
    layout,
  };
}

export type TheaterFloorPlanGeometry = ReturnType<typeof useTheaterFloorPlanGeometry>;
