import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ScriptStep, TheaterLayout } from "../../../shared/types/script";
import type { RootState } from "../../../shared/store/store";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { ensureProject, uploadProjectFile } from "../../../sync/api";

export const DEFAULT_THEATER_LAYOUT: TheaterLayout = {
  hallWidth: 9,
  hallDepth: 6,
  wallHeight: 6,
  audienceStartZ: 3,
  seatRows: 4,
  seatsPerRow: 7,
  seatSpacing: 1.1,
  rowSpacing: 0.8,
  rowRise: 0.25,
  aisleWidth: 1.2,
  aisleCenterX: 0,
  doorWidth: 1.2,
  doorHeight: 2.2,
  doorZ: -6,
};

export interface SceneData {
  name?: string;
  steps?: ScriptStep[];
  playlist?: any[];
  sounds?: any[];
  theaterLayout?: TheaterLayout;
  /** Глобальное распределение: роль -> актёры (email/имя). Истина для назначений. */
  roleAssignments?: Record<string, string[]>;
}

export interface SceneSound {
  id: number;
  title: string;
  file: string;
  icon?: string;
  iconRemoteKey?: string;
  iconRemoteUrl?: string;
  volume?: number;
  fadeMs?: number;
  loop?: boolean;
  remoteUrl?: string;
  remoteKey?: string;
  /** Полный путь к файлу на диске (только локально, для загрузки на сервер) */
  filePath?: string;
}

function getAccessToken(getState: () => RootState): string | null {
  const fromState = getState().auth?.accessToken ?? null;
  if (fromState) return fromState;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

function ensureProjectIdCached(projectSlug: string, projectId: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(`projectId:${projectSlug}`, projectId);
  } catch {
    // ignore
  }
}

export interface SceneState {
  sceneData: SceneData | null;
  steps: ScriptStep[];
  theaterLayout: TheaterLayout;
  currentPage: number;
  isSceneReady: boolean;
  hasLocalEdits: boolean;
  stepsRevision: number;
  sceneDataRevision: number;
  soundsUpload: { uploading: boolean; error: string | null };
}

const initialState: SceneState = {
  sceneData: null,
  steps: [],
  theaterLayout: DEFAULT_THEATER_LAYOUT,
  currentPage: 0,
  isSceneReady: false,
  hasLocalEdits: false,
  stepsRevision: 0,
  sceneDataRevision: 0,
  soundsUpload: { uploading: false, error: null },
};

function ensureNonEmptySteps(raw: ScriptStep[]): ScriptStep[] {
  if (raw.length > 0) return raw;
  return [{ id: 1, title: "Новый шаг", markdown: "" }];
}

function nextSoundIds(sounds: any[] | undefined, count: number): number[] {
  const maxId = (sounds ?? []).reduce((acc: number, s: any) => Math.max(acc, Number(s?.id ?? 0)), 0);
  return Array.from({ length: count }, (_v, i) => maxId + i + 1);
}

export const uploadSceneSoundsWeb = createAsyncThunk<
  { projectSlug: string; sounds: SceneSound[] },
  { projectSlug: string; files: File[] }
>("scene/uploadSceneSoundsWeb", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("Нет токена авторизации");
  }
  const files = (args.files ?? []).filter(Boolean);
  if (files.length === 0) return { projectSlug: args.projectSlug, sounds: [] };

  const projectSlug = args.projectSlug;
  const cachedId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;
  const projectId =
    cachedId ??
    (await ensureProject(token, projectSlug, `Проект ${projectSlug}`)).id;
  if (!cachedId) ensureProjectIdCached(projectSlug, projectId);

  const state = api.getState() as RootState;
  const ids = nextSoundIds(state.scene.sceneData?.sounds, files.length);

  const uploaded: SceneSound[] = [];
  // По одному, чтобы не положить сервер
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const { key, url } = await uploadProjectFile(token, {
      projectId,
      type: "sound",
      file,
    });
    const title = file.name.replace(/\.[^.]+$/, "");
    uploaded.push({
      id: ids[i],
      title,
      file: file.name,
      volume: 0.8,
      fadeMs: 500,
      loop: false,
      remoteKey: key,
      remoteUrl: url,
    });
  }

  return { projectSlug, sounds: uploaded };
});

export const pickSceneSoundsDesktop = createAsyncThunk<
  { projectSlug: string; sounds: SceneSound[] },
  { projectSlug: string }
>("scene/pickSceneSoundsDesktop", async (args, api) => {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error("Desktop API недоступен");
  }
  const res = await desktopApi.pickProjectSound(args.projectSlug);
  if (!res?.ok) {
    if (res?.canceled) return { projectSlug: args.projectSlug, sounds: [] };
    throw new Error(res?.error ?? "Не удалось выбрать звук");
  }
  const tracks = Array.isArray(res.tracks) ? res.tracks : [];
  if (tracks.length === 0) return { projectSlug: args.projectSlug, sounds: [] };

  const state = api.getState() as RootState;
  const ids = nextSoundIds(state.scene.sceneData?.sounds, tracks.length);

  const token = getAccessToken(api.getState as () => RootState);
  let projectId: string | null = null;
  if (token) {
    const cached =
      typeof window !== "undefined"
        ? localStorage.getItem(`projectId:${args.projectSlug}`)
        : null;
    if (cached) {
      projectId = cached;
    } else {
      const proj = await ensureProject(token, args.projectSlug, `Проект ${args.projectSlug}`);
      projectId = proj.id;
      ensureProjectIdCached(args.projectSlug, projectId);
    }
  }

  const uploaded: SceneSound[] = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const t = tracks[i] as { title?: string; file?: string; filePath?: string };
    const base: SceneSound = {
      id: ids[i],
      title: String(t.title ?? "").trim() || String(t.file ?? "Sound"),
      file: String(t.file ?? ""),
      filePath: t.filePath,
      volume: 0.8,
      fadeMs: 500,
      loop: false,
    };

    if (token && projectId && typeof desktopApi.invoke === "function") {
      try {
        const up = (await desktopApi.invoke("upload-project-sound", {
          projectName: args.projectSlug,
          file: t.filePath || t.file,
          accessToken: token,
          projectId,
        })) as { ok?: boolean; key?: string; url?: string; error?: string };
        if (up?.ok && up.key && up.url) {
          base.remoteKey = up.key;
          base.remoteUrl = up.url;
        } else if (up?.error) {
          console.error("[sounds] upload-project-sound failed:", up.error);
        }
      } catch (err) {
        console.error("[sounds] upload-project-sound error:", err);
      }
    }

    uploaded.push(base);
  }

  return { projectSlug: args.projectSlug, sounds: uploaded };
});

export const sceneSlice = createSlice({
  name: "scene",
  initialState,
  reducers: {
    resetForProject(state) {
      state.sceneData = null;
      state.steps = [];
      state.theaterLayout = DEFAULT_THEATER_LAYOUT;
      state.currentPage = 0;
      state.isSceneReady = false;
      state.hasLocalEdits = false;
      state.stepsRevision += 1;
      state.sceneDataRevision += 1;
    },
    hydrateScene(
      state,
      action: PayloadAction<{
        sceneData: SceneData | null;
        steps: ScriptStep[];
        theaterLayout: TheaterLayout;
        currentPage?: number;
        isSceneReady: boolean;
      }>,
    ) {
      state.sceneData = action.payload.sceneData;
      state.steps = ensureNonEmptySteps(action.payload.steps);
      state.theaterLayout = action.payload.theaterLayout;
      state.currentPage = action.payload.currentPage ?? 0;
      state.isSceneReady = action.payload.isSceneReady;
      state.hasLocalEdits = false;
      state.stepsRevision += 1;
      state.sceneDataRevision += 1;
    },
    setSceneData(state, action: PayloadAction<SceneData | null>) {
      state.sceneData = action.payload;
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    setRoleAssignments(state, action: PayloadAction<Record<string, string[]>>) {
      state.sceneData = { ...(state.sceneData ?? {}), roleAssignments: action.payload };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    setSteps(state, action: PayloadAction<ScriptStep[]>) {
      state.steps = ensureNonEmptySteps(action.payload);
      state.hasLocalEdits = true;
      state.stepsRevision += 1;
    },
    updateStep(state, action: PayloadAction<{ id: number; changes: Partial<ScriptStep> }>) {
      const { id, changes } = action.payload;
      const idx = state.steps.findIndex((s) => s.id === id);
      if (idx === -1) return;
      state.steps[idx] = { ...state.steps[idx], ...changes };
      state.hasLocalEdits = true;
      state.stepsRevision += 1;
    },
    resetAllRequisites(state) {
      state.steps = state.steps.map((step) => ({
        ...step,
        requisites: (step.requisites ?? []).map((item) => ({ ...item, checked: false })),
      }));
      state.hasLocalEdits = true;
      state.stepsRevision += 1;
    },
    setTheaterLayout(state, action: PayloadAction<TheaterLayout>) {
      state.theaterLayout = action.payload;
      state.hasLocalEdits = true;
    },
    setCurrentPage(state, action: PayloadAction<number>) {
      state.currentPage = action.payload;
    },
    addStep(state) {
      state.hasLocalEdits = true;
      const nextId = state.steps.reduce((acc, step) => Math.max(acc, step.id), 0) + 1;
      const insertIndex = Math.min(state.currentPage + 1, state.steps.length);
      const sourceStep = state.steps[state.currentPage];
      const nextRequisites = sourceStep?.requisites
        ? sourceStep.requisites.map((item) => ({ ...item, checked: false }))
        : [];
      const nextItem: ScriptStep = {
        id: nextId,
        title: `Шаг ${nextId}`,
        markdown: "",
        requisites: nextRequisites,
      };
      state.steps.splice(insertIndex, 0, nextItem);
      state.currentPage = insertIndex;
      state.stepsRevision += 1;
    },
    deleteStep(state, action: PayloadAction<number>) {
      state.hasLocalEdits = true;
      const id = action.payload;
      const next = state.steps.filter((s) => s.id !== id);
      if (next.length === 0) {
        state.currentPage = 0;
        state.steps = [{ id: 1, title: "Новый шаг", markdown: "" }];
        state.stepsRevision += 1;
        return;
      }
      state.steps = next;
      state.currentPage = Math.min(state.currentPage, next.length - 1);
      state.stepsRevision += 1;
    },
    reorderSteps(state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= state.steps.length || toIndex >= state.steps.length) return;
      state.hasLocalEdits = true;
      const [moved] = state.steps.splice(fromIndex, 1);
      state.steps.splice(toIndex, 0, moved);
      const prev = state.currentPage;
      if (prev === fromIndex) state.currentPage = toIndex;
      else if (fromIndex < toIndex && prev > fromIndex && prev <= toIndex) state.currentPage = prev - 1;
      else if (fromIndex > toIndex && prev < fromIndex && prev >= toIndex) state.currentPage = prev + 1;
      state.stepsRevision += 1;
    },
    markSaved(state) {
      state.hasLocalEdits = false;
    },
    addSounds(state, action: PayloadAction<SceneSound[]>) {
      const next = action.payload ?? [];
      if (next.length === 0) return;
      const prev = (state.sceneData as any)?.sounds;
      const prevList = Array.isArray(prev) ? prev : [];
      state.sceneData = { ...(state.sceneData ?? {}), sounds: [...prevList, ...next] };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    updateSound(
      state,
      action: PayloadAction<{ id: number; changes: Partial<SceneSound> }>,
    ) {
      const listRaw = (state.sceneData as any)?.sounds;
      const list = Array.isArray(listRaw) ? listRaw : [];
      const idx = list.findIndex((s: any) => Number(s?.id) === action.payload.id);
      if (idx === -1) return;
      const nextItem = { ...list[idx], ...action.payload.changes };
      const next = [...list];
      next[idx] = nextItem;
      state.sceneData = { ...(state.sceneData ?? {}), sounds: next };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    removeSound(state, action: PayloadAction<number>) {
      const listRaw = (state.sceneData as any)?.sounds;
      const list = Array.isArray(listRaw) ? listRaw : [];
      const next = list.filter((s: any) => Number(s?.id) !== action.payload);
      state.sceneData = { ...(state.sceneData ?? {}), sounds: next };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
  },
  extraReducers: (builder) => {
    const pending = (state: SceneState) => {
      state.soundsUpload.uploading = true;
      state.soundsUpload.error = null;
    };
    const fulfilled = (state: SceneState, action: PayloadAction<{ sounds: SceneSound[] }>) => {
      state.soundsUpload.uploading = false;
      state.soundsUpload.error = null;
      const next = action.payload?.sounds ?? [];
      if (next.length === 0) return;
      const prev = (state.sceneData as any)?.sounds;
      const prevList = Array.isArray(prev) ? prev : [];
      state.sceneData = { ...(state.sceneData ?? {}), sounds: [...prevList, ...next] };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    };
    const rejected = (state: SceneState, action: any) => {
      state.soundsUpload.uploading = false;
      state.soundsUpload.error =
        action?.error?.message ?? "Не удалось загрузить звуки";
    };

    builder.addCase(uploadSceneSoundsWeb.pending, pending);
    builder.addCase(uploadSceneSoundsWeb.fulfilled, fulfilled);
    builder.addCase(uploadSceneSoundsWeb.rejected, rejected);

    builder.addCase(pickSceneSoundsDesktop.pending, pending);
    builder.addCase(pickSceneSoundsDesktop.fulfilled, fulfilled);
    builder.addCase(pickSceneSoundsDesktop.rejected, rejected);
  },
});

export const sceneActions = sceneSlice.actions;
export const sceneReducer = sceneSlice.reducer;

