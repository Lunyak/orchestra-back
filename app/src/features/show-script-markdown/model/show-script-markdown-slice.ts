import {
  createAsyncThunk,
  createSelector,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import { mergeLightChannelsAtCount } from "../../../shared/components/light-console/light-channels-mutate";
import type { ScriptStep } from "../../../shared/types/script";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { desktopReadProjectScene } from "../../../shared/platform/desktop-methods";
import {
  createActorAnnotation,
  deleteActorAnnotation,
  listActorAnnotations,
  updateActorAnnotation,
  type ActorAnnotation,
  type ActorAnnotationField,
} from "../../../sync/api/actor-notes";

type CacheKey = string;
type SceneKey = string;

function getAccessToken(getState: () => RootState): string | null {
  const fromState = getState().auth?.accessToken ?? null;
  if (fromState) return fromState;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

type AnnotationsEntry = {
  items: ActorAnnotation[];
  loading: boolean;
  error: string | null;
};

export type ShowScriptMarkdownMode = "notes" | "play" | "explication" | "comments" | "requisites" | "light";

type SceneUiState = {
  markdownMode: ShowScriptMarkdownMode;
  playOriginalMode: boolean;
  /** Оглавление «Картины» в режиме редактирования (notes / play / explication). */
  editorTocEnabled: boolean;
  annotationsMode: boolean;
  playlistOptions: { id: number; title: string }[];
  soundsOptions: { id: number; title: string; icon?: string; iconRemoteUrl?: string }[];
  selectedTrackId: number | null;
  selectedSoundId: number | null;
  lightChannels: string[];
  selectedLightSlot: number;
};

export interface ShowScriptMarkdownState {
  annotationsByKey: Record<CacheKey, AnnotationsEntry | undefined>;
  uiBySceneKey: Record<SceneKey, SceneUiState | undefined>;
}

const initialState: ShowScriptMarkdownState = {
  annotationsByKey: {},
  uiBySceneKey: {},
};

function getSceneKey(projectSlug: string, sceneName: string): SceneKey {
  return `${projectSlug}:${sceneName}`;
}

function getUiStorageKeys(projectSlug: string, sceneName: string) {
  return {
    markdownModeStorageKey: `showScript:markdownMode:${projectSlug}:${sceneName}`,
    playOriginalModeStorageKey: `showScript:playOriginalMode:${projectSlug}:${sceneName}`,
    editorTocStorageKey: `showScript:editorToc:${projectSlug}:${sceneName}`,
    annotationsModeStorageKey: `showScript:annotationsMode:${projectSlug}:${sceneName}`,
  };
}

function defaultSceneUi(): SceneUiState {
  return {
    markdownMode: "notes",
    playOriginalMode: false,
    editorTocEnabled: true,
    annotationsMode: true,
    playlistOptions: [],
    soundsOptions: [],
    selectedTrackId: null,
    selectedSoundId: null,
    lightChannels: Array.from({ length: 8 }, () => ""),
    selectedLightSlot: 1,
  };
}

const defaultUiBySceneKeyCache = new Map<SceneKey, SceneUiState>();
function getDefaultUiForSceneKey(sceneKey: SceneKey): SceneUiState {
  const existing = defaultUiBySceneKeyCache.get(sceneKey);
  if (existing) return existing;
  const created = defaultSceneUi();
  defaultUiBySceneKeyCache.set(sceneKey, created);
  return created;
}

const defaultAnnotationsByCacheKey = new Map<CacheKey, AnnotationsEntry>();
function getDefaultAnnotationsForCacheKey(cacheKey: CacheKey): AnnotationsEntry {
  const existing = defaultAnnotationsByCacheKey.get(cacheKey);
  if (existing) return existing;
  const created: AnnotationsEntry = { items: [], loading: false, error: null };
  defaultAnnotationsByCacheKey.set(cacheKey, created);
  return created;
}

function normalizeLightChannels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return Array.from({ length: 8 }, () => "");
  const mapped = raw.map((value) =>
    typeof value === "number" ? String(value) : String(value ?? ""),
  );
  if (mapped.length === 0) return Array.from({ length: 8 }, () => "");
  return Array.from({ length: mapped.length }, (_, i) => mapped[i] ?? "");
}

function normalizePlaylistOptions(raw: unknown): { id: number; title: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item: any) => item?.id != null)
    .map((item: any) => ({
      id: Number(item.id),
      title: String(item.title ?? `Трек ${item.id}`),
    }))
    .filter((x) => Number.isFinite(x.id));
}

function normalizeSoundsOptions(
  raw: unknown,
): { id: number; title: string; icon?: string; iconRemoteUrl?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item: any) => item?.id != null)
    .map((item: any) => ({
      id: Number(item.id),
      title: String(item.title ?? `Звук ${item.id}`),
      icon: item?.icon != null ? String(item.icon) : undefined,
      iconRemoteUrl: item?.iconRemoteUrl != null ? String(item.iconRemoteUrl) : undefined,
    }))
    .filter((x) => Number.isFinite(x.id));
}

export const initShowScriptMarkdownUi = createAsyncThunk<
  { sceneKey: SceneKey; ui: Partial<SceneUiState> },
  { projectSlug: string; sceneName: string }
>("showScriptMarkdown/initUi", async (args) => {
  const sceneKey = getSceneKey(args.projectSlug, args.sceneName);
  if (typeof window === "undefined") return { sceneKey, ui: {} };
  const keys = getUiStorageKeys(args.projectSlug, args.sceneName);
  const storedMarkdown = localStorage.getItem(keys.markdownModeStorageKey);
  const storedPlayOriginal = localStorage.getItem(keys.playOriginalModeStorageKey);
  const storedEditorToc = localStorage.getItem(keys.editorTocStorageKey);
  const storedAnnotations = localStorage.getItem(keys.annotationsModeStorageKey);
  const ui: Partial<SceneUiState> = {};
  if (
    storedMarkdown === "notes" ||
    storedMarkdown === "play" ||
    storedMarkdown === "explication" ||
    storedMarkdown === "comments" ||
    storedMarkdown === "requisites" ||
    storedMarkdown === "light"
  ) {
    ui.markdownMode = storedMarkdown;
  }
  if (storedAnnotations != null) {
    ui.annotationsMode = storedAnnotations === "true";
  }
  if (storedPlayOriginal != null) {
    ui.playOriginalMode = storedPlayOriginal === "true";
  }
  if (storedEditorToc != null) {
    ui.editorTocEnabled = storedEditorToc === "true";
  }
  return { sceneKey, ui };
});

export const loadSceneScriptMarkdownMeta = createAsyncThunk<
  {
    sceneKey: SceneKey;
    playlistOptions: { id: number; title: string }[];
    soundsOptions: { id: number; title: string; icon?: string; iconRemoteUrl?: string }[];
    lightChannels: string[];
  },
  { projectSlug: string; sceneName: string }
>("showScriptMarkdown/loadSceneMeta", async (args, thunkApi) => {
  const api = getDesktopApi();
  const sceneKey = getSceneKey(args.projectSlug, args.sceneName);
  const getFromStore = () => {
    const state = thunkApi.getState() as RootState;
    const sceneData = (state as any)?.scene?.sceneData ?? null;
    const serverShadow = (state as any)?.scene?.serverShadow ?? null;
    const playlistRaw =
      sceneData && String(sceneData?.name ?? "") === String(args.sceneName ?? "")
        ? (sceneData as any)?.playlist
        : (sceneData as any)?.playlist;
    const soundsRaw =
      sceneData && String(sceneData?.name ?? "") === String(args.sceneName ?? "")
        ? (sceneData as any)?.sounds
        : (sceneData as any)?.sounds;
    const fromShadow = normalizeLightChannels(serverShadow?.lightChannels);
    const fromScene = normalizeLightChannels((sceneData as any)?.lightChannels);
    const sceneChannelsRaw = (sceneData as any)?.lightChannels;
    const sceneHasChannels = Array.isArray(sceneChannelsRaw) && sceneChannelsRaw.length > 0;
    const primary = sceneHasChannels
      ? fromScene
      : fromShadow.length > 0
        ? fromShadow
        : fromScene;
    const secondary = primary === fromScene ? fromShadow : fromScene;
    const lightChannels = mergeLightChannelsAtCount(primary, secondary);
    return {
      playlistOptions: normalizePlaylistOptions(playlistRaw),
      soundsOptions: normalizeSoundsOptions(soundsRaw),
      lightChannels,
    };
  };

  if (api) {
    try {
      const scene = await desktopReadProjectScene(api, args.projectSlug, args.sceneName);
      const fromFile = {
        playlistOptions: normalizePlaylistOptions((scene as any)?.playlist),
        soundsOptions: normalizeSoundsOptions((scene as any)?.sounds),
        lightChannels: normalizeLightChannels((scene as any)?.lightChannels),
      };
      const fromStore = getFromStore();
      const mergedFile = {
        ...fromFile,
        lightChannels: mergeLightChannelsAtCount(
          fromFile.lightChannels,
          fromStore.lightChannels,
        ),
      };
      const fileHasLight = mergedFile.lightChannels.some((x) => String(x ?? "").trim().length > 0);
      if (fromFile.playlistOptions.length > 0 || fromFile.soundsOptions.length > 0 || fileHasLight) {
        return { sceneKey, ...mergedFile };
      }
      // If file is empty (common during sync/first run), prefer store snapshot.
      if (
        fromStore.playlistOptions.length > 0 ||
        fromStore.soundsOptions.length > 0 ||
        fromStore.lightChannels.some((x) => String(x ?? "").trim().length > 0)
      ) {
        return { sceneKey, ...fromStore };
      }
      return { sceneKey, ...mergedFile };
    } catch {
      // Fall through to store-based meta.
    }
  }

  return { sceneKey, ...getFromStore() };
});

export const loadActorAnnotations = createAsyncThunk<
  { cacheKey: CacheKey; annotations: ActorAnnotation[] },
  { cacheKey: CacheKey; projectSlug: string; sceneName: string; stepId: number; field: ActorAnnotationField }
>("showScriptMarkdown/loadActorAnnotations", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) return { cacheKey: args.cacheKey, annotations: [] };
  const res = await listActorAnnotations(token, {
    projectSlug: args.projectSlug,
    sceneName: args.sceneName,
    stepId: args.stepId,
    field: args.field,
  });
  return { cacheKey: args.cacheKey, annotations: res.annotations ?? [] };
});

export const createAnnotation = createAsyncThunk<
  { cacheKey: CacheKey; annotation: ActorAnnotation },
  {
    cacheKey: CacheKey;
    projectSlug: string;
    sceneName: string;
    stepId: number;
    field: ActorAnnotationField;
    startOffset: number;
    endOffset: number;
    selectedText?: string;
    noteText: string;
  }
>("showScriptMarkdown/createAnnotation", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("No access token");
  }
  const res = await createActorAnnotation(token, {
    projectSlug: args.projectSlug,
    sceneName: args.sceneName,
    stepId: args.stepId,
    field: args.field,
    startOffset: args.startOffset,
    endOffset: args.endOffset,
    selectedText: args.selectedText,
    noteText: args.noteText,
  });
  return { cacheKey: args.cacheKey, annotation: res.annotation };
});

export const updateAnnotation = createAsyncThunk<
  { cacheKey: CacheKey; annotation: ActorAnnotation },
  { cacheKey: CacheKey; id: string; noteText: string }
>("showScriptMarkdown/updateAnnotation", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("No access token");
  }
  const res = await updateActorAnnotation(token, args.id, { noteText: args.noteText });
  return { cacheKey: args.cacheKey, annotation: res.annotation };
});

export const deleteAnnotation = createAsyncThunk<
  { cacheKey: CacheKey; id: string },
  { cacheKey: CacheKey; id: string }
>("showScriptMarkdown/deleteAnnotation", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("No access token");
  }
  await deleteActorAnnotation(token, args.id);
  return { cacheKey: args.cacheKey, id: args.id };
});

function sortAnnotations(items: ActorAnnotation[]): ActorAnnotation[] {
  return items
    .slice()
    .sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
}

export const showScriptMarkdownSlice = createSlice({
  name: "showScriptMarkdown",
  initialState,
  reducers: {
    setMarkdownMode(
      state,
      action: PayloadAction<{
        projectSlug: string;
        sceneName: string;
        mode: ShowScriptMarkdownMode;
      }>,
    ) {
      const sceneKey = getSceneKey(action.payload.projectSlug, action.payload.sceneName);
      const entry = state.uiBySceneKey[sceneKey] ?? defaultSceneUi();
      entry.markdownMode = action.payload.mode;
      state.uiBySceneKey[sceneKey] = entry;
    },
    setPlayOriginalMode(
      state,
      action: PayloadAction<{ projectSlug: string; sceneName: string; enabled: boolean }>,
    ) {
      const sceneKey = getSceneKey(action.payload.projectSlug, action.payload.sceneName);
      const entry = state.uiBySceneKey[sceneKey] ?? defaultSceneUi();
      entry.playOriginalMode = action.payload.enabled;
      state.uiBySceneKey[sceneKey] = entry;
    },
    setEditorTocEnabled(
      state,
      action: PayloadAction<{ projectSlug: string; sceneName: string; enabled: boolean }>,
    ) {
      const sceneKey = getSceneKey(action.payload.projectSlug, action.payload.sceneName);
      const entry = state.uiBySceneKey[sceneKey] ?? defaultSceneUi();
      entry.editorTocEnabled = action.payload.enabled;
      state.uiBySceneKey[sceneKey] = entry;
    },
    setAnnotationsMode(
      state,
      action: PayloadAction<{ projectSlug: string; sceneName: string; enabled: boolean }>,
    ) {
      const sceneKey = getSceneKey(action.payload.projectSlug, action.payload.sceneName);
      const entry = state.uiBySceneKey[sceneKey] ?? defaultSceneUi();
      entry.annotationsMode = action.payload.enabled;
      state.uiBySceneKey[sceneKey] = entry;
    },
    setSelectedTrackId(
      state,
      action: PayloadAction<{ projectSlug: string; sceneName: string; trackId: number | null }>,
    ) {
      const sceneKey = getSceneKey(action.payload.projectSlug, action.payload.sceneName);
      const entry = state.uiBySceneKey[sceneKey] ?? defaultSceneUi();
      entry.selectedTrackId = action.payload.trackId;
      state.uiBySceneKey[sceneKey] = entry;
    },
    setSelectedSoundId(
      state,
      action: PayloadAction<{ projectSlug: string; sceneName: string; soundId: number | null }>,
    ) {
      const sceneKey = getSceneKey(action.payload.projectSlug, action.payload.sceneName);
      const entry = state.uiBySceneKey[sceneKey] ?? defaultSceneUi();
      entry.selectedSoundId = action.payload.soundId;
      state.uiBySceneKey[sceneKey] = entry;
    },
    setLightChannels(
      state,
      action: PayloadAction<{ projectSlug: string; sceneName: string; lightChannels: string[] }>,
    ) {
      const sceneKey = getSceneKey(action.payload.projectSlug, action.payload.sceneName);
      const entry = state.uiBySceneKey[sceneKey] ?? defaultSceneUi();
      entry.lightChannels = normalizeLightChannels(action.payload.lightChannels);
      state.uiBySceneKey[sceneKey] = entry;
    },
    setSelectedLightSlot(
      state,
      action: PayloadAction<{ projectSlug: string; sceneName: string; slot: number }>,
    ) {
      const sceneKey = getSceneKey(action.payload.projectSlug, action.payload.sceneName);
      const entry = state.uiBySceneKey[sceneKey] ?? defaultSceneUi();
      const n = Number(action.payload.slot);
      entry.selectedLightSlot = Number.isFinite(n)
        ? Math.max(1, Math.trunc(n))
        : 1;
      state.uiBySceneKey[sceneKey] = entry;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(initShowScriptMarkdownUi.fulfilled, (state, action) => {
      const prev = state.uiBySceneKey[action.payload.sceneKey] ?? defaultSceneUi();
      state.uiBySceneKey[action.payload.sceneKey] = { ...prev, ...action.payload.ui };
    });

    builder.addCase(loadSceneScriptMarkdownMeta.fulfilled, (state, action) => {
      const prev = state.uiBySceneKey[action.payload.sceneKey] ?? defaultSceneUi();
      const next = { ...prev };
      next.playlistOptions = action.payload.playlistOptions ?? [];
      next.soundsOptions = action.payload.soundsOptions ?? [];
      next.lightChannels = mergeLightChannelsAtCount(
        normalizeLightChannels(action.payload.lightChannels),
        prev.lightChannels ?? [],
      );
      if (next.selectedTrackId == null && next.playlistOptions.length > 0) {
        next.selectedTrackId = next.playlistOptions[0].id;
      }
      if (next.selectedSoundId == null && next.soundsOptions.length > 0) {
        next.selectedSoundId = next.soundsOptions[0].id;
      }
      if (
        next.selectedSoundId != null &&
        !next.soundsOptions.some((s) => s.id === next.selectedSoundId)
      ) {
        next.selectedSoundId = next.soundsOptions[0]?.id ?? null;
      }
      state.uiBySceneKey[action.payload.sceneKey] = next;
    });

    builder.addCase(loadActorAnnotations.pending, (state, action) => {
      const { cacheKey } = action.meta.arg;
      const prev = state.annotationsByKey[cacheKey];
      state.annotationsByKey[cacheKey] = {
        items: prev?.items ?? [],
        loading: true,
        error: null,
      };
    });
    builder.addCase(loadActorAnnotations.fulfilled, (state, action) => {
      state.annotationsByKey[action.payload.cacheKey] = {
        items: sortAnnotations(action.payload.annotations ?? []),
        loading: false,
        error: null,
      };
    });
    builder.addCase(loadActorAnnotations.rejected, (state, action) => {
      const { cacheKey } = action.meta.arg;
      const prev = state.annotationsByKey[cacheKey];
      state.annotationsByKey[cacheKey] = {
        items: prev?.items ?? [],
        loading: false,
        error: "Не удалось загрузить метки",
      };
    });

    builder.addCase(createAnnotation.fulfilled, (state, action) => {
      const entry = state.annotationsByKey[action.payload.cacheKey] ?? {
        items: [],
        loading: false,
        error: null,
      };
      entry.items = sortAnnotations([...entry.items, action.payload.annotation]);
      entry.error = null;
      state.annotationsByKey[action.payload.cacheKey] = entry;
    });
    builder.addCase(createAnnotation.rejected, (state, action) => {
      const { cacheKey } = action.meta.arg;
      const prev = state.annotationsByKey[cacheKey];
      state.annotationsByKey[cacheKey] = {
        items: prev?.items ?? [],
        loading: false,
        error: "Не удалось создать пометку",
      };
    });

    builder.addCase(updateAnnotation.fulfilled, (state, action) => {
      const entry = state.annotationsByKey[action.payload.cacheKey];
      if (!entry) return;
      entry.items = entry.items.map((a) =>
        a.id === action.payload.annotation.id ? action.payload.annotation : a,
      );
      entry.items = sortAnnotations(entry.items);
      entry.error = null;
    });
    builder.addCase(updateAnnotation.rejected, (state, action) => {
      const { cacheKey } = action.meta.arg;
      const prev = state.annotationsByKey[cacheKey];
      state.annotationsByKey[cacheKey] = {
        items: prev?.items ?? [],
        loading: false,
        error: "Не удалось сохранить",
      };
    });

    builder.addCase(deleteAnnotation.fulfilled, (state, action) => {
      const entry = state.annotationsByKey[action.payload.cacheKey];
      if (!entry) return;
      entry.items = entry.items.filter((a) => a.id !== action.payload.id);
      entry.error = null;
    });
    builder.addCase(deleteAnnotation.rejected, (state, action) => {
      const { cacheKey } = action.meta.arg;
      const prev = state.annotationsByKey[cacheKey];
      state.annotationsByKey[cacheKey] = {
        items: prev?.items ?? [],
        loading: false,
        error: "Не удалось удалить",
      };
    });
  },
});

export const showScriptMarkdownReducer = showScriptMarkdownSlice.reducer;
export const showScriptMarkdownActions = showScriptMarkdownSlice.actions;

export const selectShowScriptMarkdownUi = createSelector(
  [
    (state: RootState) => state.showScriptMarkdown.uiBySceneKey,
    (_state: RootState, projectSlug: string, sceneName: string) =>
      getSceneKey(projectSlug, sceneName),
  ],
  (uiBySceneKey, sceneKey): SceneUiState =>
    uiBySceneKey[sceneKey] ?? getDefaultUiForSceneKey(sceneKey),
);

export const selectActiveStepMarkdownContext = createSelector(
  [
    (state: RootState, projectSlug: string, sceneName: string) =>
      selectShowScriptMarkdownUi(state, projectSlug, sceneName),
    (state: RootState) => state.scene.steps,
    (state: RootState) => state.scene.currentPage,
  ],
  (
    ui,
    steps,
    currentPage,
  ): {
    currentStep: ScriptStep | undefined;
    activeMarkdownField: "markdown" | "playMarkdown" | "explicationMarkdown";
    activeMarkdown: string;
    activeField: ActorAnnotationField;
  } => {
    const currentStep = steps[currentPage];
    const activeMarkdownField: "markdown" | "playMarkdown" | "explicationMarkdown" =
      ui.markdownMode === "play"
        ? ui.playOriginalMode
          ? "markdown"
          : "playMarkdown"
        : ui.markdownMode === "explication"
          ? "explicationMarkdown"
          : "markdown";

    const activeMarkdown = String(currentStep?.[activeMarkdownField] ?? "");

    const activeField = activeMarkdownField as ActorAnnotationField;

    return { currentStep, activeMarkdownField, activeMarkdown, activeField };
  },
);

export const selectAnnotations = createSelector(
  [
    (state: RootState, cacheKey: CacheKey) =>
      state.showScriptMarkdown.annotationsByKey[cacheKey],
    (_state: RootState, cacheKey: CacheKey) => cacheKey,
  ],
  (entry, cacheKey): AnnotationsEntry =>
    entry ?? getDefaultAnnotationsForCacheKey(cacheKey),
);

