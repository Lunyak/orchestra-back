import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  TheaterDoorWall,
  TheaterLayout,
  TheaterWallRecessWall,
} from "../../../shared/types/script";
import { normalizeTheaterLayout } from "../model/theater-metrics";
import {
  createLayoutDoor,
  patchLayoutDoor,
  removeLayoutDoor,
  resolveLayoutDoors,
} from "../model/theater-doors";
import {
  createLayoutWallRecess,
  patchLayoutWallRecess,
  removeLayoutWallRecess,
  resolveLayoutWallRecesses,
} from "../model/theater-wall-recesses";
import {
  defaultCustomStageOutline,
  defaultCustomStageOutlineOpenEdges,
  outlineFromStagePoints,
  removeLastStageOutlinePoint,
  removeStageOutlineVertex,
  resolveStageOutlinePoints,
} from "../model/theater-custom-outline";
import { buildStageOutline, resolveStageShape } from "../model/theater-stage-geometry";
export type UseTheaterLayoutEditingArgs = {
  layout: TheaterLayout;
  onTheaterLayoutChange?: Dispatch<SetStateAction<TheaterLayout>>;
  recordTheaterHistory: () => void;
  historyTransactionRef: MutableRefObject<boolean>;
};

export function useTheaterLayoutEditing({
  layout,
  onTheaterLayoutChange,
  recordTheaterHistory,
  historyTransactionRef,
}: UseTheaterLayoutEditingArgs) {
  const layoutDoors = useMemo(() => resolveLayoutDoors(layout), [layout]);
  const layoutRecesses = useMemo(() => resolveLayoutWallRecesses(layout), [layout]);
  const [activeDoorId, setActiveDoorIdState] = useState<number | undefined>(undefined);
  const [activeRecessId, setActiveRecessIdState] = useState<number | undefined>(undefined);
  const [layoutOutlineFocused, setLayoutOutlineFocused] = useState(false);
  const [activeOutlineVertexIndex, setActiveOutlineVertexIndex] = useState<number | null>(null);

  const setActiveDoorId = useCallback((id: number | undefined) => {
    setLayoutOutlineFocused(false);
    setActiveDoorIdState(id);
    if (id != null) setActiveRecessIdState(undefined);
  }, []);

  const setActiveRecessId = useCallback((id: number | undefined) => {
    setActiveRecessIdState(id);
    if (id != null) {
      setActiveDoorIdState(undefined);
      setLayoutOutlineFocused(false);
    }
  }, []);

  useEffect(() => {
    if (activeDoorId != null && layoutDoors.some((door) => door.id === activeDoorId)) {
      return;
    }
    setActiveDoorIdState(layoutDoors[0]?.id);
  }, [activeDoorId, layoutDoors]);

  useEffect(() => {
    if (layoutRecesses.length === 0) {
      if (activeRecessId != null) setActiveRecessIdState(undefined);
      return;
    }
    if (activeRecessId != null && layoutRecesses.some((item) => item.id === activeRecessId)) {
      return;
    }
    setActiveRecessIdState(undefined);
  }, [activeRecessId, layoutRecesses]);

  const updateLayout = useCallback(
    (patch: Partial<TheaterLayout>) => {
      if (!onTheaterLayoutChange) return;
      if (!historyTransactionRef.current) {
        recordTheaterHistory();
      }
      onTheaterLayoutChange((prev) =>
        normalizeTheaterLayout({ ...prev, ...patch }, { preserveAudienceStartZ: true }),
      );
    },
    [historyTransactionRef, onTheaterLayoutChange, recordTheaterHistory],
  );

  const previewLayout = useCallback(
    (patch: Partial<TheaterLayout>) => {
      if (!onTheaterLayoutChange) return;
      onTheaterLayoutChange((prev) =>
        normalizeTheaterLayout({ ...prev, ...patch }, { preserveAudienceStartZ: true }),
      );
    },
    [onTheaterLayoutChange],
  );

  const addDoor = useCallback(
    (wall: TheaterDoorWall = "left") => {
      const doors = createLayoutDoor(layout, wall);
      updateLayout({ doors });
      setActiveDoorId(doors[doors.length - 1]?.id);
    },
    [layout, setActiveDoorId, updateLayout],
  );

  const removeActiveDoor = useCallback(() => {
    if (activeDoorId == null) return;
    const doors = removeLayoutDoor(layout, activeDoorId);
    updateLayout({ doors });
    setActiveDoorId(doors[0]?.id);
  }, [activeDoorId, layout, setActiveDoorId, updateLayout]);

  const updateActiveDoor = useCallback(
    (patch: Partial<{ pos: number; width: number; height: number; wall: TheaterDoorWall }>) => {
      if (activeDoorId == null) return;
      updateLayout({ doors: patchLayoutDoor(layout, activeDoorId, patch) });
    },
    [activeDoorId, layout, updateLayout],
  );

  const addWallRecess = useCallback(
    (wall: TheaterWallRecessWall = "left") => {
      const wallRecesses = createLayoutWallRecess(layout, wall);
      updateLayout({ wallRecesses });
      setActiveRecessId(wallRecesses[wallRecesses.length - 1]?.id);
    },
    [layout, setActiveRecessId, updateLayout],
  );

  const removeActiveWallRecess = useCallback(() => {
    if (activeRecessId == null) return;
    const wallRecesses = removeLayoutWallRecess(layout, activeRecessId);
    updateLayout({ wallRecesses });
    setActiveRecessId(wallRecesses[0]?.id);
  }, [activeRecessId, layout, setActiveRecessId, updateLayout]);

  const updateActiveWallRecess = useCallback(
    (
      patch: Partial<{
        pos: number;
        width: number;
        depth: number;
        wall: TheaterWallRecessWall;
      }>,
    ) => {
      if (activeRecessId == null) return;
      updateLayout({ wallRecesses: patchLayoutWallRecess(layout, activeRecessId, patch) });
    },
    [activeRecessId, layout, updateLayout],
  );

  const removeLastOutlinePoint = useCallback(() => {
    const stageOutline = removeLastStageOutlinePoint(layout);
    updateLayout({ stageOutline });
    setActiveOutlineVertexIndex(null);
  }, [layout, updateLayout]);

  const removeActiveOutlineVertex = useCallback(() => {
    if (activeOutlineVertexIndex == null) return false;
    const patch = removeStageOutlineVertex(layout, activeOutlineVertexIndex);
    if (!patch) return false;
    updateLayout(patch);
    const nextCount = patch.stageOutline?.length ?? 0;
    if (nextCount <= 0) {
      setActiveOutlineVertexIndex(null);
    } else {
      setActiveOutlineVertexIndex(Math.min(activeOutlineVertexIndex, nextCount - 1));
    }
    return true;
  }, [activeOutlineVertexIndex, layout, updateLayout]);

  const resetStageOutlineToRectangle = useCallback(() => {
    updateLayout({
      stageOutline: defaultCustomStageOutline(layout),
      stageOutlineOpenEdges: defaultCustomStageOutlineOpenEdges(),
    });
    setActiveOutlineVertexIndex(null);
  }, [layout, updateLayout]);

  const seedStageOutlineFromCurrentShape = useCallback(() => {
    const points = buildStageOutline({
      ...layout,
      stageShape: layout.stageShape ?? "rectangle",
    });
    updateLayout({
      stageOutline: outlineFromStagePoints(points),
      stageOutlineOpenEdges: undefined,
    });
    setActiveOutlineVertexIndex(null);
  }, [layout, updateLayout]);

  useEffect(() => {
    if (resolveStageShape(layout) !== "custom") {
      setActiveOutlineVertexIndex(null);
      return;
    }
    const count = resolveStageOutlinePoints(layout).length;
    setActiveOutlineVertexIndex((current) => {
      if (current == null) return null;
      if (current >= count) return count > 0 ? count - 1 : null;
      return current;
    });
  }, [layout.stageOutline, layout.stageShape, layout.hallWidth, layout.hallDepth]);

  return {
    layoutDoors,
    layoutRecesses,
    activeDoorId,
    setActiveDoorId,
    activeRecessId,
    setActiveRecessId,
    layoutOutlineFocused,
    setLayoutOutlineFocused,
    activeOutlineVertexIndex,
    setActiveOutlineVertexIndex,
    updateLayout,
    previewLayout,
    addDoor,
    removeActiveDoor,
    updateActiveDoor,
    addWallRecess,
    removeActiveWallRecess,
    updateActiveWallRecess,
    removeLastOutlinePoint,
    removeActiveOutlineVertex,
    resetStageOutlineToRectangle,
    seedStageOutlineFromCurrentShape,
  };
}
