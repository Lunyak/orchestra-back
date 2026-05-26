import type { RefObject } from "react";
import type { TheaterModel, TheaterSpotlight } from "../../../../shared/types/script";
import { worldToPlanPoint } from "../../model/theater-floor-plan-geometry";
import {
  THEATER_DOOR_WALL_LABELS,
  type DoorPlanHit,
} from "../../model/theater-doors";
import { THEATER_RECESS_WALL_LABELS, type RecessPlanHit } from "../../model/theater-wall-recesses";
import {
  doorHandlePoints,
  doorRectGeometry,
  footprintToRect,
} from "./theater-floor-plan-svg-utils";
import type { TheaterFloorPlanGeometry } from "./use-theater-floor-plan-geometry";

export type TheaterFloorPlanSvgProps = TheaterFloorPlanGeometry & {
  svgRef: RefObject<SVGSVGElement | null>;
  planContentTransform: string | undefined;
  doorHover: DoorPlanHit | null;
  recessHover: RecessPlanHit | null;
  doorDragging: boolean;
  recessDragging: boolean;
  outlineVertexHover: number | null;
  models: TheaterModel[];
  spotlights: TheaterSpotlight[];
  showSpotlights: boolean;
  showSpotlightGuideLines: boolean;
  activeDoorId?: number;
  activeRecessId?: number;
  activeOutlineVertexIndex?: number | null;
  selectedModelIds: number[];
  hoveredModelId: number | null;
  activeSpotlightId?: number;
  selectedSpotlightIds: number[];
  canPlaceDecor: boolean;
  canDrawOutline: boolean;
  spotlightAimMode: "point" | "cell";
  activeTab: "spotlights" | "models" | "decor" | "layout";
  onSelectSpotlight: (
    id: number,
    additive?: boolean,
    clientX?: number,
    clientY?: number,
  ) => void;
  onSelectModel: (id: number, additive?: boolean) => void;
  onModelContextMenu: (id: number, clientX: number, clientY: number) => void;
  handlePointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  handlePointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
  handlePointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
  handlePointerLeave: () => void;
  handleWheel: (event: React.WheelEvent<SVGSVGElement>) => void;
};

export function TheaterFloorPlanSvg({
  svgRef,
  size,
  planContentTransform,
  layout,
  viewport,
  hallPath,
  stageOutlinePath,
  gridPlanSegments,
  showStageGridOnPlan,
  highlightCellPath,
  canEditOutline,
  outlineVertexPlan,
  activeOutlineVertexIndex = null,
  outlineVertexHover,
  wallOverlay,
  canEditDoor,
  activeDoorId,
  doorHover,
  doorDragging,
  activeRecessId,
  recessHover,
  recessDragging,
  gridLines,
  stageLabelPos,
  audienceLabelPos,
  audienceBoundaryLine,
  spotlightWashLine,
  seats,
  showSpotlights,
  showSpotlightGuideLines,
  spotlights,
  activeSpotlightId,
  selectedSpotlightIds,
  footprints,
  selectedModelIds,
  hoveredModelId,
  canPlaceDecor,
  canDrawOutline,
  spotlightAimMode,
  activeTab,
  onSelectSpotlight,
  onSelectModel,
  onModelContextMenu,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handlePointerLeave,
  handleWheel,
}: TheaterFloorPlanSvgProps) {
  return (
    <svg
      ref={svgRef}
      className={[
        "theater-floor-plan-svg",
        canPlaceDecor ? "theater-floor-plan-svg--place" : "",
        canDrawOutline ? "theater-floor-plan-svg--outline-draw" : "",
        spotlightAimMode === "cell" && activeTab === "spotlights"
          ? "theater-floor-plan-svg--grid-pick"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      viewBox={`0 0 ${size.width} ${size.height}`}
      role="img"
      aria-label="План сцены сверху"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
    >
      <g transform={planContentTransform}>
        <path d={hallPath} className="theater-floor-plan-hall" />
        <path d={stageOutlinePath} className="theater-floor-plan-stage" />
        {showStageGridOnPlan
          ? gridPlanSegments.map((segment, index) => {
              const [x1, y1] = worldToPlanPoint(segment.x1, segment.z1, layout, viewport);
              const [x2, y2] = worldToPlanPoint(segment.x2, segment.z2, layout, viewport);
              return (
                <line
                  key={`zone-grid-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className="theater-floor-plan-zone-grid-line"
                />
              );
            })
          : null}
        {highlightCellPath ? (
          <path
            d={highlightCellPath}
            className="theater-floor-plan-grid-cell-highlight"
          />
        ) : null}
        {canEditOutline
          ? outlineVertexPlan.map((vertex, index) => {
              const isActive = activeOutlineVertexIndex === index;
              const isHot = outlineVertexHover === index || isActive;
              return (
                <g key={`outline-vtx-${index}`}>
                  <circle
                    cx={vertex.cx}
                    cy={vertex.cy}
                    r={12}
                    className="theater-floor-plan-outline-vertex-hit"
                  />
                  <circle
                    cx={vertex.cx}
                    cy={vertex.cy}
                    r={isActive ? 8 : 7}
                    className={[
                      "theater-floor-plan-outline-vertex",
                      isHot ? "theater-floor-plan-outline-vertex--hot" : "",
                      isActive ? "theater-floor-plan-outline-vertex--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                  <text
                    x={vertex.cx}
                    y={vertex.cy - 12}
                    textAnchor="middle"
                    className="theater-floor-plan-outline-vertex-label"
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })
          : null}
        {wallOverlay.stageWalls.map((segment, index) => (
          <line
            key={`wall-stage-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            className="theater-floor-plan-wall"
          />
        ))}
        {wallOverlay.backWall.map((segment, index) => (
          <line
            key={`wall-back-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            className="theater-floor-plan-wall theater-floor-plan-wall--back"
          />
        ))}
        {wallOverlay.leftWall.map((segment, index) => (
          <line
            key={`wall-left-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            className="theater-floor-plan-wall"
          />
        ))}
        {wallOverlay.rightWall.map((segment, index) => (
          <line
            key={`wall-right-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            className="theater-floor-plan-wall"
          />
        ))}
        {wallOverlay.frontWall.map((segment, index) => (
          <line
            key={`wall-front-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            className="theater-floor-plan-wall theater-floor-plan-wall--front"
          />
        ))}
        {wallOverlay.doors.map((doorOverlay) => {
          const rect = doorRectGeometry(doorOverlay);
          const isActive =
            activeDoorId === doorOverlay.id ||
            doorHover?.doorId === doorOverlay.id;
          const isHot = doorHover?.doorId === doorOverlay.id || (doorDragging && isActive);
          return (
            <g key={`door-${doorOverlay.id}`}>
              <rect
                {...rect}
                rx={2}
                className={[
                  "theater-floor-plan-door",
                  canEditDoor ? "theater-floor-plan-door--editable" : "",
                  isHot ? "theater-floor-plan-door--hot" : "",
                  isActive ? "theater-floor-plan-door--active" : "",
                  doorDragging && isActive ? "theater-floor-plan-door--dragging" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <title>
                  {`${THEATER_DOOR_WALL_LABELS[doorOverlay.wall]} · дверь ${doorOverlay.id}`}
                </title>
              </rect>
              {canEditDoor
                ? doorHandlePoints(doorOverlay).map((handle) => (
                    <circle
                      key={`${doorOverlay.id}-${handle.part}`}
                      cx={handle.cx}
                      cy={handle.cy}
                      r={6}
                      className={[
                        "theater-floor-plan-door-handle",
                        doorHover?.doorId === doorOverlay.id &&
                        doorHover.part === handle.part
                          ? "is-hot"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                  ))
                : null}
            </g>
          );
        })}
        {wallOverlay.recesses.map((recessOverlay) => {
          const rect = doorRectGeometry(recessOverlay);
          const isActive =
            activeRecessId === recessOverlay.id ||
            recessHover?.recessId === recessOverlay.id;
          const isHot =
            recessHover?.recessId === recessOverlay.id ||
            (recessDragging && isActive);
          return (
            <g key={`recess-${recessOverlay.id}`}>
              <rect
                {...rect}
                rx={2}
                className={[
                  "theater-floor-plan-recess",
                  canEditDoor ? "theater-floor-plan-recess--editable" : "",
                  isHot ? "theater-floor-plan-recess--hot" : "",
                  isActive ? "theater-floor-plan-recess--active" : "",
                  recessDragging && isActive ? "theater-floor-plan-recess--dragging" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <title>
                  {`${THEATER_RECESS_WALL_LABELS[recessOverlay.wall]} · ниша ${recessOverlay.id}`}
                </title>
              </rect>
              {canEditDoor
                ? doorHandlePoints(recessOverlay).map((handle) => (
                    <circle
                      key={`recess-${recessOverlay.id}-${handle.part}`}
                      cx={handle.cx}
                      cy={handle.cy}
                      r={6}
                      className={[
                        "theater-floor-plan-recess-handle",
                        recessHover?.recessId === recessOverlay.id &&
                        recessHover.part === handle.part
                          ? "is-hot"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                  ))
                : null}
            </g>
          );
        })}
        {gridLines.map((line, index) => (
          <line
            key={`grid-${index}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className={
              line.major
                ? "theater-floor-plan-grid theater-floor-plan-grid--major"
                : "theater-floor-plan-grid"
            }
          />
        ))}
        <text
          x={stageLabelPos.x}
          y={stageLabelPos.y}
          className="theater-floor-plan-label theater-floor-plan-label--stage"
          textAnchor="middle"
        >
          Сцена
        </text>
        <text
          x={audienceLabelPos.x}
          y={audienceLabelPos.y}
          className="theater-floor-plan-label theater-floor-plan-label--audience"
          textAnchor="middle"
        >
          Зрители
        </text>
        <line
          x1={audienceBoundaryLine.x1}
          y1={audienceBoundaryLine.y1}
          x2={audienceBoundaryLine.x2}
          y2={audienceBoundaryLine.y2}
          className="theater-floor-plan-audience-line"
        />
        {spotlightWashLine ? (
          <line
            x1={spotlightWashLine.x1}
            y1={spotlightWashLine.y1}
            x2={spotlightWashLine.x2}
            y2={spotlightWashLine.y2}
            className="theater-floor-plan-wash-line"
          />
        ) : null}
        {seats.map(([x, z], index) => {
          const [sx, sy] = worldToPlanPoint(x, z, layout, viewport);
          return (
            <rect
              key={`seat-${index}`}
              x={sx - 2}
              y={sy - 2}
              width={4}
              height={4}
              rx={1}
              className="theater-floor-plan-seat"
            />
          );
        })}
        {showSpotlights &&
          spotlights.map((item) => {
            const [sx, sy] = worldToPlanPoint(
              item.position[0],
              item.position[2],
              layout,
              viewport,
            );
            const [tx, ty] = worldToPlanPoint(
              item.target[0],
              item.target[2],
              layout,
              viewport,
            );
            const isActiveSpot = item.id === activeSpotlightId;
            const isSelectedSpot =
              isActiveSpot || selectedSpotlightIds.includes(item.id);
            return (
              <g
                key={`spot-${item.id}`}
                className={isSelectedSpot ? "is-active" : undefined}
              >
                {showSpotlightGuideLines && isSelectedSpot ? (
                  <line
                    x1={sx}
                    y1={sy}
                    x2={tx}
                    y2={ty}
                    className="theater-floor-plan-spot-beam theater-floor-plan-spot-beam--highlight"
                  />
                ) : null}
                {isSelectedSpot ? (
                  <text
                    x={sx}
                    y={sy - 10}
                    textAnchor="middle"
                    className="theater-floor-plan-spot-label"
                  >
                    {item.channel ?? item.id}
                  </text>
                ) : null}
                <circle
                  cx={tx}
                  cy={ty}
                  r={isActiveSpot ? 5 : isSelectedSpot ? 4 : 3.5}
                  className={[
                    "theater-floor-plan-spot-target",
                    isSelectedSpot ? "theater-floor-plan-spot-target--highlight" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelectSpotlight(
                      item.id,
                      event.shiftKey,
                      event.clientX,
                      event.clientY,
                    );
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectSpotlight(item.id, false, event.clientX, event.clientY);
                  }}
                />
                <circle
                  cx={sx}
                  cy={sy}
                  r={isActiveSpot ? 8 : isSelectedSpot ? 6.5 : 4.5}
                  className={[
                    "theater-floor-plan-spot-source",
                    isSelectedSpot ? "theater-floor-plan-spot-source--highlight" : "",
                    isActiveSpot ? "theater-floor-plan-spot-source--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelectSpotlight(
                      item.id,
                      event.shiftKey,
                      event.clientX,
                      event.clientY,
                    );
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectSpotlight(item.id, false, event.clientX, event.clientY);
                  }}
                />
              </g>
            );
          })}
        {footprints.map((item) => {
          const { sx, sy, w, h, deg } = footprintToRect(item, layout, viewport);
          const active = selectedModelIds.includes(item.id);
          const hovered = item.id === hoveredModelId;
          return (
            <rect
              key={`model-${item.id}`}
              x={sx - w / 2}
              y={sy - h / 2}
              width={w}
              height={h}
              transform={`rotate(${deg} ${sx} ${sy})`}
              className={[
                "theater-floor-plan-object",
                item.kind === "decor" ? "theater-floor-plan-object--decor" : "",
                item.outOfBounds ? "theater-floor-plan-object--oob" : "",
                active ? "is-active" : "",
                hovered ? "is-hovered" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={item.color ? { fill: item.color } : undefined}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectModel(item.id);
                onModelContextMenu(item.id, event.clientX, event.clientY);
              }}
            >
              <title>{item.label}</title>
            </rect>
          );
        })}
      </g>
    </svg>
  );
}
