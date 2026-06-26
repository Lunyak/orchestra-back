import type {
  ScriptScene,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";

export type TheaterHistorySnapshot = {
  sceneId: number;
  layout: TheaterLayout;
  theaterSpotlights: TheaterSpotlight[];
  theaterModels: TheaterModel[];
  theaterActiveSpotlightId?: number;
  theaterActiveModelId?: number;
};

export function cloneTheaterLayout(layout: TheaterLayout): TheaterLayout {
  return {
    ...layout,
    doors: layout.doors?.map((door) => ({ ...door })),
    wallRecesses: layout.wallRecesses?.map((recess) => ({ ...recess })),
    stageOutline: layout.stageOutline?.map(([x, z]) => [x, z] as [number, number]),
    stageOutlineOpenEdges: layout.stageOutlineOpenEdges
      ? [...layout.stageOutlineOpenEdges]
      : undefined,
    zoneGrid: layout.zoneGrid ? { ...layout.zoneGrid } : undefined,
    zones: layout.zones?.map((zone) => ({ ...zone })),
  };
}

export function cloneTheaterSpotlights(items: TheaterSpotlight[]): TheaterSpotlight[] {
  return items.map((item) => ({
    ...item,
    position: [...item.position] as [number, number, number],
    target: [...item.target] as [number, number, number],
  }));
}

export function cloneTheaterModels(items: TheaterModel[]): TheaterModel[] {
  return items.map((item) => ({
    ...item,
    position: [...item.position] as [number, number, number],
    rotation: [...item.rotation] as [number, number, number],
    scale: [...item.scale] as [number, number, number],
    decorSize: item.decorSize
      ? ([...item.decorSize] as [number, number, number])
      : undefined,
    decorTexture: item.decorTexture,
    decorTextureRepeat: item.decorTextureRepeat,
    decorTextureMode: item.decorTextureMode,
    decorTextureFaces: item.decorTextureFaces
      ? ([...item.decorTextureFaces] as TheaterModel["decorTextureFaces"])
      : undefined,
  }));
}

export function createTheaterHistorySnapshot(args: {
  scene: ScriptScene | undefined;
  layout: TheaterLayout;
  spotlights: TheaterSpotlight[];
  models: TheaterModel[];
}): TheaterHistorySnapshot | null {
  if (!args.scene) return null;
  return {
    sceneId: args.scene.id,
    layout: cloneTheaterLayout(args.layout),
    theaterSpotlights: cloneTheaterSpotlights(args.spotlights),
    theaterModels: cloneTheaterModels(args.models),
    theaterActiveSpotlightId: args.scene.theaterActiveSpotlightId,
    theaterActiveModelId: args.scene.theaterActiveModelId,
  };
}

const MAX_HISTORY = 80;

export function createTheaterUndoStack() {
  const undo: TheaterHistorySnapshot[] = [];
  const redo: TheaterHistorySnapshot[] = [];

  return {
    push(snapshot: TheaterHistorySnapshot) {
      if (undo.length >= MAX_HISTORY) undo.shift();
      undo.push(snapshot);
      redo.length = 0;
    },
    undo(current: TheaterHistorySnapshot): TheaterHistorySnapshot | null {
      const prev = undo.pop();
      if (!prev) return null;
      redo.push(current);
      return prev;
    },
    redo(current: TheaterHistorySnapshot): TheaterHistorySnapshot | null {
      const next = redo.pop();
      if (!next) return null;
      undo.push(current);
      return next;
    },
    clear() {
      undo.length = 0;
      redo.length = 0;
    },
    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0,
  };
}
