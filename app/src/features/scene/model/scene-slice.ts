import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ScriptStep, TheaterLayout } from "../../../shared/types/script";
import type { RootState } from "../../../shared/store/store";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  desktopAddProjectAudio,
  desktopDeleteProjectAudio,
  desktopPickProjectAudio,
  desktopPickProjectSound,
  desktopPickProjectSoundIcon,
  desktopReadProjectScene,
  desktopSaveProjectScene,
} from "../../../shared/platform/desktop-methods";
import { createId } from "../../../shared/utils/createId";
import { stepHasMaterial } from "./scenario-material";
import { uploadProjectFile } from "../../../sync/api/files";
import { ensureProject } from "../../../sync/api/projects";
import type { PlaylistTrack } from "../../../shared/types/playlist";
import { flushDesktopOutbox } from "../../../sync/desktopOutbox";
import { saveDesktopProjectMediaFromFile } from "../../../shared/platform/desktop-project-media";

import { DEFAULT_THEATER_LAYOUT } from "../../theater/model/theater-defaults";
import { normalizePersistedTheaterLayout } from "../../theater/model/theater-metrics";
import { normalizeHoldImages } from "../../projector/model/scene-projector-persist";

type ProjectorMediaWithPath = {
  id?: number;
  file?: string;
  filePath?: string;
  remoteKey?: string;
};

function mergeProjectorMediaWithLocalPaths<T extends ProjectorMediaWithPath>(
  incoming: T[],
  prev: T[],
): T[] {
  if (incoming.length === 0) return prev;
  if (prev.length === 0) return incoming;
  const prevById = new Map(
    prev.filter((item) => item.id != null).map((item) => [Number(item.id), item]),
  );
  const prevByKey = new Map(
    prev
      .filter((item) => String(item.remoteKey ?? "").trim())
      .map((item) => [String(item.remoteKey), item]),
  );
  const prevByFile = new Map(
    prev
      .filter((item) => String(item.file ?? "").trim())
      .map((item) => [String(item.file), item]),
  );

  return incoming.map((item) => {
    if (String(item.filePath ?? "").trim()) return item;
    const prevItem =
      (item.id != null ? prevById.get(Number(item.id)) : undefined) ??
      (String(item.remoteKey ?? "").trim()
        ? prevByKey.get(String(item.remoteKey))
        : undefined) ??
      (String(item.file ?? "").trim() ? prevByFile.get(String(item.file)) : undefined);
    if (!prevItem?.filePath) return item;
    return { ...item, filePath: prevItem.filePath };
  });
}

function mergeProjectorSceneDataOnHydrate(
  incoming: SceneData | null,
  prev: SceneData | null,
): SceneData | null {
  if (!incoming) return incoming;
  if (!prev) return incoming;
  const incomingHolds = normalizeHoldImages(incoming.holdImages, incoming.projector);
  const prevHolds = normalizeHoldImages(prev.holdImages, prev.projector);
  const incomingVideos = Array.isArray(incoming.videos) ? incoming.videos : [];
  const prevVideos = Array.isArray(prev.videos) ? prev.videos : [];
  return {
    ...incoming,
    videos:
      incomingVideos.length > 0
        ? mergeProjectorMediaWithLocalPaths(incomingVideos, prevVideos)
        : prev.videos,
    holdImages:
      incomingHolds.length > 0
        ? mergeProjectorMediaWithLocalPaths(incomingHolds, prevHolds)
        : prev.holdImages,
    projector: incoming.projector ?? prev.projector,
  };
}

export type TheaterLayoutUpdater =
  | TheaterLayout
  | ((prev: TheaterLayout) => TheaterLayout);

export { DEFAULT_THEATER_LAYOUT };

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
  /** Настройка пульта света: ползунки и их привязки к каналам. */
  lightFaders?: SceneLightFadersDataV1;
  /** Сохранённые программы света: паттерны состояний ползунков. */
  lightPrograms?: SceneLightProgramsDataV1;
  /** Роли каналов: какие каналы — софиты (остальные — заливки/RGB). */
  lightChannelRoles?: SceneLightChannelRolesV1;
  /** Записанные актёрские реплики (озвучка ролей), синхронизируются как часть сцены. */
  voiceLines?: SceneVoiceLines;
  /** Изображения сцены (ключ → метаданные файла). */
  images?: Record<string, { remoteKey?: string; remoteUrl?: string }>;
  /** Видео для проектора (ролики спектакля). */
  videos?: SceneVideo[];
  /** Заставки проектора (картинки между роликами). */
  holdImages?: SceneHoldImage[];
  /** Заставка проектора и прочие настройки вывода. */
  projector?: SceneProjectorSettingsV1;
  /** Глобальные каналы K1…Kn (подписи и цвета пульта). */
  lightChannels?: string[];
}

export type SceneLightFaderLinkV1 = {
  channel: number;
  spotlightId?: number;
};

export type SceneLightFaderV1 = {
  id: number;
  label: string;
  channel?: number;
  spotlightId?: number;
  intensity?: number;
  enabled?: boolean;
  color?: string;
  links: SceneLightFaderLinkV1[];
};

export type SceneLightFadersDataV1 = {
  v: 1;
  count?: number;
  faders: SceneLightFaderV1[];
};

export type SceneLightProgramFaderStateV1 = {
  faderId: number;
  intensity?: number;
  enabled?: boolean;
  color?: string;
};

export type SceneLightProgramV1 = {
  id: number;
  label: string;
  faders: SceneLightProgramFaderStateV1[];
};

export type SceneLightProgramsDataV1 = {
  v: 1;
  /** Явное число кнопок П на пульте (как faders.count). */
  count?: number;
  activeProgramId?: number;
  programs: SceneLightProgramV1[];
};

/** Какие каналы пульта считаются «софитными» в схеме (условное деление). */
export type SceneLightChannelRolesV1 = {
  v: 1;
  sofitChannels: number[];
};

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

export interface SceneVideo {
  id: number;
  title: string;
  file: string;
  remoteUrl?: string;
  remoteKey?: string;
  filePath?: string;
}

export interface SceneHoldImage {
  id: number;
  title: string;
  file: string;
  remoteUrl?: string;
  remoteKey?: string;
  filePath?: string;
}

export type SceneProjectorSettingsV1 = {
  v: 1;
  /** id заставки по умолчанию (после конца видео). */
  defaultHoldId?: number;
  /** @deprecated Мигрируется в holdImages при загрузке сцены. */
  holdImageFile?: string;
  holdImageRemoteKey?: string;
  holdImageRemoteUrl?: string;
  holdImageFilePath?: string;
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
  /** Почему отложено авто‑подтягивание (для текста баннера). */
  realtimePullDeferredReason:
    | "local_edits"
    | "settings_pause"
    | "confirm_declined"
    | "remote_pending"
    | null;
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
  realtimePullDeferredReason: null,
  stepsRevision: 0,
  sceneDataRevision: 0,
  serverShadowRevision: 0,
  soundsUpload: { uploading: false, error: null },
  playlistUpload: { uploading: false, error: null, uploadingIds: [] },
  voiceLinesUpload: { uploading: false, error: null },
};

function normalizeHydratedSteps(raw: ScriptStep[]): ScriptStep[] {
  return Array.isArray(raw) ? raw : [];
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

function nextVideoIds(videos: SceneVideo[] | undefined, count: number): number[] {
  const list = Array.isArray(videos) ? videos : [];
  const maxId = list.reduce((acc, v) => Math.max(acc, Number(v?.id ?? 0)), 0);
  return Array.from({ length: count }, (_v, i) => maxId + i + 1);
}

function nextHoldImageIds(holdImages: SceneHoldImage[] | undefined, count: number): number[] {
  const list = Array.isArray(holdImages) ? holdImages : [];
  const maxId = list.reduce((acc, h) => Math.max(acc, Number(h?.id ?? 0)), 0);
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

export const uploadSceneVideosWeb = createAsyncThunk<
  { projectSlug: string; videos: SceneVideo[] },
  { projectSlug: string; files: File[] }
>("scene/uploadSceneVideosWeb", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("Нет токена авторизации");
  }
  const files = (args.files ?? []).filter(Boolean);
  if (files.length === 0) return { projectSlug: args.projectSlug, videos: [] };

  const projectSlug = args.projectSlug;
  const cachedId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;
  const projectId =
    cachedId ??
    (await ensureProject(token, projectSlug, `Проект ${projectSlug}`)).id;
  if (!cachedId) ensureProjectIdCached(projectSlug, projectId);

  const state = api.getState() as RootState;
  const ids = nextVideoIds(state.scene.sceneData?.videos, files.length);

  const uploaded: SceneVideo[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const local = await saveDesktopProjectMediaFromFile(projectSlug, "video", file);
    const { key, url } = await uploadProjectFile(token, {
      projectId,
      type: "video",
      file,
    });
    const title = file.name.replace(/\.[^.]+$/, "");
    uploaded.push({
      id: ids[i],
      title,
      file: local?.file ?? file.name,
      filePath: local?.filePath,
      remoteKey: key,
      remoteUrl: url,
    });
  }

  return { projectSlug, videos: uploaded };
});

export const uploadSceneHoldImagesWeb = createAsyncThunk<
  { projectSlug: string; holdImages: SceneHoldImage[] },
  { projectSlug: string; files: File[] }
>("scene/uploadSceneHoldImagesWeb", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("Нет токена авторизации");
  }
  const files = (args.files ?? []).filter(Boolean);
  if (files.length === 0) return { projectSlug: args.projectSlug, holdImages: [] };

  const projectSlug = args.projectSlug;
  const cachedId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;
  const projectId =
    cachedId ??
    (await ensureProject(token, projectSlug, `Проект ${projectSlug}`)).id;
  if (!cachedId) ensureProjectIdCached(projectSlug, projectId);

  const state = api.getState() as RootState;
  const ids = nextHoldImageIds(state.scene.sceneData?.holdImages, files.length);

  const uploaded: SceneHoldImage[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const local = await saveDesktopProjectMediaFromFile(projectSlug, "image", file);
    const { key, url } = await uploadProjectFile(token, {
      projectId,
      type: "image",
      file,
    });
    const title = file.name.replace(/\.[^.]+$/, "");
    uploaded.push({
      id: ids[i],
      title,
      file: local?.file ?? file.name,
      filePath: local?.filePath,
      remoteKey: key,
      remoteUrl: url,
    });
  }

  return { projectSlug, holdImages: uploaded };
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

  const res = await desktopPickProjectSoundIcon(desktopApi, projectSlug, projectId || undefined);
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
  const res = await desktopPickProjectSound(desktopApi, args.projectSlug);
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

  const current = await desktopReadProjectScene(desktopApi, projectSlug, sceneName);
  const payload = { ...(current && typeof current === "object" ? current : {}), playlist };
  const result = await desktopSaveProjectScene(desktopApi, projectSlug, sceneName, payload);
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

  const res = await desktopPickProjectAudio(desktopApi, args.projectSlug);
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

  const res = await desktopAddProjectAudio(desktopApi, args.projectSlug, args.filePaths);
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
    const res = await desktopDeleteProjectAudio(desktopApi, args.projectSlug, args.file);
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
        /** Если не передан — сохраняем страницу по id выбранного шага (пул с сервера / регидрация). */
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
      const prevSteps = state.steps;
      const prevPage = state.currentPage;
      const prevSelectedId = prevSteps[prevPage]?.id ?? null;

      state.sceneData = mergeProjectorSceneDataOnHydrate(
        action.payload.sceneData,
        state.sceneData,
      );
      const nextSteps = normalizeHydratedSteps(action.payload.steps);
      state.steps = nextSteps;
      state.theaterLayout = action.payload.theaterLayout;

      const payloadPage = action.payload.currentPage;
      const safeMax = Math.max(0, nextSteps.length - 1);
      if (payloadPage !== undefined) {
        state.currentPage = payloadPage;
      } else if (prevSelectedId != null) {
        const idx = nextSteps.findIndex((s) => s.id === prevSelectedId);
        state.currentPage = idx !== -1 ? idx : Math.min(prevPage, safeMax);
      } else {
        state.currentPage = Math.min(prevPage, safeMax);
      }

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
      state.steps = normalizeHydratedSteps(action.payload);
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
    setTheaterLayout(state, action: PayloadAction<TheaterLayoutUpdater>) {
      const resolved =
        typeof action.payload === "function"
          ? action.payload(state.theaterLayout)
          : action.payload;
      state.theaterLayout = normalizePersistedTheaterLayout(resolved);
      state.hasLocalEdits = true;
    },
    setCurrentPage(state, action: PayloadAction<number>) {
      state.currentPage = action.payload;
    },
    seedScenarioFromPlayText(state, action: PayloadAction<{ text: string }>) {
      const text = String(action.payload.text ?? "").trim();
      if (!text) return;
      state.hasLocalEdits = true;

      const titleFromText = "Пьеса";

      if (state.steps.length === 0) {
        state.steps = [
          {
            id: 1,
            title: titleFromText,
            markdown: "",
            playMarkdown: text,
          },
        ];
        state.currentPage = 0;
        state.stepsRevision += 1;
        return;
      }

      const emptyIndex = state.steps.findIndex((step) => !stepHasMaterial(step));
      if (emptyIndex !== -1) {
        const step = state.steps[emptyIndex];
        const keepTitle =
          step.title?.trim() && step.title.trim() !== "Новый шаг"
            ? step.title.trim()
            : titleFromText;
        state.steps[emptyIndex] = {
          ...step,
          title: keepTitle,
          playMarkdown: text,
        };
        state.currentPage = emptyIndex;
        state.stepsRevision += 1;
        return;
      }

      const nextId = state.steps.reduce((acc, step) => Math.max(acc, step.id), 0) + 1;
      state.steps.unshift({
        id: nextId,
        title: titleFromText,
        markdown: "",
        playMarkdown: text,
      });
      state.currentPage = 0;
      state.stepsRevision += 1;
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
    splitStepFromSelection(
      state,
      action: PayloadAction<{
        sourceStepId: number;
        targetField: "markdown" | "playMarkdown" | "explicationMarkdown";
        selectedText: string;
        trimmedSourceText: string;
      }>,
    ) {
      const { sourceStepId, targetField, selectedText, trimmedSourceText } = action.payload;
      const sourceIdx = state.steps.findIndex((s) => s.id === sourceStepId);
      if (sourceIdx === -1) return;

      const sourceStep = state.steps[sourceIdx];
      state.steps[sourceIdx] = { ...sourceStep, [targetField]: trimmedSourceText };

      const nextId = state.steps.reduce((acc, step) => Math.max(acc, step.id), 0) + 1;
      const nextRequisites = sourceStep.requisites
        ? sourceStep.requisites.map((item) => ({ ...item, checked: false }))
        : [];
      const nextItem: ScriptStep = {
        id: nextId,
        title: `Шаг ${nextId}`,
        markdown: "",
        requisites: nextRequisites,
      };
      if (targetField === "markdown") {
        nextItem.markdown = selectedText;
      } else if (targetField === "playMarkdown") {
        nextItem.playMarkdown = selectedText;
      } else {
        nextItem.explicationMarkdown = selectedText;
      }

      state.steps.push(nextItem);
      state.currentPage = state.steps.length - 1;
      state.hasLocalEdits = true;
      state.stepsRevision += 1;
    },
    splitStepContentIntoSteps(
      state,
      action: PayloadAction<{
        sourceStepId: number;
        targetField: "markdown" | "playMarkdown" | "explicationMarkdown";
        chunks: string[];
        chunkTitles?: string[];
      }>,
    ) {
      const { sourceStepId, targetField, chunks, chunkTitles } = action.payload;
      const trimmedChunks = chunks.map((c) => String(c ?? "").trim()).filter(Boolean);
      if (!trimmedChunks.length) return;

      const sourceIdx = state.steps.findIndex((s) => s.id === sourceStepId);
      if (sourceIdx === -1) return;

      const sourceStep = state.steps[sourceIdx];
      let maxId = state.steps.reduce((acc, step) => Math.max(acc, step.id), 0);

      const makeStep = (chunk: string, title: string): ScriptStep => {
        maxId += 1;
        const nextRequisites = sourceStep.requisites
          ? sourceStep.requisites.map((item) => ({ ...item, checked: false }))
          : [];
        const nextItem: ScriptStep = {
          id: maxId,
          title,
          markdown: "",
          requisites: nextRequisites,
        };
        nextItem[targetField] = chunk;
        return nextItem;
      };

      const [firstChunk, ...restChunks] = trimmedChunks;
      const firstTitle =
        chunkTitles?.[0]?.trim() ||
        sourceStep.title ||
        `Шаг ${sourceStep.id}`;
      state.steps[sourceIdx] = {
        ...sourceStep,
        title: firstTitle,
        [targetField]: firstChunk,
      };

      let insertAt = sourceIdx + 1;
      restChunks.forEach((chunk, index) => {
        const title =
          chunkTitles?.[index + 1]?.trim() || `Шаг ${maxId + 1}`;
        state.steps.splice(insertAt, 0, makeStep(chunk, title));
        insertAt += 1;
      });

      state.currentPage = sourceIdx;
      state.hasLocalEdits = true;
      state.stepsRevision += 1;
    },
    deleteStep(state, action: PayloadAction<number>) {
      state.hasLocalEdits = true;
      const id = action.payload;
      const next = state.steps.filter((s) => s.id !== id);
      state.steps = next;
      state.currentPage = next.length === 0 ? 0 : Math.min(state.currentPage, next.length - 1);
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
    setRealtimePullDeferred(
      state,
      action: PayloadAction<{
        deferred: boolean;
        at?: string | null;
        reason?: SceneState["realtimePullDeferredReason"];
      }>,
    ) {
      const deferred = Boolean(action.payload?.deferred);
      state.realtimePullDeferred = deferred;
      state.realtimePullDeferredAt =
        action.payload?.at ?? (deferred ? new Date().toISOString() : null);
      if (!deferred) {
        state.realtimePullDeferredReason = null;
      } else {
        state.realtimePullDeferredReason =
          action.payload?.reason ?? "remote_pending";
      }
    },
    clearRealtimePullDeferred(state) {
      state.realtimePullDeferred = false;
      state.realtimePullDeferredAt = null;
      state.realtimePullDeferredReason = null;
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
    addVideos(state, action: PayloadAction<SceneVideo[]>) {
      const next = action.payload ?? [];
      if (next.length === 0) return;
      const prev = Array.isArray(state.sceneData?.videos) ? state.sceneData!.videos! : [];
      state.sceneData = { ...(state.sceneData ?? {}), videos: [...prev, ...next] };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    updateSceneVideo(
      state,
      action: PayloadAction<{ id: number; changes: Partial<SceneVideo> }>,
    ) {
      const list = Array.isArray(state.sceneData?.videos) ? state.sceneData!.videos! : [];
      const idx = list.findIndex((v) => Number(v?.id) === Number(action.payload.id));
      if (idx === -1) return;
      const next = [...list];
      next[idx] = { ...next[idx], ...action.payload.changes };
      state.sceneData = { ...(state.sceneData ?? {}), videos: next };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    updateSceneHoldImage(
      state,
      action: PayloadAction<{ id: number; changes: Partial<SceneHoldImage> }>,
    ) {
      const list = Array.isArray(state.sceneData?.holdImages) ? state.sceneData!.holdImages! : [];
      const idx = list.findIndex((h) => Number(h?.id) === Number(action.payload.id));
      if (idx === -1) return;
      const next = [...list];
      next[idx] = { ...next[idx], ...action.payload.changes };
      state.sceneData = { ...(state.sceneData ?? {}), holdImages: next };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    setProjectorMediaLibrary(
      state,
      action: PayloadAction<{ videos: SceneVideo[]; holdImages: SceneHoldImage[] }>,
    ) {
      state.sceneData = {
        ...(state.sceneData ?? {}),
        videos: action.payload.videos,
        holdImages: action.payload.holdImages,
      };
      state.sceneDataRevision += 1;
    },
    removeSceneVideo(state, action: PayloadAction<number>) {
      const id = Number(action.payload);
      const prev = Array.isArray(state.sceneData?.videos) ? state.sceneData!.videos! : [];
      const next = prev.filter((v) => Number(v?.id) !== id);
      if (next.length === prev.length) return;
      state.sceneData = { ...(state.sceneData ?? {}), videos: next };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    removeSceneHoldImage(state, action: PayloadAction<number>) {
      const id = Number(action.payload);
      const prev = Array.isArray(state.sceneData?.holdImages) ? state.sceneData!.holdImages! : [];
      const removed = prev.find((h) => Number(h?.id) === id);
      const next = prev.filter((h) => Number(h?.id) !== id);
      if (next.length === prev.length) return;

      const prevProjector = state.sceneData?.projector;
      let projector: SceneProjectorSettingsV1 | undefined = prevProjector
        ? { ...prevProjector }
        : undefined;

      if (projector) {
        const defaultId = Number(projector.defaultHoldId);
        if (defaultId === id || !next.some((h) => Number(h.id) === defaultId)) {
          projector.defaultHoldId = next[0]?.id;
        }
        const removedKey = String(removed?.remoteKey ?? "").trim();
        const legacyKey = String(projector.holdImageRemoteKey ?? "").trim();
        if (
          removedKey &&
          (legacyKey === removedKey ||
            String(projector.holdImageFile ?? "").trim() === String(removed?.file ?? "").trim())
        ) {
          delete projector.holdImageFile;
          delete projector.holdImageRemoteKey;
          delete projector.holdImageRemoteUrl;
          delete projector.holdImageFilePath;
        }
        if (next.length === 0) {
          delete projector.defaultHoldId;
        }
      }

      state.sceneData = {
        ...(state.sceneData ?? {}),
        holdImages: next,
        ...(projector ? { projector: { ...projector, v: 1 } } : {}),
      };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    },
    setProjectorSettings(state, action: PayloadAction<SceneProjectorSettingsV1>) {
      state.sceneData = { ...(state.sceneData ?? {}), projector: action.payload };
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
    builder.addCase(uploadSceneVideosWeb.fulfilled, (state, action) => {
      const next = action.payload?.videos ?? [];
      if (next.length === 0) return;
      const prev = Array.isArray(state.sceneData?.videos) ? state.sceneData!.videos! : [];
      state.sceneData = { ...(state.sceneData ?? {}), videos: [...prev, ...next] };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
    });

    builder.addCase(uploadSceneHoldImagesWeb.fulfilled, (state, action) => {
      const added = action.payload?.holdImages ?? [];
      if (added.length === 0) return;
      const prev = Array.isArray(state.sceneData?.holdImages) ? state.sceneData!.holdImages! : [];
      const next = [...prev, ...added];
      const prevProjector = state.sceneData?.projector;
      const defaultHoldId =
        prevProjector?.defaultHoldId != null
          ? prevProjector.defaultHoldId
          : next[0]?.id;
      state.sceneData = {
        ...(state.sceneData ?? {}),
        holdImages: next,
        projector: { v: 1, ...prevProjector, defaultHoldId },
      };
      state.hasLocalEdits = true;
      state.sceneDataRevision += 1;
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

