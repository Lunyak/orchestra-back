import { useCallback, useEffect, useRef, useState } from "react";
import {
  beginScreenPointerGesture,
  isScreenPointerClick,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "../../model/pointer-click-gesture";
import {
  findFootprintAtPoint,
  findSpotlightAtPoint,
  planPointToWorld,
  snapPlanWorldCoords,
} from "../../model/theater-floor-plan-geometry";
import {
  applyDoorDragPreview,
  hitTestDoorsOnPlan,
  type DoorPlanHit,
} from "../../model/theater-doors";
import {
  applyRecessDragPreview,
  hitTestRecessesOnPlan,
  type RecessPlanHit,
} from "../../model/theater-wall-recesses";
import {
  hitTestStageOutlineVertex,
  insertStageOutlinePointAtClick,
  moveStageOutlineVertex,
} from "../../model/theater-custom-outline";
import { pointToGridCell } from "../../model/theater-zone-grid";
import type { DragState, TheaterFloorPlanProps } from "./theater-floor-plan-types";
import type { TheaterFloorPlanGeometry } from "./use-theater-floor-plan-geometry";

export function useTheaterFloorPlanInteraction(
  props: TheaterFloorPlanProps,
  geometry: TheaterFloorPlanGeometry,
) {
  const {
    layout,
    models,
    spotlights,
    expanded,
    activeTab,
    editMode,
    decorPlaceMode,
    modelTransformMode,
    selectedModelIds = [],
    snapToGrid,
    gridStep,
    onSelectModel,
    onSelectSpotlight,
    onSelectDoor,
    onSelectRecess,
    onPlaceDecor,
    onPreviewModel,
    onCommitModel,
    onMoveSpotlight,
    onDragStart,
    onDragEnd,
    onPreviewLayout,
    onCommitLayout,
    onLayoutInteractStart,
    onLayoutInteractEnd,
    outlineDrawMode = false,
    onSelectOutlineVertex,
    spotlightAimMode = "point",
    onPickGridCell,
  } = props;

  const {
    size,
    viewport,
    footprints,
    canEditOutline,
    canEditDoor,
  } = geometry;

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const placeGestureRef = useRef<ScreenPointerGesture | null>(null);
  const pendingPlaceRef = useRef<[number, number, number] | null>(null);
  const outlinePlaceGestureRef = useRef<ScreenPointerGesture | null>(null);
  const pendingOutlineAddRef = useRef<[number, number] | null>(null);
  const panGestureRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  );
  const [planZoom, setPlanZoom] = useState(1);
  const [planPan, setPlanPan] = useState({ x: 0, y: 0 });
  const [doorHover, setDoorHover] = useState<DoorPlanHit | null>(null);
  const [recessHover, setRecessHover] = useState<RecessPlanHit | null>(null);
  const [doorDragging, setDoorDragging] = useState(false);
  const [recessDragging, setRecessDragging] = useState(false);
  const [outlineVertexHover, setOutlineVertexHover] = useState<number | null>(null);

  useEffect(() => {
    if (!expanded) {
      setPlanZoom(1);
      setPlanPan({ x: 0, y: 0 });
    }
  }, [expanded]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      let svgX = ((clientX - rect.left) / rect.width) * size.width;
      let svgY = ((clientY - rect.top) / rect.height) * size.height;
      if (expanded) {
        const cx = size.width / 2;
        const cy = size.height / 2;
        svgX = (svgX - cx - planPan.x) / planZoom + cx;
        svgY = (svgY - cy - planPan.y) / planZoom + cy;
      }
      return planPointToWorld(svgX, svgY, layout, viewport, {
        unbounded: canEditOutline,
      });
    },
    [canEditOutline, expanded, layout, planPan.x, planPan.y, planZoom, size.width, size.height, viewport],
  );

  const updatePlanLayoutHover = useCallback(
    (clientX: number, clientY: number) => {
      if (canEditOutline && !doorDragging && !recessDragging) {
        const world = clientToWorld(clientX, clientY);
        if (world) {
          setOutlineVertexHover(hitTestStageOutlineVertex(world[0], world[1], layout));
        } else {
          setOutlineVertexHover(null);
        }
      } else {
        setOutlineVertexHover(null);
      }

      if (!canEditDoor || doorDragging || recessDragging) {
        setDoorHover(null);
        setRecessHover(null);
        return;
      }
      const world = clientToWorld(clientX, clientY);
      if (!world) {
        setDoorHover(null);
        setRecessHover(null);
        return;
      }
      const recessHit = hitTestRecessesOnPlan(world[0], world[1], layout);
      if (recessHit) {
        setRecessHover(recessHit);
        setDoorHover(null);
        return;
      }
      setRecessHover(null);
      setDoorHover(hitTestDoorsOnPlan(world[0], world[1], layout));
    },
    [
      canEditDoor,
      canEditOutline,
      clientToWorld,
      doorDragging,
      layout,
      recessDragging,
    ],
  );

  const planContentTransform = expanded
    ? `translate(${size.width / 2 + planPan.x} ${size.height / 2 + planPan.y}) scale(${planZoom}) translate(${-size.width / 2} ${-size.height / 2})`
    : undefined;

  const handleWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      if (!expanded) return;
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      setPlanZoom((prev) => Math.min(4, Math.max(0.5, prev * factor)));
    },
    [expanded],
  );

  const applySnap = useCallback(
    (x: number, z: number) =>
      snapPlanWorldCoords(x, z, layout, snapToGrid, gridStep),
    [gridStep, layout, snapToGrid],
  );

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (expanded && (event.button === 1 || (event.button === 0 && event.altKey))) {
      event.preventDefault();
      panGestureRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        panX: planPan.x,
        panY: planPan.y,
      };
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const world = clientToWorld(event.clientX, event.clientY);
    if (!world) return;
    const [worldX, worldZ] = world;

    if (canEditOutline) {
      if (outlineDrawMode) {
        const onVertex = hitTestStageOutlineVertex(worldX, worldZ, layout, 0.28);
        if (onVertex == null) {
          outlinePlaceGestureRef.current = beginScreenPointerGesture(
            event.pointerId,
            event.clientX,
            event.clientY,
          );
          pendingOutlineAddRef.current = [worldX, worldZ];
          svgRef.current?.setPointerCapture(event.pointerId);
          event.preventDefault();
          return;
        }
      }

      const vertexIndex = hitTestStageOutlineVertex(worldX, worldZ, layout);
      if (vertexIndex != null) {
        onSelectOutlineVertex?.(vertexIndex);
        dragRef.current = { kind: "outline-vertex", index: vertexIndex };
        onLayoutInteractStart?.();
        onDragStart();
        svgRef.current?.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      onSelectOutlineVertex?.(null);
      event.preventDefault();
      return;
    }

    if (
      spotlightAimMode === "cell" &&
      (activeTab === "spotlights" || editMode === "spotlights") &&
      onPickGridCell
    ) {
      const cell = pointToGridCell(layout, worldX, worldZ);
      if (cell) {
        onPickGridCell(cell.col, cell.row);
        event.preventDefault();
        return;
      }
    }

    if (canEditDoor) {
      const recessHit = hitTestRecessesOnPlan(worldX, worldZ, layout);
      if (recessHit) {
        onSelectRecess?.(recessHit.recessId);
        dragRef.current = {
          kind:
            recessHit.part === "move"
              ? "recess-move"
              : recessHit.part === "width-start"
                ? "recess-width-start"
                : "recess-width-end",
          recessId: recessHit.recessId,
        };
        setRecessDragging(true);
        setRecessHover(recessHit);
        onLayoutInteractStart?.();
        onDragStart();
        svgRef.current?.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }

      const doorHit = hitTestDoorsOnPlan(worldX, worldZ, layout);
      if (doorHit) {
        onSelectDoor?.(doorHit.doorId);
        dragRef.current = {
          kind:
            doorHit.part === "move"
              ? "door-move"
              : doorHit.part === "width-start"
                ? "door-width-start"
                : "door-width-end",
          doorId: doorHit.doorId,
        };
        setDoorDragging(true);
        setDoorHover(doorHit);
        onLayoutInteractStart?.();
        onDragStart();
        svgRef.current?.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
    }

    if (
      spotlightAimMode !== "cell" &&
      (editMode === "spotlights" || activeTab === "spotlights")
    ) {
      const hit = findSpotlightAtPoint(worldX, worldZ, spotlights);
      if (hit) {
        onSelectSpotlight(
          hit.spotlight.id,
          event.shiftKey,
          event.clientX,
          event.clientY,
        );
        dragRef.current = {
          kind: hit.part === "source" ? "spotlight-source" : "spotlight-target",
          id: hit.spotlight.id,
        };
        onDragStart();
        svgRef.current?.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
    }

    const footprint = findFootprintAtPoint(worldX, worldZ, footprints);
    if (footprint) {
      onSelectModel(footprint.id, event.shiftKey);
      if (
        (editMode === "models" || editMode === "decor") &&
        modelTransformMode === "translate"
      ) {
        dragRef.current = { kind: "model", id: footprint.id };
        onDragStart();
        svgRef.current?.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      return;
    }

    if (activeTab === "decor" && decorPlaceMode) {
      const [x, z] = applySnap(worldX, worldZ);
      placeGestureRef.current = beginScreenPointerGesture(
        event.pointerId,
        event.clientX,
        event.clientY,
      );
      pendingPlaceRef.current = [x, 0, z];
      svgRef.current?.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const panGesture = panGestureRef.current;
    if (panGesture) {
      setPlanPan({
        x: panGesture.panX + (event.clientX - panGesture.startX),
        y: panGesture.panY + (event.clientY - panGesture.startY),
      });
      return;
    }

    const placeGesture = placeGestureRef.current;
    if (placeGesture?.pointerId === event.pointerId) {
      updateScreenPointerGesture(
        placeGesture,
        event.clientX,
        event.clientY,
      );
      if (placeGesture.dragged) {
        pendingPlaceRef.current = null;
      }
      return;
    }

    const outlinePlaceGesture = outlinePlaceGestureRef.current;
    if (outlinePlaceGesture?.pointerId === event.pointerId) {
      updateScreenPointerGesture(
        outlinePlaceGesture,
        event.clientX,
        event.clientY,
      );
      if (outlinePlaceGesture.dragged) {
        pendingOutlineAddRef.current = null;
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag) {
      updatePlanLayoutHover(event.clientX, event.clientY);
      return;
    }
    const world = clientToWorld(event.clientX, event.clientY);
    if (!world) return;
    const [worldX, worldZ] = world;
    const [x, z] = applySnap(worldX, worldZ);

    if (drag.kind === "outline-vertex") {
      const nextOutline = moveStageOutlineVertex(layout, drag.index, x, z);
      onPreviewLayout?.({ stageOutline: nextOutline });
      return;
    }

    if (
      drag.kind === "door-move" ||
      drag.kind === "door-width-start" ||
      drag.kind === "door-width-end"
    ) {
      const part =
        drag.kind === "door-move"
          ? "move"
          : drag.kind === "door-width-start"
            ? "width-start"
            : "width-end";
      const nextDoors = applyDoorDragPreview(
        layout,
        drag.doorId,
        part,
        worldX,
        worldZ,
      );
      if (nextDoors) {
        onPreviewLayout?.({ doors: nextDoors });
      }
      return;
    }

    if (
      drag.kind === "recess-move" ||
      drag.kind === "recess-width-start" ||
      drag.kind === "recess-width-end"
    ) {
      const part =
        drag.kind === "recess-move"
          ? "move"
          : drag.kind === "recess-width-start"
            ? "width-start"
            : "width-end";
      const nextRecesses = applyRecessDragPreview(
        layout,
        drag.recessId,
        part,
        worldX,
        worldZ,
      );
      if (nextRecesses) {
        onPreviewLayout?.({ wallRecesses: nextRecesses });
      }
      return;
    }

    if (drag.kind === "model") {
      const model = models.find((item) => item.id === drag.id);
      if (!model) return;
      onPreviewModel(drag.id, [x, model.position[1], z]);
      return;
    }

    const spotlight = spotlights.find((item) => item.id === drag.id);
    if (!spotlight) return;
    if (drag.kind === "spotlight-source") {
      onMoveSpotlight(drag.id, {
        position: [x, spotlight.position[1], z],
      });
      return;
    }
    onMoveSpotlight(drag.id, {
      target: [x, spotlight.target[1], z],
    });
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (panGestureRef.current) {
      panGestureRef.current = null;
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    const placeGesture = placeGestureRef.current;
    if (placeGesture?.pointerId === event.pointerId) {
      if (
        isScreenPointerClick(placeGesture, event.pointerId) &&
        pendingPlaceRef.current
      ) {
        onPlaceDecor(pendingPlaceRef.current);
      }
      placeGestureRef.current = null;
      pendingPlaceRef.current = null;
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    const outlinePlaceGesture = outlinePlaceGestureRef.current;
    if (outlinePlaceGesture?.pointerId === event.pointerId) {
      const world = clientToWorld(event.clientX, event.clientY);
      if (
        isScreenPointerClick(outlinePlaceGesture, event.pointerId) &&
        world
      ) {
        const [worldX, worldZ] = world;
        const [x, z] = applySnap(worldX, worldZ);
        const { insertedVertexIndex, ...patch } = insertStageOutlinePointAtClick(layout, x, z);
        if (insertedVertexIndex >= 0) {
          onSelectOutlineVertex?.(insertedVertexIndex);
          onLayoutInteractStart?.();
          onCommitLayout?.(patch);
          onLayoutInteractEnd?.();
        }
      }
      outlinePlaceGestureRef.current = null;
      pendingOutlineAddRef.current = null;
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    const drag = dragRef.current;

    if (drag?.kind === "outline-vertex") {
      const world = clientToWorld(event.clientX, event.clientY);
      if (world) {
        const [worldX, worldZ] = world;
        const [x, z] = applySnap(worldX, worldZ);
        const stageOutline = moveStageOutlineVertex(layout, drag.index, x, z);
        onCommitLayout?.({ stageOutline });
      }
      dragRef.current = null;
      onLayoutInteractEnd?.();
      onDragEnd();
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (
      drag?.kind === "recess-move" ||
      drag?.kind === "recess-width-start" ||
      drag?.kind === "recess-width-end"
    ) {
      const world = clientToWorld(event.clientX, event.clientY);
      if (world) {
        const [worldX, worldZ] = world;
        const part =
          drag.kind === "recess-move"
            ? "move"
            : drag.kind === "recess-width-start"
              ? "width-start"
              : "width-end";
        const nextRecesses = applyRecessDragPreview(
          layout,
          drag.recessId,
          part,
          worldX,
          worldZ,
        );
        if (nextRecesses) {
          onCommitLayout?.({ wallRecesses: nextRecesses });
        }
      }
      dragRef.current = null;
      setRecessDragging(false);
      onLayoutInteractEnd?.();
      onDragEnd();
      updatePlanLayoutHover(event.clientX, event.clientY);
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (
      drag?.kind === "door-move" ||
      drag?.kind === "door-width-start" ||
      drag?.kind === "door-width-end"
    ) {
      const world = clientToWorld(event.clientX, event.clientY);
      if (world) {
        const [worldX, worldZ] = world;
        const part =
          drag.kind === "door-move"
            ? "move"
            : drag.kind === "door-width-start"
              ? "width-start"
              : "width-end";
        const nextDoors = applyDoorDragPreview(
          layout,
          drag.doorId,
          part,
          worldX,
          worldZ,
        );
        if (nextDoors) {
          onCommitLayout?.({ doors: nextDoors });
        }
      }
      dragRef.current = null;
      setDoorDragging(false);
      onLayoutInteractEnd?.();
      onDragEnd();
      updatePlanLayoutHover(event.clientX, event.clientY);
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (drag?.kind === "model") {
      const world = clientToWorld(event.clientX, event.clientY);
      if (world) {
        const [worldX, worldZ] = world;
        const [x, z] = applySnap(worldX, worldZ);
        const model = models.find((item) => item.id === drag.id);
        if (model) {
          onCommitModel(drag.id, [x, model.position[1], z]);
        }
      }
      dragRef.current = null;
      onDragEnd();
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (!dragRef.current) return;
    dragRef.current = null;
    onDragEnd();
    try {
      svgRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerLeave = () => {
    setDoorHover(null);
    setRecessHover(null);
    setOutlineVertexHover(null);
  };

  return {
    svgRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    handlePointerLeave,
    planContentTransform,
    doorHover,
    recessHover,
    doorDragging,
    recessDragging,
    outlineVertexHover,
  };
}
