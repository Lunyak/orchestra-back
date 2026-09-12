import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { desktopAddProjectImage } from "../../../shared/platform/desktop-methods";
import type { ScriptScene, TheaterLayout, TheaterModel } from "../../../shared/types/script";
import {
  getDecorCatalogEntry,
  isTheaterDecorModel,
  type DecorCatalogKey,
} from "../model/theater-decor-catalog";
import {
  decorInventoryToRequisiteLabels,
  downloadDecorInventoryCsv,
  formatDecorInventoryMarkdown,
  mergeDecorIntoRequisites,
} from "../model/theater-decor-inventory";
import {
  toDecorTextureFileRef,
  toDecorTexturePresetRef,
  type DecorTextureMode,
  type DecorTexturePresetId,
} from "../model/theater-decor-textures";
import { buildDecorGridPositions } from "../model/theater-decor-grid";
import {
  readSceneTheaterModels,
  writeSceneTheaterModels,
} from "../model/theater-scene-models";
import {
  appendClonedTheaterModels,
  resolveAdjacentSceneIndex,
} from "../model/theater-model-clone";
import type { TheaterEditMode } from "./use-theater-selection";

export type UseTheaterDecorArgs = {
  projectName: string;
  currentPage: number;
  currentScene: ScriptScene | undefined;
  scenes: ScriptScene[];
  updateScene: (sceneId: number, patch: Partial<ScriptScene>) => void;
  updateCurrentScene: (patch: Partial<ScriptScene>) => void;
  layout: TheaterLayout;
  gridStep: number;
  snapToGrid: boolean;
  models: TheaterModel[];
  updateModels: (next: TheaterModel[]) => void;
  updateModel: (id: number, patch: Partial<TheaterModel>) => void;
  setPendingSnapModelId: Dispatch<SetStateAction<number | null>>;
  activeModelId: number | undefined;
  setEditMode: Dispatch<SetStateAction<TheaterEditMode>>;
  decorActionMessage: string | null;
  setDecorActionMessage: (message: string | null) => void;
};

export function useTheaterDecor({
  projectName,
  currentPage,
  currentScene,
  scenes,
  updateScene,
  updateCurrentScene,
  layout,
  gridStep,
  snapToGrid,
  models,
  updateModels,
  updateModel,
  setPendingSnapModelId,
  activeModelId,
  setEditMode,
  decorActionMessage,
  setDecorActionMessage,
}: UseTheaterDecorArgs) {
  const [decorCatalogKey, setDecorCatalogKey] =
    useState<DecorCatalogKey>("flat");
  const [decorDraftSize, setDecorDraftSize] = useState<
    [number, number, number] | null
  >(null);
  const [decorDraftColor, setDecorDraftColor] = useState<string | null>(null);
  const [decorDraftTexture, setDecorDraftTexture] = useState<string | null>(null);
  const [decorDraftTextureRepeat, setDecorDraftTextureRepeat] = useState(1);
  const [decorDraftTextureMode, setDecorDraftTextureMode] =
    useState<DecorTextureMode>("once");
  const [decorPlaceMode, setDecorPlaceMode] = useState(false);
  const [decorGridCols, setDecorGridCols] = useState(1);
  const [decorGridRows, setDecorGridRows] = useState(1);
  const activeDecorPreset = getDecorCatalogEntry(decorCatalogKey);

    const resolveDecorDraftSize = useCallback((): [number, number, number] => {
      return decorDraftSize ?? getDecorCatalogEntry(decorCatalogKey).defaultSize;
    }, [decorCatalogKey, decorDraftSize]);

    const resolveDecorDraftColor = useCallback((): string => {
      return decorDraftColor ?? getDecorCatalogEntry(decorCatalogKey).defaultColor;
    }, [decorCatalogKey, decorDraftColor]);

    const addDecorAt = useCallback(
      (position: [number, number, number]) => {
        if (!currentScene) return;
        const preset = getDecorCatalogEntry(decorCatalogKey);
        const size = resolveDecorDraftSize();
        const gridPositions = buildDecorGridPositions(position, {
          cols: decorGridCols,
          rows: decorGridRows,
          spacingX: gridStep,
          spacingZ: gridStep,
          snapEnabled: snapToGrid,
        }, layout);
        let nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0);
        const count = gridPositions.length;
        const nextItems: TheaterModel[] = gridPositions.map((gridPosition, index) => {
          nextId += 1;
          const suffix = count > 1 ? ` ${index + 1}` : "";
          return {
            id: nextId,
            name: `${preset.label}${suffix}`,
            type: "builtin",
            builtin: preset.builtin,
            decorSize: preset.parametric ? size : undefined,
            decorColor: resolveDecorDraftColor(),
            decorTexture: decorDraftTexture ?? undefined,
            decorTextureRepeat: decorDraftTextureRepeat,
            decorTextureMode: decorDraftTextureMode,
            allowOutOfBounds: false,
            position: [...gridPosition] as [number, number, number],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          };
        });
        updateModels([...models, ...nextItems]);
        setPendingSnapModelId(nextId);
        setEditMode("decor");
      },
      [
      currentScene,
      decorCatalogKey,
        decorDraftTexture,
        decorDraftTextureMode,
        decorDraftTextureRepeat,
        decorGridCols,
        decorGridRows,
        gridStep,
        layout,
        models,
        resolveDecorDraftColor,
        resolveDecorDraftSize,
        snapToGrid,
        updateModels,
      ],
    );

    const enterDecorPlaceMode = useCallback(() => {
      setDecorPlaceMode(true);
      updateCurrentScene({ theaterActiveModelId: undefined });
      setEditMode("decor");
    }, [updateCurrentScene]);

    const exitDecorPlaceMode = useCallback(() => {
      setDecorPlaceMode(false);
    }, []);

    const applyDecorTexture = useCallback(
      (textureRef: string | undefined, targetModelId?: number) => {
        const isUploadedImage =
          Boolean(textureRef) &&
          (textureRef!.startsWith("file:") || /^data:image\//i.test(textureRef!));
        const texturePatch: Partial<TheaterModel> = isUploadedImage
          ? {
              decorTexture: textureRef,
              decorTextureMode: "once",
              decorTextureRepeat: 1,
            }
          : { decorTexture: textureRef };

        const modelId = targetModelId ?? activeModelId;
        if (modelId) {
          updateModel(modelId, texturePatch);
          return;
        }
        setDecorDraftTexture(textureRef ?? null);
        if (isUploadedImage) {
          setDecorDraftTextureMode("once");
          setDecorDraftTextureRepeat(1);
        }
      },
      [activeModelId, updateModel],
    );

    const applyDecorTexturePreset = useCallback(
      (presetId: DecorTexturePresetId, targetModelId?: number) => {
        applyDecorTexture(toDecorTexturePresetRef(presetId), targetModelId);
      },
      [applyDecorTexture],
    );

    const clearDecorTexture = useCallback(
      (targetModelId?: number) => {
        applyDecorTexture(undefined, targetModelId);
      },
      [applyDecorTexture],
    );

    const uploadDecorTextureFile = useCallback(
      async (file: File, targetModelId?: number) => {
        if (!file.type.startsWith("image/")) return;
        let textureRef: string;
        const api = getDesktopApi();
        const buffer = await file.arrayBuffer();
        if (api?.addProjectImage) {
          const result = await desktopAddProjectImage(
            api,
            projectName,
            new Uint8Array(buffer),
            file.type,
            file.name,
          );
          if (!result?.ok || !result.file) {
            if (!result?.canceled) {
              console.error("Failed to add decor texture:", result?.error);
            }
            return;
          }
          textureRef = toDecorTextureFileRef(result.file);
        } else {
          textureRef = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
        }
        applyDecorTexture(textureRef, targetModelId);
      },
      [applyDecorTexture, projectName],
    );

    const setDecorTextureRepeatForTarget = useCallback(
      (value: number, targetModelId?: number) => {
        const modelId = targetModelId ?? activeModelId;
        if (modelId) {
          updateModel(modelId, { decorTextureRepeat: value });
          return;
        }
        setDecorDraftTextureRepeat(value);
      },
      [activeModelId, updateModel],
    );

    const setDecorTextureModeForTarget = useCallback(
      (value: DecorTextureMode, targetModelId?: number) => {
        const modelId = targetModelId ?? activeModelId;
        const patch: Partial<TheaterModel> = { decorTextureMode: value };

        if (value === "once") {
          const current = modelId ? models.find((item) => item.id === modelId) : null;
          const prevMode = current?.decorTextureMode ?? decorDraftTextureMode;
          const prevRepeat = current?.decorTextureRepeat ?? decorDraftTextureRepeat;
          if (prevMode === "repeat" || prevRepeat < 0.3 || prevRepeat > 2) {
            patch.decorTextureRepeat = 1;
          }
        }

        if (modelId) {
          updateModel(modelId, patch);
          return;
        }
        setDecorDraftTextureMode(value);
        if (patch.decorTextureRepeat != null) {
          setDecorDraftTextureRepeat(patch.decorTextureRepeat);
        }
      },
      [
        activeModelId,
        decorDraftTextureMode,
        decorDraftTextureRepeat,
        models,
        updateModel,
      ],
    );

    const copyDecorInventoryToClipboard = useCallback(async () => {
      const text = formatDecorInventoryMarkdown(
        models,
        currentScene?.title?.trim() || undefined,
      );
      try {
        await navigator.clipboard.writeText(text);
        setDecorActionMessage("Список реквизита скопирован");
      } catch {
        setDecorActionMessage("Не удалось скопировать в буфер");
      }
    }, [currentScene?.title, models]);

    const exportDecorInventoryCsv = useCallback(() => {
      const title = currentScene?.title?.trim() || "decor-inventory";
      downloadDecorInventoryCsv(models, title, `${title}.csv`);
      setDecorActionMessage("CSV реквизита сохранён");
    }, [currentScene?.title, models]);

    const syncDecorInventoryToRequisites = useCallback(() => {
      if (!currentScene) return;
      const labels = decorInventoryToRequisiteLabels(models);
      if (labels.length === 0) {
        setDecorActionMessage("На сцене нет декора");
        return;
      }
      const next = mergeDecorIntoRequisites(currentScene.requisites ?? [], labels);
      updateScene(currentScene.id, { requisites: next });
      const added = next.length - (currentScene.requisites?.length ?? 0);
      setDecorActionMessage(
        added > 0 ? `Добавлено в реквизит: ${added}` : "Новых позиций нет",
      );
    }, [currentScene, models, updateScene]);

    useEffect(() => {
      if (!decorActionMessage) return;
      const timer = window.setTimeout(() => setDecorActionMessage(null), 2600);
      return () => window.clearTimeout(timer);
    }, [decorActionMessage]);

    const copyDecorToNextScene = useCallback(() => {
      if (!currentScene) return;
      const targetIndex = resolveAdjacentSceneIndex(
        currentPage,
        scenes.length,
        "next",
      );
      const nextScene = targetIndex != null ? scenes[targetIndex] : undefined;
      if (!nextScene) return;
      const decorItems = models.filter(isTheaterDecorModel);
      if (decorItems.length === 0) {
        setDecorActionMessage("Нет декора для копирования");
        return;
      }
      const existing = readSceneTheaterModels(nextScene);
      const nextModels = appendClonedTheaterModels(existing, decorItems);
      const copiesCount = nextModels.length - existing.length;
      updateScene(nextScene.id, writeSceneTheaterModels(nextModels));
      setDecorActionMessage(
        `Декор скопирован на сцену «${nextScene.title}» (${copiesCount})`,
      );
    }, [currentPage, currentScene, models, scenes, updateScene]);

  return {
    decorCatalogKey,
    setDecorCatalogKey,
    decorDraftSize,
    setDecorDraftSize,
    decorDraftColor,
    setDecorDraftColor,
    decorDraftTexture,
    decorDraftTextureRepeat,
    decorDraftTextureMode,
    decorPlaceMode,
    setDecorPlaceMode,
    decorGridCols,
    setDecorGridCols,
    decorGridRows,
    setDecorGridRows,
    activeDecorPreset,
    resolveDecorDraftSize,
    resolveDecorDraftColor,
    addDecorAt,
    enterDecorPlaceMode,
    exitDecorPlaceMode,
    applyDecorTexture,
    applyDecorTexturePreset,
    clearDecorTexture,
    uploadDecorTextureFile,
    setDecorTextureRepeatForTarget,
    setDecorTextureModeForTarget,
    copyDecorInventoryToClipboard,
    exportDecorInventoryCsv,
    syncDecorInventoryToRequisites,
    copyDecorToNextScene,
    setDecorDraftTextureRepeat,
  };
}
