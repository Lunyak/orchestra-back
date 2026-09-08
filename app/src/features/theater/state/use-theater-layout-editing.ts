import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  TheaterDoorStyle,
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
  createLayoutWallOpening,
  patchLayoutWallOpening,
  removeLayoutWallOpening,
  resolveLayoutWallOpenings,
} from "../model/theater-wall-openings";
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
  const layoutOpenings = useMemo(() => resolveLayoutWallOpenings(layout), [layout]);
  const [activeDoorId, setActiveDoorIdState] = useState<number | undefined>(undefined);
  const [activeRecessId, setActiveRecessIdState] = useState<number | undefined>(undefined);
  const [activeOpeningId, setActiveOpeningIdState] = useState<number | undefined>(undefined);
  const [layoutOutlineFocused, setLayoutOutlineFocused] = useState(false);
  const [audienceSeatsFocused, setAudienceSeatsFocused] = useState(false);
  const [stageGridFocused, setStageGridFocused] = useState(false);
  const [lightRigFocused, setLightRigFocused] = useState(false);
  const [activeOutlineVertexIndex, setActiveOutlineVertexIndex] = useState<number | null>(null);

  const setActiveDoorId = useCallback((id: number | undefined) => {
    if (id != null) {
      setLayoutOutlineFocused(false);
      setAudienceSeatsFocused(false);
      setStageGridFocused(false);
      setLightRigFocused(false);
    }
    setActiveDoorIdState(id);
    setActiveRecessIdState(undefined);
    setActiveOpeningIdState(undefined);
  }, []);

  const setActiveRecessId = useCallback((id: number | undefined) => {
    setActiveRecessIdState(id);
    if (id != null) {
      setActiveDoorIdState(undefined);
      setActiveOpeningIdState(undefined);
      setLayoutOutlineFocused(false);
      setAudienceSeatsFocused(false);
      setStageGridFocused(false);
      setLightRigFocused(false);
    }
  }, []);

  const setActiveOpeningId = useCallback((id: number | undefined) => {
    setActiveOpeningIdState(id);
    if (id != null) {
      setActiveDoorIdState(undefined);
      setActiveRecessIdState(undefined);
      setLayoutOutlineFocused(false);
      setAudienceSeatsFocused(false);
      setStageGridFocused(false);
      setLightRigFocused(false);
    }
  }, []);

  useEffect(() => {
    if (activeDoorId == null) return;
    if (layoutDoors.some((door) => door.id === activeDoorId)) return;
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

  useEffect(() => {
    if (layoutOpenings.length === 0) {
      if (activeOpeningId != null) setActiveOpeningIdState(undefined);
      return;
    }
    if (activeOpeningId != null && layoutOpenings.some((item) => item.id === activeOpeningId)) {
      return;
    }
    setActiveOpeningIdState(undefined);
  }, [activeOpeningId, layoutOpenings]);

  const updateLayout = useCallback(
    (patch: Partial<TheaterLayout>) => {
      if (!onTheaterLayoutChange) return;
      if (!historyTransactionRef.current) {
        recordTheaterHistory();
      }
      onTheaterLayoutChange((prev) =>
        normalizeTheaterLayout(
          { ...prev, ...patch },
          { preserveAudienceStartZ: true },
        ),
      );
    },
    [historyTransactionRef, onTheaterLayoutChange, recordTheaterHistory],
  );

  const previewLayout = useCallback(
    (patch: Partial<TheaterLayout>) => {
      if (!onTheaterLayoutChange) return;
      onTheaterLayoutChange((prev) =>
        normalizeTheaterLayout(
          { ...prev, ...patch },
          { preserveAudienceStartZ: true },
        ),
      );
    },
    [onTheaterLayoutChange],
  );

  const addDoor = useCallback(
    (wall: TheaterDoorWall = "left", pos?: number) => {
      const doors = createLayoutDoor(layout, wall, pos);
      updateLayout({ doors });
      setActiveDoorId(doors[doors.length - 1]?.id);
    },
    [layout, setActiveDoorId, updateLayout],
  );

  const removeActiveDoor = useCallback(
    (doorId?: number) => {
      const id = typeof doorId === "number" ? doorId : activeDoorId;
      if (id == null) return;
      const doors = removeLayoutDoor(layout, id);
      updateLayout({ doors });
      setActiveDoorId(doors[0]?.id);
    },
    [activeDoorId, layout, setActiveDoorId, updateLayout],
  );

  const updateActiveDoor = useCallback(
    (
      patch: Partial<{
        pos: number;
        width: number;
        height: number;
        wall: TheaterDoorWall;
        style: TheaterDoorStyle;
      }>,
    ) => {
      if (activeDoorId == null) return;
      updateLayout({ doors: patchLayoutDoor(layout, activeDoorId, patch) });
    },
    [activeDoorId, layout, updateLayout],
  );

  const addWallRecess = useCallback(
    (wall: TheaterWallRecessWall = "left", pos?: number) => {
      const wallRecesses = createLayoutWallRecess(layout, wall, pos);
      updateLayout({ wallRecesses });
    },
    [layout, updateLayout],
  );

  const removeActiveWallRecess = useCallback(
    (recessId?: number) => {
      const id = typeof recessId === "number" ? recessId : activeRecessId;
      if (id == null) return;
      const wallRecesses = removeLayoutWallRecess(layout, id);
      updateLayout({ wallRecesses });
      setActiveRecessId(undefined);
    },
    [activeRecessId, layout, setActiveRecessId, updateLayout],
  );

  const updateActiveWallRecess = useCallback(
    (
      patch: Partial<{
        pos: number;
        width: number;
        depth: number;
        wall: TheaterWallRecessWall;
        filled: boolean;
      }>,
    ) => {
      if (activeRecessId == null) return;
      updateLayout({ wallRecesses: patchLayoutWallRecess(layout, activeRecessId, patch) });
    },
    [activeRecessId, layout, updateLayout],
  );

  const addWallOpening = useCallback(
    (wall: TheaterDoorWall = "left", pos?: number) => {
      const wallOpenings = createLayoutWallOpening(layout, wall, pos);
      updateLayout({ wallOpenings });
    },
    [layout, updateLayout],
  );

  const removeActiveWallOpening = useCallback(
    (openingId?: number) => {
      const id = typeof openingId === "number" ? openingId : activeOpeningId;
      if (id == null) return;
      const wallOpenings = removeLayoutWallOpening(layout, id);
      updateLayout({ wallOpenings });
      setActiveOpeningId(undefined);
    },
    [activeOpeningId, layout, setActiveOpeningId, updateLayout],
  );

  const updateActiveWallOpening = useCallback(
    (
      patch: Partial<{
        pos: number;
        width: number;
        height: number;
        wall: TheaterDoorWall;
        sill: number;
      }>,
    ) => {
      if (activeOpeningId == null) return;
      updateLayout({ wallOpenings: patchLayoutWallOpening(layout, activeOpeningId, patch) });
    },
    [activeOpeningId, layout, updateLayout],
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
    layoutOpenings,
    activeDoorId,
    setActiveDoorId,
    activeRecessId,
    setActiveRecessId,
    activeOpeningId,
    setActiveOpeningId,
    layoutOutlineFocused,
    setLayoutOutlineFocused,
    audienceSeatsFocused,
    setAudienceSeatsFocused,
    stageGridFocused,
    setStageGridFocused,
    lightRigFocused,
    setLightRigFocused,
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
    addWallOpening,
    removeActiveWallOpening,
    updateActiveWallOpening,
    removeLastOutlinePoint,
    removeActiveOutlineVertex,
    resetStageOutlineToRectangle,
    seedStageOutlineFromCurrentShape,
  };
}
