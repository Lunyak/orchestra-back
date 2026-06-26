import {
  useCallback,
  useEffect,
  useMemo,
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
  buildDecorSceneTemplate,
  DECOR_SCENE_TEMPLATES,
  type DecorSceneTemplateId,
} from "../model/theater-decor-scene-templates";
import {
  buildModelsFromDecorTemplateJson,
  downloadDecorTemplateJson,
  exportDecorModelsToTemplateJson,
  loadProjectDecorTemplateManifest,
  persistStoredDecorTemplatesToProject,
  parseDecorTemplateJson,
  readStoredDecorTemplates,
  type DecorTemplateJson,
  type DecorTemplateListItem,
  upsertStoredDecorTemplate,
} from "../model/theater-decor-template-json";
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
import type { TheaterViewPrefs } from "../model/theater-view-prefs-storage";
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
  setActiveTab: (tab: TheaterViewPrefs["activeTab"]) => void;
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
  setActiveTab,
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
  const [customDecorTemplates, setCustomDecorTemplates] = useState<
    DecorTemplateJson[]
  >(() => readStoredDecorTemplates(projectName));
  const [projectDecorTemplates, setProjectDecorTemplates] = useState<
    DecorTemplateJson[]
  >([]);
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

    const applyDecorSceneTemplate = useCallback(
      (templateId: DecorSceneTemplateId) => {
        if (!currentScene) return;
        const startId = models.reduce((acc, item) => Math.max(acc, item.id), 0);
        const sketch = buildDecorSceneTemplate(templateId, layout, startId);
        if (sketch.length === 0) return;
        updateModels([...models, ...sketch]);
        const lastId = sketch[sketch.length - 1]?.id;
        if (lastId != null) {
          updateCurrentScene({ theaterActiveModelId: lastId });
        }
        setDecorPlaceMode(false);
        setEditMode("decor");
        setActiveTab("decor");
      },
      [currentScene, layout, models, updateCurrentScene, updateModels],
    );

    const replaceDecorSceneTemplate = useCallback(
      (templateId: DecorSceneTemplateId) => {
        if (!currentScene) return;
        const kept = models.filter((item) => !isTheaterDecorModel(item));
        const startId = kept.reduce((acc, item) => Math.max(acc, item.id), 0);
        const sketch = buildDecorSceneTemplate(templateId, layout, startId);
        updateModels([...kept, ...sketch]);
        const lastId = sketch[sketch.length - 1]?.id;
        if (lastId != null) {
          updateCurrentScene({ theaterActiveModelId: lastId });
        }
        const label =
          DECOR_SCENE_TEMPLATES.find((item) => item.id === templateId)?.label ??
          templateId;
        setDecorPlaceMode(false);
        setEditMode("decor");
        setActiveTab("decor");
        setDecorActionMessage(`Декор заменён шаблоном «${label}»`);
      },
      [currentScene, layout, models, updateCurrentScene, updateModels],
    );

    const applyDecorTemplateJson = useCallback(
      (template: DecorTemplateJson) => {
        if (!currentScene) return;
        const startId = models.reduce((acc, item) => Math.max(acc, item.id), 0);
        const sketch = buildModelsFromDecorTemplateJson(template, layout, startId);
        if (sketch.length === 0) return;
        updateModels([...models, ...sketch]);
        const lastId = sketch[sketch.length - 1]?.id;
        if (lastId != null) {
          updateCurrentScene({ theaterActiveModelId: lastId });
        }
        setDecorPlaceMode(false);
        setEditMode("decor");
        setActiveTab("decor");
      },
      [currentScene, layout, models, updateCurrentScene, updateModels],
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

    const importDecorTemplateFromJson = useCallback(
      (raw: unknown, persist = true) => {
        const parsed = parseDecorTemplateJson(raw);
        if (!parsed) {
          setDecorActionMessage("Некорректный JSON шаблона");
          return false;
        }
        if (persist) {
          const next = upsertStoredDecorTemplate(projectName, parsed);
          setCustomDecorTemplates(next);
        }
        applyDecorTemplateJson(parsed);
        setDecorActionMessage(`Шаблон «${parsed.label}» применён`);
        return true;
      },
      [applyDecorTemplateJson, projectName],
    );

    const exportCurrentDecorAsJsonTemplate = useCallback(() => {
      const sceneTitle = currentScene?.title?.trim() || "Сцена";
      const slug = sceneTitle
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
      const template = exportDecorModelsToTemplateJson(models, layout, {
        id: slug || "decor-scene",
        label: sceneTitle,
        description: "Экспорт текущего декора сцены",
      });
      if (template.items.length === 0) {
        setDecorActionMessage("На сцене нет декора для экспорта");
        return;
      }
      downloadDecorTemplateJson(template);
      setDecorActionMessage("JSON шаблон сохранён");
    }, [currentScene?.title, layout, models]);

    const decorTemplateList = useMemo((): DecorTemplateListItem[] => {
      const builtin: DecorTemplateListItem[] = DECOR_SCENE_TEMPLATES.map(
        (item) => ({
          id: item.id,
          label: item.label,
          description: item.description,
          source: "builtin" as const,
        }),
      );
      const project: DecorTemplateListItem[] = projectDecorTemplates.map(
        (item) => ({
          id: `project:${item.id}`,
          label: item.label,
          description: item.description,
          revision: item.revision,
          source: "project" as const,
        }),
      );
      const imported: DecorTemplateListItem[] = customDecorTemplates.map(
        (item) => ({
          id: `custom:${item.id}`,
          label: item.label,
          description: item.description,
          revision: item.revision,
          source: "imported" as const,
        }),
      );
      return [...builtin, ...project, ...imported];
    }, [customDecorTemplates, projectDecorTemplates]);

    const applyDecorTemplateByListId = useCallback(
      (listId: string, replace = false) => {
        const sceneTemplate = DECOR_SCENE_TEMPLATES.find((item) => item.id === listId);
        if (sceneTemplate) {
          if (replace) {
            replaceDecorSceneTemplate(sceneTemplate.id);
          } else {
            applyDecorSceneTemplate(sceneTemplate.id);
          }
          return;
        }
        if (listId.startsWith("project:")) {
          const id = listId.slice("project:".length);
          const template = projectDecorTemplates.find((item) => item.id === id);
          if (template) applyDecorTemplateJson(template);
          return;
        }
        if (listId.startsWith("custom:")) {
          const id = listId.slice("custom:".length);
          const template = customDecorTemplates.find((item) => item.id === id);
          if (template) applyDecorTemplateJson(template);
        }
      },
      [
      replaceDecorSceneTemplate,
      applyDecorSceneTemplate,
        applyDecorTemplateJson,
        customDecorTemplates,
        projectDecorTemplates,
      ],
    );

    useEffect(() => {
      setCustomDecorTemplates(readStoredDecorTemplates(projectName));
      let cancelled = false;
      void loadProjectDecorTemplateManifest(projectName).then((items) => {
        if (!cancelled) setProjectDecorTemplates(items);
      });
      return () => {
        cancelled = true;
      };
    }, [projectName]);

    useEffect(() => {
      if (!decorActionMessage) return;
      const timer = window.setTimeout(() => setDecorActionMessage(null), 2600);
      return () => window.clearTimeout(timer);
    }, [decorActionMessage]);

    const applyDecorSketchTemplate = useCallback(() => {
      applyDecorSceneTemplate("basic");
    }, [applyDecorSceneTemplate]);

    const copyDecorToNextScene = useCallback(() => {
      if (!currentScene || currentPage >= scenes.length - 1) return;
      const nextScene = scenes[currentPage + 1];
      if (!nextScene) return;
      const decorItems = models.filter(isTheaterDecorModel);
      if (decorItems.length === 0) {
        setDecorActionMessage("Нет декора для копирования");
        return;
      }
      const existing = readSceneTheaterModels(nextScene);
      let nextId = existing.reduce((acc, item) => Math.max(acc, item.id), 0);
      const copies = decorItems.map((item) => {
        nextId += 1;
        return {
          ...item,
          id: nextId,
          name: `${item.name} (копия)`,
          position: [
            item.position[0] + 0.25,
            item.position[1],
            item.position[2] + 0.25,
          ] as [number, number, number],
        };
      });
      updateScene(nextScene.id, writeSceneTheaterModels([...existing, ...copies]));
      setDecorActionMessage(
        `Декор скопирован на сцену «${nextScene.title}» (${copies.length})`,
      );
    }, [currentPage, currentScene, models, scenes, updateScene]);

    const saveDecorTemplatesToProject = useCallback(async () => {
      const result = await persistStoredDecorTemplatesToProject(projectName);
      if (!result.ok) {
        setDecorActionMessage("Сохранение шаблонов в проект недоступно");
        return;
      }
      const items = await loadProjectDecorTemplateManifest(projectName);
      setProjectDecorTemplates(items);
      setDecorActionMessage(`Шаблоны сохранены в проект (${result.count})`);
    }, [projectName]);

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
    applyDecorSceneTemplate,
    replaceDecorSceneTemplate,
    applyDecorTemplateJson,
    copyDecorInventoryToClipboard,
    exportDecorInventoryCsv,
    syncDecorInventoryToRequisites,
    importDecorTemplateFromJson,
    exportCurrentDecorAsJsonTemplate,
    decorTemplateList,
    applyDecorTemplateByListId,
    applyDecorSketchTemplate,
    copyDecorToNextScene,
    saveDecorTemplatesToProject,
    setDecorDraftTextureRepeat,
  };
}
