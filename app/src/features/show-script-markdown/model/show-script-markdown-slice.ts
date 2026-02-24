import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import type { ScriptStep } from "../../../shared/types/script";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  createActorAnnotation,
  deleteActorAnnotation,
  listActorAnnotations,
  updateActorAnnotation,
  type ActorAnnotation,
  type ActorAnnotationField,
} from "../../../sync/api";

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

export type ShowScriptMarkdownMode = "notes" | "play";

type SceneUiState = {
  markdownMode: ShowScriptMarkdownMode;
  annotationsMode: boolean;
  playlistOptions: { id: number; title: string }[];
  selectedTrackId: number | null;
  lightChannels: string[]; // length 8
  selectedLightSlot: number; // 1..8
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
    annotationsModeStorageKey: `showScript:annotationsMode:${projectSlug}:${sceneName}`,
  };
}

function defaultSceneUi(): SceneUiState {
  return {
    markdownMode: "notes",
    annotationsMode: true,
    playlistOptions: [],
    selectedTrackId: null,
    lightChannels: Array.from({ length: 8 }, () => ""),
    selectedLightSlot: 1,
  };
}

function normalizeLightChannels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return Array.from({ length: 8 }, () => "");
  const mapped = raw.map((value) =>
    typeof value === "number" ? String(value) : String(value ?? ""),
  );
  return Array.from({ length: 8 }, (_, i) => mapped[i] ?? "");
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

export const initShowScriptMarkdownUi = createAsyncThunk<
  { sceneKey: SceneKey; ui: Partial<SceneUiState> },
  { projectSlug: string; sceneName: string }
>("showScriptMarkdown/initUi", async (args) => {
  const sceneKey = getSceneKey(args.projectSlug, args.sceneName);
  if (typeof window === "undefined") return { sceneKey, ui: {} };
  const keys = getUiStorageKeys(args.projectSlug, args.sceneName);
  const storedMarkdown = localStorage.getItem(keys.markdownModeStorageKey);
  const storedAnnotations = localStorage.getItem(keys.annotationsModeStorageKey);
  const ui: Partial<SceneUiState> = {};
  if (storedMarkdown === "notes" || storedMarkdown === "play") {
    ui.markdownMode = storedMarkdown;
  }
  if (storedAnnotations != null) {
    ui.annotationsMode = storedAnnotations === "true";
  }
  return { sceneKey, ui };
});

export const loadSceneScriptMarkdownMeta = createAsyncThunk<
  {
    sceneKey: SceneKey;
    playlistOptions: { id: number; title: string }[];
    lightChannels: string[];
  },
  { projectSlug: string; sceneName: string }
>("showScriptMarkdown/loadSceneMeta", async (args) => {
  const api = getDesktopApi();
  const sceneKey = getSceneKey(args.projectSlug, args.sceneName);
  if (!api) {
    return {
      sceneKey,
      playlistOptions: [],
      lightChannels: Array.from({ length: 8 }, () => ""),
    };
  }
  const scene = await api.readProjectScene(args.projectSlug, args.sceneName);
  return {
    sceneKey,
    playlistOptions: normalizePlaylistOptions((scene as any)?.playlist),
    lightChannels: normalizeLightChannels((scene as any)?.lightChannels),
  };
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
      action: PayloadAction<{ projectSlug: string; sceneName: string; mode: ShowScriptMarkdownMode }>,
    ) {
      const sceneKey = getSceneKey(action.payload.projectSlug, action.payload.sceneName);
      const entry = state.uiBySceneKey[sceneKey] ?? defaultSceneUi();
      entry.markdownMode = action.payload.mode;
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
        ? Math.max(1, Math.min(8, Math.trunc(n)))
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
      next.lightChannels = normalizeLightChannels(action.payload.lightChannels);
      if (next.selectedTrackId == null && next.playlistOptions.length > 0) {
        next.selectedTrackId = next.playlistOptions[0].id;
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

export function selectShowScriptMarkdownUi(
  state: RootState,
  projectSlug: string,
  sceneName: string,
): SceneUiState {
  const sceneKey = getSceneKey(projectSlug, sceneName);
  return state.showScriptMarkdown.uiBySceneKey[sceneKey] ?? defaultSceneUi();
}

export function selectActiveStepMarkdownContext(
  state: RootState,
  projectSlug: string,
  sceneName: string,
): {
  currentStep: ScriptStep | undefined;
  activeMarkdownField: "markdown" | "playMarkdown";
  activeMarkdown: string;
  activeField: ActorAnnotationField;
} {
  const ui = selectShowScriptMarkdownUi(state, projectSlug, sceneName);
  const currentStep = state.scene.steps[state.scene.currentPage];
  const activeMarkdownField: "markdown" | "playMarkdown" =
    ui.markdownMode === "play" ? "playMarkdown" : "markdown";
  const activeMarkdown = String(currentStep?.[activeMarkdownField] ?? "");
  const activeField = (activeMarkdownField === "playMarkdown"
    ? "playMarkdown"
    : "markdown") as ActorAnnotationField;

  return {
    currentStep,
    activeMarkdownField,
    activeMarkdown,
    activeField,
  };
}

export function selectAnnotations(
  state: RootState,
  cacheKey: CacheKey,
): AnnotationsEntry {
  return (
    state.showScriptMarkdown.annotationsByKey[cacheKey] ?? {
      items: [],
      loading: false,
      error: null,
    }
  );
}

