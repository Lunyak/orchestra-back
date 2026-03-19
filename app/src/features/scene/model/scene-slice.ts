import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ScriptStep, TheaterLayout } from "../../../shared/types/script";
import type { RootState } from "../../../shared/store/store";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { createId } from "../../../shared/utils/createId";
import { ensureProject, uploadProjectFile } from "../../../sync/api";
import type { PlaylistTrack } from "../../../shared/types/playlist";
import { flushDesktopOutbox } from "../../../sync/desktopOutbox";

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
  playlist?: PlaylistTrack[];
  sounds?: any[];
  theaterLayout?: TheaterLayout;
  /** Глобальное распределение: роль -> актёры (email/имя). Истина для назначений. */
  roleAssignments?: Record<string, string[]>;
  /**
   * Роли, привязанные к конкретным шагам сценария (сцена = шаг).
   * Хранится внутри sceneData, чтобы сохраняться в локальный project scene JSON.
   */
  sceneRoles?: SceneRolesDataV1;
  /** Записанные актёрские реплики (озвучка ролей), синхронизируются как часть сцены. */
  voiceLines?: SceneVoiceLines;
}

export type SceneRoleLinkV1 = {
  roleId: string;
  roleKey?: string;
  roleTitle?: string;
  /** Заметка по роли именно в этой сцене/шаге. */
  note?: string;
  createdAtIso?: string;
  updatedAtIso?: string;
};

export type SceneRolesDataV1 = {
  v: 1;
  /** stepId -> roleId -> link */
  byStepId: Record<string, Record<string, SceneRoleLinkV1 | undefined> | undefined>;
};

export type SceneVoiceLineTake = {
  id: string;
  performerId: string;
  performerLabel?: string | null;
  createdAt: string;
  mimeType?: string;
  durationMs?: number | null;
  remoteKey?: string;
  remoteUrl?: string;
};

export type SceneVoiceLineEntry = {
  lineId: string;
  role: string;
  roleKey: string;
  takesByPerformer: Record<string, SceneVoiceLineTake[]>;
  /** Выбранный "удачный дубль" для конкретного исполнителя */
  preferredTakeIdByPerformer?: Record<string, string | undefined>;
};

export type SceneVoiceLines = {
  version: 1;
  byLineId: Record<string, SceneVoiceLineEntry | undefined>;
};

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
  /** If true, stopping the sound resets playback position to the start. */
  restartOnStop?: boolean;
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
  /** Последний принятый снимок с сервера (для точного diff local vs server). */
  serverShadow: {
    sceneData: SceneData | null;
    steps: ScriptStep[];
    theaterLayout: TheaterLayout;
    lightChannels: string[];
  } | null;
  currentPage: number;
  isSceneReady: boolean;
  hasLocalEdits: boolean;
  /** There are remote updates, but we delayed pull because of local edits. */
  realtimePullDeferred: boolean;
  realtimePullDeferredAt: string | null;
  stepsRevision: number;
  sceneDataRevision: number;
  serverShadowRevision: number;
  soundsUpload: { uploading: boolean; error: string | null };
  playlistUpload: { uploading: boolean; error: string | null; uploadingIds: number[] };
  voiceLinesUpload: { uploading: boolean; error: string | null };
}

const initialState: SceneState = {
  sceneData: null,
  steps: [],
  theaterLayout: DEFAULT_THEATER_LAYOUT,
  serverShadow: null,
  currentPage: 0,
  isSceneReady: false,
  hasLocalEdits: false,
  realtimePullDeferred: false,
  realtimePullDeferredAt: null,
  stepsRevision: 0,
  sceneDataRevision: 0,
  serverShadowRevision: 0,
  soundsUpload: { uploading: false, error: null },
  playlistUpload: { uploading: false, error: null, uploadingIds: [] },
  voiceLinesUpload: { uploading: false, error: null },
};

function ensureNonEmptySteps(raw: ScriptStep[]): ScriptStep[] {
  if (raw.length > 0) return raw;
  return [{ id: 1, title: "Новый шаг", markdown: "" }];
}

function nextSoundIds(sounds: any[] | undefined, count: number): number[] {
  const maxId = (sounds ?? []).reduce((acc: number, s: any) => Math.max(acc, Number(s?.id ?? 0)), 0);
  return Array.from({ length: count }, (_v, i) => maxId + i + 1);
}

function nextPlaylistIds(playlist: PlaylistTrack[] | undefined, count: number): number[] {
  const list = Array.isArray(playlist) ? playlist : [];
  const maxId = list.reduce((acc, t) => Math.max(acc, Number(t?.id ?? 0)), 0);
  return Array.from({ length: count }, (_v, i) => maxId + i + 1);
}

function voiceExtFromMime(mime: string): string {
  const t = String(mime ?? "").toLowerCase();
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("wav")) return "wav";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("mp4")) return "m4a";
  return "webm";
}

export const uploadVoiceLineTakeWeb = createAsyncThunk<
  {
    projectSlug: string;
    lineId: string;
    role: string;
    roleKey: string;
    performerId: string;
    take: SceneVoiceLineTake;
  },
  {
    projectSlug: string;
    lineId: string;
    role: string;
    roleKey: string;
    performerId: string;
    performerLabel?: string | null;
    blob: Blob;
    durationMs?: number | null;
  }
>("scene/uploadVoiceLineTakeWeb", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) throw new Error("Нет токена авторизации");

  const projectSlug = args.projectSlug;
  const cachedId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;
  const projectId =
    cachedId ??
    (await ensureProject(token, projectSlug, `Проект ${projectSlug}`)).id;
  if (!cachedId) ensureProjectIdCached(projectSlug, projectId);

  const mimeType = String(args.blob?.type ?? "audio/webm");
  const ext = voiceExtFromMime(mimeType);
  const safeRole = String(args.roleKey || "role").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 50);
  const safePerformer = String(args.performerId || "actor")
    .replace(/[^a-z0-9@._-]+/gi, "_")
    .slice(0, 60);
  const safeLine = String(args.lineId || "line").replace(/[^a-z0-9:._-]+/gi, "_").slice(0, 80);
  const fileName = `voice_${projectSlug}_${safeRole}_${safePerformer}_${safeLine}_${Date.now()}.${ext}`;
  const file = new File([args.blob], fileName, { type: mimeType });

  const { key, url } = await uploadProjectFile(token, {
    projectId,
    type: "sound",
    file,
  });

  const take: SceneVoiceLineTake = {
    id: createId(),
    performerId: args.performerId,
    performerLabel: args.performerLabel ?? null,
    createdAt: new Date().toISOString(),
    mimeType,
    durationMs: args.durationMs ?? null,
    remoteKey: key,
    remoteUrl: url,
  };

  return {
    projectSlug,
    lineId: args.lineId,
    role: args.role,
    roleKey: args.roleKey,
    performerId: args.performerId,
    take,
  };
});

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

export const uploadScenePlaylistWeb = createAsyncThunk<
  { projectSlug: string; playlist: PlaylistTrack[] },
  { projectSlug: string; files: File[] }
>("scene/uploadScenePlaylistWeb", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("Нет токена авторизации");
  }
  const files = (args.files ?? []).filter(Boolean);
  if (files.length === 0) return { projectSlug: args.projectSlug, playlist: [] };

  const projectSlug = args.projectSlug;
  const cachedId =
    typeof window !== "undefined"
      ? localStorage.getItem(`projectId:${projectSlug}`)
      : null;
  const projectId =
    cachedId ?? (await ensureProject(token, projectSlug, `Проект ${projectSlug}`)).id;
  if (!cachedId) ensureProjectIdCached(projectSlug, projectId);

  const state = api.getState() as RootState;
  const current = (state.scene.sceneData?.playlist ?? []) as PlaylistTrack[];
  const ids = nextPlaylistIds(current, files.length);

  const uploaded: PlaylistTrack[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const { key, url } = await uploadProjectFile(token, {
      projectId,
      type: "playlist",
      file,
    });
    const title = file.name.replace(/\.[^.]+$/, "");
    uploaded.push({
      id: ids[i],
      title,
      file: file.name,
      fadeMs: 500,
      loop: false,
      remoteKey: key,
      remoteUrl: url,
    });
  }

  return { projectSlug, playlist: uploaded };
});

export const setSoundIcon = createAsyncThunk<
  { projectSlug: string; soundId: number; changes: Partial<SceneSound> },
  { projectSlug: string; soundId: number; file?: File }
>("scene/setSoundIcon", async (args, api) => {
  const projectSlug = args.projectSlug;
  const desktopApi = getDesktopApi();
  const token = getAccessToken(api.getState as () => RootState);

  const cachedId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;

  let projectId: string | null = cachedId;
  if (token && !projectId) {
    projectId = (await ensureProject(token, projectSlug, `Проект ${projectSlug}`)).id;
    ensureProjectIdCached(projectSlug, projectId);
  }

  // Web path: we get File directly from <input type="file" />
  if (args.file) {
    if (!token || !projectId) throw new Error("Нет токена авторизации");
    const { key, url } = await uploadProjectFile(token, {
      projectId,
      type: "image",
      file: args.file,
    });
    return {
      projectSlug,
      soundId: args.soundId,
      changes: { iconRemoteKey: key, iconRemoteUrl: url },
    };
  }

  // Desktop path: pick local file via Electron
  if (!desktopApi?.pickProjectSoundIcon) {
    throw new Error("Недоступен выбор иконки");
  }

  const res = await desktopApi.pickProjectSoundIcon(projectSlug, projectId || undefined);
  if (!res?.ok) {
    // canceled is not an error: no state change
    if (res?.canceled) {
      return { projectSlug, soundId: args.soundId, changes: {} };
    }
    throw new Error(res?.error ?? "Не удалось выбрать иконку");
  }

  const changes: Partial<SceneSound> = { icon: res.file };

  // Optional remote upload (only if logged in and desktop invoke exists)
  if (token && projectId && typeof desktopApi.invoke === "function") {
    try {
      const up = (await desktopApi.invoke("upload-project-sound-icon", {
        projectName: projectSlug,
        file: res.filePath || res.file,
        accessToken: token,
        projectId,
      })) as { ok?: boolean; key?: string; url?: string };

      if (up?.ok && up.key && up.url) {
        changes.iconRemoteKey = up.key;
        changes.iconRemoteUrl = up.url;
      }
    } catch (err) {
      console.error("[sounds] upload-project-sound-icon error:", err);
    }
  }

  return { projectSlug, soundId: args.soundId, changes };
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

async function persistScenePlaylistToDesktop(
  projectSlug: string,
  sceneName: string,
  playlist: PlaylistTrack[],
  getState: () => RootState,
) {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error("Desktop API недоступен");
  }

  const current = await desktopApi.readProjectScene(projectSlug, sceneName);
  const payload = { ...current, playlist };
  const result = await desktopApi.saveProjectScene(projectSlug, sceneName, payload);
  if (!result?.ok) {
    throw new Error(result?.error ?? "Не удалось сохранить плейлист");
  }

  const token = getAccessToken(getState);
  if (!token) return;

  let projectId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;
  if (!projectId) {
    const proj = await ensureProject(token, projectSlug, `Проект ${projectSlug}`);
    projectId = proj.id;
    ensureProjectIdCached(projectSlug, projectId);
  }

  // Desktop: enqueue delta on saveProjectScene, then flush outbox
  await flushDesktopOutbox(token, projectSlug);
}

export const pickScenePlaylistTracksDesktop = createAsyncThunk<
  { projectSlug: string; sceneName: string; playlist: PlaylistTrack[] },
  { projectSlug: string; sceneName: string }
>("scene/pickScenePlaylistTracksDesktop", async (args, api) => {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error("Desktop API недоступен");
  }

  const res = await desktopApi.pickProjectAudio(args.projectSlug);
  if (!res?.ok) {
    if (res?.canceled) {
      const state = api.getState() as RootState;
      const current = (state.scene.sceneData?.playlist ?? []) as PlaylistTrack[];
      return { projectSlug: args.projectSlug, sceneName: args.sceneName, playlist: current };
    }
    throw new Error(res?.error ?? "Не удалось выбрать аудио");
  }

  const tracks = Array.isArray(res.tracks) ? res.tracks : [];
  if (tracks.length === 0) {
    const state = api.getState() as RootState;
    const current = (state.scene.sceneData?.playlist ?? []) as PlaylistTrack[];
    return { projectSlug: args.projectSlug, sceneName: args.sceneName, playlist: current };
  }

  const state = api.getState() as RootState;
  const current = (state.scene.sceneData?.playlist ?? []) as PlaylistTrack[];
  const ids = nextPlaylistIds(current, tracks.length);

  const base: PlaylistTrack[] = tracks.map(
    (t: { title?: string; file?: string }, i: number) => ({
      id: ids[i],
      title: String(t.title ?? "").trim() || String(t.file ?? "Track"),
      file: String(t.file ?? ""),
      fadeMs: 500,
      loop: false,
    }),
  );

  // Optional remote upload (only if logged in and desktop invoke exists)
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

  const uploaded: PlaylistTrack[] = [];
  for (const t of base) {
    if (token && projectId && typeof desktopApi.invoke === "function") {
      try {
        const up = (await desktopApi.invoke("upload-project-audio", {
          projectName: args.projectSlug,
          file: t.file,
          accessToken: token,
          projectId,
        })) as { ok?: boolean; key?: string; url?: string; error?: string };
        if (up?.ok && up.key && up.url) {
          uploaded.push({ ...t, remoteKey: up.key, remoteUrl: up.url });
        } else {
          if (up?.error) console.error("[playlist] upload-project-audio failed:", up.error);
          uploaded.push(t);
        }
      } catch (err) {
        console.error("[playlist] upload-project-audio error:", err);
        uploaded.push(t);
      }
    } else {
      uploaded.push(t);
    }
  }

  const next = [...current, ...uploaded];
  await persistScenePlaylistToDesktop(args.projectSlug, args.sceneName, next, api.getState as () => RootState);
  return { projectSlug: args.projectSlug, sceneName: args.sceneName, playlist: next };
});

export const addScenePlaylistTracksFromPathsDesktop = createAsyncThunk<
  { projectSlug: string; sceneName: string; playlist: PlaylistTrack[] },
  { projectSlug: string; sceneName: string; filePaths: string[] }
>("scene/addScenePlaylistTracksFromPathsDesktop", async (args, api) => {
  const desktopApi = getDesktopApi();
  if (!desktopApi) throw new Error("Desktop API недоступен");

  const res = await desktopApi.addProjectAudio(args.projectSlug, args.filePaths);
  if (!res?.ok) {
    throw new Error(res?.error ?? "Не удалось добавить аудио");
  }
  const tracks = Array.isArray(res.tracks) ? res.tracks : [];
  if (tracks.length === 0) {
    const state = api.getState() as RootState;
    const current = (state.scene.sceneData?.playlist ?? []) as PlaylistTrack[];
    return { projectSlug: args.projectSlug, sceneName: args.sceneName, playlist: current };
  }

  const state = api.getState() as RootState;
  const current = (state.scene.sceneData?.playlist ?? []) as PlaylistTrack[];
  const ids = nextPlaylistIds(current, tracks.length);

  const base: PlaylistTrack[] = tracks.map(
    (t: { title?: string; file?: string }, i: number) => ({
      id: ids[i],
      title: String(t.title ?? "").trim() || String(t.file ?? "Track"),
      file: String(t.file ?? ""),
      fadeMs: 500,
      loop: false,
    }),
  );

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

  const uploaded: PlaylistTrack[] = [];
  for (const t of base) {
    if (token && projectId && typeof desktopApi.invoke === "function") {
      try {
        const up = (await desktopApi.invoke("upload-project-audio", {
          projectName: args.projectSlug,
          file: t.file,
          accessToken: token,
          projectId,
        })) as { ok?: boolean; key?: string; url?: string; error?: string };
        if (up?.ok && up.key && up.url) uploaded.push({ ...t, remoteKey: up.key, remoteUrl: up.url });
        else uploaded.push(t);
      } catch (err) {
        console.error("[playlist] upload-project-audio error:", err);
        uploaded.push(t);
      }
    } else {
      uploaded.push(t);
    }
  }

  const next = [...current, ...uploaded];
  await persistScenePlaylistToDesktop(args.projectSlug, args.sceneName, next, api.getState as () => RootState);
  return { projectSlug: args.projectSlug, sceneName: args.sceneName, playlist: next };
});

export const persistScenePlaylistDesktop = createAsyncThunk<
  { projectSlug: string; sceneName: string; playlist: PlaylistTrack[] },
  { projectSlug: string; sceneName: string }
>("scene/persistScenePlaylistDesktop", async (args, api) => {
  const state = api.getState() as RootState;
  const current = (state.scene.sceneData?.playlist ?? []) as PlaylistTrack[];
  await persistScenePlaylistToDesktop(args.projectSlug, args.sceneName, current, api.getState as () => RootState);
  return { projectSlug: args.projectSlug, sceneName: args.sceneName, playlist: current };
});

export const deleteScenePlaylistTrackDesktop = createAsyncThunk<
  { projectSlug: string; sceneName: string; removedId: number },
  { projectSlug: string; sceneName: string; id: number; file: string }
>("scene/deleteScenePlaylistTrackDesktop", async (args, api) => {
  const desktopApi = getDesktopApi();
  if (!desktopApi) throw new Error("Desktop API недоступен");

  try {
    const res = await desktopApi.deleteProjectAudio(args.projectSlug, args.file);
    if (!res?.ok) {
      console.error("[playlist] deleteProjectAudio failed:", res?.error);
    }
  } catch (err) {
    console.error("[playlist] deleteProjectAudio error:", err);
  }

  const state = api.getState() as RootState;
  const prev = (state.scene.sceneData?.playlist ?? []) as PlaylistTrack[];
  const next = prev.filter((t) => Number(t.id) !== Number(args.id));
  await persistScenePlaylistToDesktop(args.projectSlug, args.sceneName, next, api.getState as () => RootState);
  return { projectSlug: args.projectSlug, sceneName: args.sceneName, removedId: args.id };
});

export const sceneSlice = createSlice({
  name: "scene",
  initialState,
  reducers: {
    resetForProject(state) {
      state.sceneData = null;
      state.steps = [];
      state.theaterLayout = DEFAULT_THEATER_LAYOUT;
      state.serverShadow = null;
      state.currentPage = 0;
      state.isSceneReady = false;
      state.hasLocalEdits = false;
      state.stepsRevision += 1;
      state.sceneDataRevision += 1;
      state.serverShadowRevision += 1;
    },
    hydrateScene(
      state,
      action: PayloadAction<{
        sceneData: SceneData | null;
        steps: ScriptStep[];
        theaterLayout: TheaterLayout;
        currentPage?: number;
        isSceneReady: boolean;
        serverShadow?: {
          sceneData: SceneData | null;
          steps: ScriptStep[];
          theaterLayout: TheaterLayout;
          lightChannels: string[];
        } | null;
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
      if (Object.prototype.hasOwnProperty.call(action.payload, "serverShadow")) {
        state.serverShadow = action.payload.serverShadow ?? null;
        state.serverShadowRevision += 1;
      }
    },
    setSceneReady(state, action: PayloadAction<boolean>) {
      state.isSceneReady = action.payload;
    },
    setServerShadow(
      state,
      action: PayloadAction<{
        sceneData: SceneData | null;
        steps: ScriptStep[];
        theaterLayout: TheaterLayout;
        lightChannels: string[];
      } | null>,
    ) {
      state.serverShadow = action.payload;
      state.serverShadowRevision += 1;
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
    setPreferredVoiceLineTake(
      state,
      action: PayloadAction<{ lineId: string; performerId: string; takeId: string }>,
    ) {
      const { lineId, performerId, takeId } = action.payload;
      const prev = state.sceneData?.voiceLines;
      if (!prev?.byLineId) return;
      const entry = prev.byLineId[lineId];
      if (!entry) return;
      const nextPreferred = {
        ...(entry.preferredTakeIdByPerformer ?? {}),
        [performerId]: takeId,
      };
      const nextEntry: SceneVoiceLineEntry = { ...entry, preferredTakeIdByPerformer: nextPreferred };
      state.sceneData = {
        ...(state.sceneData ?? {}),
        voiceLines: {
          version: 1,
          byLineId: {
            ...prev.byLineId,
            [lineId]: nextEntry,
          },
        },
      };
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
      // Добавляем новый шаг всегда в конец списка (а не после текущего).
      const insertIndex = state.steps.length;
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
    setRealtimePullDeferred(state, action: PayloadAction<{ deferred: boolean; at?: string | null }>) {
      state.realtimePullDeferred = Boolean(action.payload?.deferred);
      state.realtimePullDeferredAt = action.payload?.at ?? (state.realtimePullDeferred ? new Date().toISOString() : null);
    },
    clearRealtimePullDeferred(state) {
      state.realtimePullDeferred = false;
      state.realtimePullDeferredAt = null;
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
    setPlaylist(state, action: PayloadAction<PlaylistTrack[]>) {
      state.sceneData = { ...(state.sceneData ?? {}), playlist: action.payload ?? [] };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    updatePlaylistTrack(
      state,
      action: PayloadAction<{ id: number; changes: Partial<PlaylistTrack> }>,
    ) {
      const list = Array.isArray(state.sceneData?.playlist) ? state.sceneData!.playlist! : [];
      const idx = list.findIndex((t) => Number(t?.id) === Number(action.payload.id));
      if (idx === -1) return;
      const next = [...list];
      next[idx] = { ...next[idx], ...action.payload.changes };
      state.sceneData = { ...(state.sceneData ?? {}), playlist: next };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    reorderPlaylist(
      state,
      action: PayloadAction<{ fromIndex: number; toIndex: number }>,
    ) {
      const list = Array.isArray(state.sceneData?.playlist) ? state.sceneData!.playlist! : [];
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= list.length || toIndex >= list.length) return;
      const next = [...list];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      state.sceneData = { ...(state.sceneData ?? {}), playlist: next };
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

    builder.addCase(uploadScenePlaylistWeb.pending, (state) => {
      state.playlistUpload.uploading = true;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(uploadScenePlaylistWeb.rejected, (state, action: any) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = String(action?.error?.message ?? "Не удалось загрузить треки");
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(uploadScenePlaylistWeb.fulfilled, (state, action) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
      const next = action.payload?.playlist ?? [];
      if (next.length === 0) return;
      const prev = Array.isArray(state.sceneData?.playlist) ? state.sceneData!.playlist! : [];
      state.sceneData = { ...(state.sceneData ?? {}), playlist: [...prev, ...next] };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    });

    builder.addCase(setSoundIcon.fulfilled, (state, action) => {
      const { soundId, changes } = action.payload;
      if (!changes || Object.keys(changes).length === 0) return;
      const listRaw = (state.sceneData as any)?.sounds;
      const list = Array.isArray(listRaw) ? listRaw : [];
      const idx = list.findIndex((s: any) => Number(s?.id) === soundId);
      if (idx === -1) return;
      const next = [...list];
      next[idx] = { ...next[idx], ...changes };
      state.sceneData = { ...(state.sceneData ?? {}), sounds: next };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    });

    builder.addCase(pickScenePlaylistTracksDesktop.pending, (state) => {
      state.playlistUpload.uploading = true;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(pickScenePlaylistTracksDesktop.rejected, (state, action: any) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = String(action?.error?.message ?? "Не удалось добавить треки");
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(pickScenePlaylistTracksDesktop.fulfilled, (state, action) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
      state.sceneData = { ...(state.sceneData ?? {}), playlist: action.payload.playlist ?? [] };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    });

    builder.addCase(addScenePlaylistTracksFromPathsDesktop.pending, (state) => {
      state.playlistUpload.uploading = true;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(addScenePlaylistTracksFromPathsDesktop.rejected, (state, action: any) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = String(action?.error?.message ?? "Не удалось добавить треки");
      state.playlistUpload.uploadingIds = [];
    });
    builder.addCase(addScenePlaylistTracksFromPathsDesktop.fulfilled, (state, action) => {
      state.playlistUpload.uploading = false;
      state.playlistUpload.error = null;
      state.playlistUpload.uploadingIds = [];
      state.sceneData = { ...(state.sceneData ?? {}), playlist: action.payload.playlist ?? [] };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    });

    builder.addCase(persistScenePlaylistDesktop.pending, (state) => {
      // do not block UI, but expose error if needed
      state.playlistUpload.error = null;
    });
    builder.addCase(persistScenePlaylistDesktop.rejected, (state, action: any) => {
      state.playlistUpload.error = String(action?.error?.message ?? "Не удалось сохранить плейлист");
    });

    builder.addCase(deleteScenePlaylistTrackDesktop.pending, (state) => {
      state.playlistUpload.error = null;
    });
    builder.addCase(deleteScenePlaylistTrackDesktop.rejected, (state, action: any) => {
      state.playlistUpload.error = String(action?.error?.message ?? "Не удалось удалить трек");
    });
    builder.addCase(deleteScenePlaylistTrackDesktop.fulfilled, (state, action) => {
      const list = Array.isArray(state.sceneData?.playlist) ? state.sceneData!.playlist! : [];
      const next = list.filter((t) => Number(t.id) !== Number(action.payload.removedId));
      state.sceneData = { ...(state.sceneData ?? {}), playlist: next };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    });

    builder.addCase(uploadVoiceLineTakeWeb.pending, (state) => {
      state.voiceLinesUpload = { uploading: true, error: null };
    });
    builder.addCase(uploadVoiceLineTakeWeb.rejected, (state, action: any) => {
      state.voiceLinesUpload = {
        uploading: false,
        error: String(action?.error?.message ?? "Не удалось загрузить дубль"),
      };
    });
    builder.addCase(uploadVoiceLineTakeWeb.fulfilled, (state, action) => {
      state.voiceLinesUpload = { uploading: false, error: null };
      const { lineId, role, roleKey, performerId, take } = action.payload;

      const prev = state.sceneData?.voiceLines;
      const byLineId = prev?.byLineId ?? {};
      const existing = byLineId[lineId];

      const prevTakesByPerformer = existing?.takesByPerformer ?? {};
      const nextList = [...(prevTakesByPerformer[performerId] ?? []), take];
      const nextTakesByPerformer = {
        ...prevTakesByPerformer,
        [performerId]: nextList,
      };

      const nextPreferred = {
        ...(existing?.preferredTakeIdByPerformer ?? {}),
        [performerId]: take.id,
      };

      const nextEntry: SceneVoiceLineEntry = {
        lineId,
        role: existing?.role ?? role,
        roleKey: existing?.roleKey ?? roleKey,
        takesByPerformer: nextTakesByPerformer,
        preferredTakeIdByPerformer: nextPreferred,
      };

      state.sceneData = {
        ...(state.sceneData ?? {}),
        voiceLines: {
          version: 1,
          byLineId: {
            ...byLineId,
            [lineId]: nextEntry,
          },
        },
      };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    });
  },
});

export const sceneActions = sceneSlice.actions;
export const sceneReducer = sceneSlice.reducer;

