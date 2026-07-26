import {
  createAsyncThunk,
  createSelector,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import { mergeLightChannelsAtCount } from "../../../shared/components/light-console/light-channels-mutate";
import type { ScriptScene } from "../../../shared/types/script";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { desktopReadProjectPlaybook } from "../../../shared/platform/desktop-methods";
import type { ActorAnnotationField } from "../../../sync/api/actor-notes";

type SceneKey = string;

export type ShowScriptMarkdownMode =
  | "play"
  | "explication"
  | "comments";

const SHOW_SCRIPT_MARKDOWN_MODES: ReadonlyArray<ShowScriptMarkdownMode> = [
  "play",
  "explication",
  "comments",
];

function normalizeShowScriptMarkdownMode(raw: unknown): ShowScriptMarkdownMode {
  if (raw === "notes" || raw === "light" || raw === "requisites") return "play";
  if (raw === "play" || raw === "explication" || raw === "comments") {
    return raw;
  }
  return "play";
}

type SceneUiState = {
  markdownMode: ShowScriptMarkdownMode;
  playOriginalMode: boolean;
  annotationsMode: boolean;
  playlistOptions: { id: number; title: string }[];
  soundsOptions: { id: number; title: string; icon?: string; iconRemoteUrl?: string }[];
  selectedTrackId: number | null;
  selectedSoundId: number | null;
  lightChannels: string[];
  selectedLightSlot: number;
};

export interface ShowScriptMarkdownState {
  uiBySceneKey: Record<SceneKey, SceneUiState | undefined>;
}

const initialState: ShowScriptMarkdownState = {
  uiBySceneKey: {},
};

function getSceneKey(projectSlug: string, sceneName: string): SceneKey {
  return `${projectSlug}:${sceneName}`;
}

function getUiStorageKeys(projectSlug: string, sceneName: string) {
  return {
    markdownModeStorageKey: `showScript:markdownMode:${projectSlug}:${sceneName}`,
    playOriginalModeStorageKey: `showScript:playOriginalMode:${projectSlug}:${sceneName}`,
    annotationsModeStorageKey: `showScript:annotationsMode:${projectSlug}:${sceneName}`,
  };
}

function defaultSceneUi(): SceneUiState {
  return {
    markdownMode: "play",
    playOriginalMode: false,
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
  const storedAnnotations = localStorage.getItem(keys.annotationsModeStorageKey);
  const ui: Partial<SceneUiState> = {};
  if (storedMarkdown != null) {
    const mode = normalizeShowScriptMarkdownMode(storedMarkdown);
    ui.markdownMode = mode;
    if (storedMarkdown === "notes" || !SHOW_SCRIPT_MARKDOWN_MODES.includes(storedMarkdown as ShowScriptMarkdownMode)) {
      try {
        localStorage.setItem(keys.markdownModeStorageKey, mode);
      } catch {
        // ignore
      }
    }
  }
  if (storedAnnotations != null) {
    ui.annotationsMode = storedAnnotations === "true";
  }
  if (storedPlayOriginal != null) {
    ui.playOriginalMode = storedPlayOriginal === "true";
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
    const playbookData = state.playbook.playbookData ?? null;
    const serverShadow = state.playbook.serverShadow ?? null;
    const playlistRaw =
      playbookData && String(playbookData?.name ?? "") === String(args.sceneName ?? "")
        ? (playbookData as any)?.playlist
        : (playbookData as any)?.playlist;
    const soundsRaw =
      playbookData && String(playbookData?.name ?? "") === String(args.sceneName ?? "")
        ? (playbookData as any)?.sounds
        : (playbookData as any)?.sounds;
    const fromShadow = normalizeLightChannels(serverShadow?.lightChannels);
    const fromScene = normalizeLightChannels((playbookData as any)?.lightChannels);
    const sceneChannelsRaw = (playbookData as any)?.lightChannels;
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
      const scene = await desktopReadProjectPlaybook(api, args.projectSlug, args.sceneName);
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

export const showScriptMarkdownSlice = createSlice({
  name: "showScriptMarkdown",
  initialState,
  reducers: {
    setMarkdownMode(
      state,
      action: PayloadAction<{
        projectSlug: string;
        sceneName: string;
        mode: ShowScriptMarkdownMode | "notes" | "light";
      }>,
    ) {
      const sceneKey = getSceneKey(action.payload.projectSlug, action.payload.sceneName);
      const entry = state.uiBySceneKey[sceneKey] ?? defaultSceneUi();
      entry.markdownMode = normalizeShowScriptMarkdownMode(action.payload.mode);
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
  (uiBySceneKey, sceneKey): SceneUiState => {
    const ui = uiBySceneKey[sceneKey] ?? getDefaultUiForSceneKey(sceneKey);
    const markdownMode = normalizeShowScriptMarkdownMode(ui.markdownMode);
    if (markdownMode === ui.markdownMode) return ui;
    return { ...ui, markdownMode };
  },
);

export const selectActiveSceneMarkdownContext = createSelector(
  [
    (state: RootState, projectSlug: string, sceneName: string) =>
      selectShowScriptMarkdownUi(state, projectSlug, sceneName),
    (state: RootState) => state.playbook.scenes,
    (state: RootState) => state.playbook.currentPage,
  ],
  (
    ui,
    scenes,
    currentPage,
  ): {
    currentScene: ScriptScene | undefined;
    activeMarkdownField: "markdown" | "playMarkdown" | "explicationMarkdown";
    activeMarkdown: string;
    activeField: ActorAnnotationField;
  } => {
    const currentScene = scenes[currentPage];
    const activeMarkdownField: "markdown" | "playMarkdown" | "explicationMarkdown" =
      ui.markdownMode === "play"
        ? ui.playOriginalMode
          ? "markdown"
          : "playMarkdown"
        : ui.markdownMode === "explication"
          ? "explicationMarkdown"
          : "markdown";

    const activeMarkdown = String(currentScene?.[activeMarkdownField] ?? "");

    const activeField = activeMarkdownField as ActorAnnotationField;

    return { currentScene, activeMarkdownField, activeMarkdown, activeField };
  },
);

