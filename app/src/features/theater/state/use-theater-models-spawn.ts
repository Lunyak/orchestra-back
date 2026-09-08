import { useCallback, type Dispatch, type SetStateAction } from "react";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import type { ScriptScene, TheaterLayout, TheaterModel } from "../../../shared/types/script";
import {
  createBuiltinTheaterModel,
  isTheaterBuiltinTemplateKey,
} from "../model/theater-model-builtin";
import { openTheaterModelWebUploadPicker } from "../model/theater-model-import";
import {
  getLightTrussModels,
  LIGHT_TRUSS_SPACING,
  resolveLightRigHeight,
} from "../model/theater-light-rig";
import { resolveFloorYAt } from "../model/theater-stage-floor";
import { isLightTrussModel } from "../model/theater-truss-mounts";
import type { TheaterEditMode } from "./use-theater-selection";

type UseTheaterModelsSpawnArgs = {
  projectName: string;
  currentScene: ScriptScene | undefined;
  models: TheaterModel[];
  layout: TheaterLayout;
  updateModels: (next: TheaterModel[]) => void;
  updateCurrentScene: (patch: Partial<ScriptScene>) => void;
  activeModelId: number | undefined;
  multiSelectedModelIds: number[];
  setMultiSelectedModelIds: Dispatch<SetStateAction<number[]>>;
  setEditMode: Dispatch<SetStateAction<TheaterEditMode>>;
  setPendingSnapModelId: Dispatch<SetStateAction<number | null>>;
  setDecorActionMessage: (message: string | null) => void;
  builtinModelKey: TheaterModel["builtin"];
  setBuiltinModelKey: Dispatch<SetStateAction<TheaterModel["builtin"]>>;
};

export function useTheaterModelsSpawn({
  projectName,
  currentScene,
  models,
  layout,
  updateModels,
  updateCurrentScene,
  activeModelId,
  multiSelectedModelIds,
  setMultiSelectedModelIds,
  setEditMode,
  setPendingSnapModelId,
  setDecorActionMessage,
  builtinModelKey,
  setBuiltinModelKey,
}: UseTheaterModelsSpawnArgs) {
  const appendFileModel = useCallback(
    (fileRef: string, displayName: string) => {
      const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
      const nextItem: TheaterModel = {
        id: nextId,
        name: displayName || `Модель ${nextId}`,
        file: fileRef,
        type: "file",
        allowOutOfBounds: false,
        ignoreCollisions: false,
        position: [0, resolveFloorYAt(layout, 0, 0), 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      };
      updateModels([...models, nextItem]);
      updateCurrentScene({ theaterActiveModelId: nextId });
      setPendingSnapModelId(nextId);
      setEditMode("models");
    },
    [layout, models, setEditMode, setPendingSnapModelId, updateCurrentScene, updateModels],
  );

  const addModelFromWebUpload = useCallback(() => {
    if (!currentScene) return;
    openTheaterModelWebUploadPicker({
      projectName,
      onAuthRequired: () => {
        setDecorActionMessage("Войдите в аккаунт, чтобы загрузить модель");
      },
      onError: () => {
        setDecorActionMessage("Не удалось загрузить модель");
      },
      onUploaded: (fileRef, displayName) => {
        appendFileModel(fileRef, displayName);
        setDecorActionMessage(null);
      },
    });
  }, [appendFileModel, currentScene, projectName, setDecorActionMessage]);

  const addModel = async () => {
    if (!currentScene) return;
    const desktopApi = getDesktopApi();
    if (desktopApi?.pickProjectModel) {
      try {
        const result = await desktopApi.pickProjectModel(projectName);
        if (!result?.ok) {
          if (result?.canceled) return;
          console.error("Failed to pick model:", result?.error);
          return;
        }
        appendFileModel(
          String(result.file ?? "").trim(),
          String(result.name ?? "").trim() || `Модель`,
        );
      } catch (err) {
        console.error("Failed to add model:", err);
      }
      return;
    }

    addModelFromWebUpload();
  };

  const addBuiltinModelAt = (
    key: TheaterModel["builtin"] = builtinModelKey,
    position?: [number, number, number],
  ) => {
    if (!key) return;
    const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem = createBuiltinTheaterModel(nextId, key);
    const keepHeight = key === "lightTruss6m";
    const existingTrusses = getLightTrussModels(models);
    const lastTruss = existingTrusses[existingTrusses.length - 1];
    const spawnX = position?.[0] ?? nextItem.position[0];
    const spawnZ =
      position?.[2] ??
      (lastTruss
        ? lastTruss.position[2] + LIGHT_TRUSS_SPACING
        : nextItem.position[2]);
    const floorY = position?.[1] ?? resolveFloorYAt(layout, spawnX, spawnZ);
    const spawnY = keepHeight
      ? resolveLightRigHeight(models)
      : floorY + nextItem.position[1];
    nextItem.position = [spawnX, spawnY, spawnZ];
    updateModels([...models, nextItem]);
    updateCurrentScene({ theaterActiveModelId: nextId });
    if (!keepHeight) setPendingSnapModelId(nextId);
    if (isTheaterBuiltinTemplateKey(key)) setBuiltinModelKey(key);
    setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
  };

  const addBuiltinModel = () => {
    addBuiltinModelAt(builtinModelKey);
  };

  const removeSelectedModels = useCallback(() => {
    if (multiSelectedModelIds.length === 0 || !currentScene) return;
    const selected = new Set(multiSelectedModelIds);
    const next = models.filter((item) => !selected.has(item.id));
    updateModels(next);
    updateCurrentScene({ theaterActiveModelId: next[0]?.id });
    setMultiSelectedModelIds(next[0] ? [next[0].id] : []);
    setDecorActionMessage(`Удалено объектов: ${selected.size}`);
  }, [
    currentScene,
    models,
    multiSelectedModelIds,
    setDecorActionMessage,
    setMultiSelectedModelIds,
    updateCurrentScene,
    updateModels,
  ]);

  const cloneSelectedModels = useCallback(() => {
    if (multiSelectedModelIds.length === 0 || !currentScene) return;
    let nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0);
    const copies: TheaterModel[] = [];
    multiSelectedModelIds.forEach((sourceId, index) => {
      const source = models.find((item) => item.id === sourceId);
      if (!source) return;
      nextId += 1;
      const offset = 0.25 * (index + 1);
      copies.push({
        ...source,
        id: nextId,
        name: `${source.name} (копия)`,
        position: [
          source.position[0] + offset,
          source.position[1],
          source.position[2] + offset,
        ] as [number, number, number],
        hidden: false,
      });
    });
    if (copies.length === 0) return;
    updateModels([...models, ...copies]);
    const copyIds = copies.map((item) => item.id);
    setMultiSelectedModelIds(copyIds);
    updateCurrentScene({ theaterActiveModelId: copyIds[0] });
    setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
    setDecorActionMessage(`Скопировано объектов: ${copies.length}`);
  }, [
    currentScene,
    models,
    multiSelectedModelIds,
    setDecorActionMessage,
    setEditMode,
    setMultiSelectedModelIds,
    updateCurrentScene,
    updateModels,
  ]);

  const removeModel = (id: number) => {
    if (!currentScene) return;
    const next = models.filter((item) => item.id !== id);
    updateModels(next);
    if (activeModelId === id) {
      updateCurrentScene({ theaterActiveModelId: next[0]?.id });
    }
  };

  const cloneModel = (id: number) => {
    if (!currentScene) return;
    const source = models.find((item) => item.id === id);
    if (!source) return;
    const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const offsetX = 0.3;
    const offsetZ = 0.3;
    const nextItem: TheaterModel = {
      ...source,
      id: nextId,
      name: `${source.name} (копия)`,
      position: [
        source.position[0] + offsetX,
        source.position[1],
        source.position[2] + offsetZ,
      ],
    };
    updateModels([...models, nextItem]);
    updateCurrentScene({ theaterActiveModelId: nextId });
    if (!isLightTrussModel(source)) setPendingSnapModelId(nextId);
    setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
  };

  return {
    addModel,
    addBuiltinModel,
    addBuiltinModelAt,
    removeSelectedModels,
    cloneSelectedModels,
    removeModel,
    cloneModel,
  };
}
