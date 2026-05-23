import { createAsyncThunk } from "@reduxjs/toolkit";
import { getAccessToken } from "../../../shared/api/authenticated";
import type { RootState } from "../../../shared/store/store";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { createId } from "../../../shared/utils/createId";
import { uploadProjectFile } from "../../../sync/api/files";
import { ensureProject } from "../../../sync/api/projects";
import type { PlaylistTrack } from "../../../shared/types/playlist";
import { flushDesktopOutbox } from "../../../sync/desktopOutbox";
import type { SceneSound, SceneVoiceLineTake } from "./scene-slice";

function ensureProjectIdCached(projectSlug: string, projectId: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(`projectId:${projectSlug}`, projectId);
  } catch {
    // ignore
  }
}

function nextSoundIds(sounds: SceneSound[] | undefined, count: number): number[] {
  const maxId = (sounds ?? []).reduce((acc, s) => Math.max(acc, Number(s?.id ?? 0)), 0);
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

  const current = await desktopApi.readProjectScene!(projectSlug, sceneName);
  const payload = { ...(current as object), playlist };
  const result = await desktopApi.saveProjectScene!(projectSlug, sceneName, payload);
  if (!result?.ok) {
    throw new Error(result?.error ?? "Не удалось сохранить плейлист");
  }

  const token = getAccessToken();
  if (!token) return;

  let projectId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;
  if (!projectId) {
    const proj = await ensureProject(token, projectSlug, `Проект ${projectSlug}`);
    projectId = proj.id;
    ensureProjectIdCached(projectSlug, projectId);
  }

  await flushDesktopOutbox(token, projectSlug);
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
  const token = getAccessToken();
  if (!token) throw new Error("Нет токена авторизации");

  const projectSlug = args.projectSlug;
  const cachedId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;
  const projectId =
    cachedId ??
    (await ensureProject(token, projectSlug, `РџСЂРѕРµРєС‚ ${projectSlug}`)).id;
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
  const token = getAccessToken();
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
    (await ensureProject(token, projectSlug, `РџСЂРѕРµРєС‚ ${projectSlug}`)).id;
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
  const token = getAccessToken();
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
    cachedId ?? (await ensureProject(token, projectSlug, `РџСЂРѕРµРєС‚ ${projectSlug}`)).id;
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
  const token = getAccessToken();

  const cachedId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;

  let projectId: string | null = cachedId;
  if (token && !projectId) {
    projectId = (await ensureProject(token, projectSlug, `РџСЂРѕРµРєС‚ ${projectSlug}`)).id;
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

  const token = getAccessToken();
  let projectId: string | null = null;
  if (token) {
    const cached =
      typeof window !== "undefined"
        ? localStorage.getItem(`projectId:${args.projectSlug}`)
        : null;
    if (cached) {
      projectId = cached;
    } else {
      const proj = await ensureProject(token, args.projectSlug, `РџСЂРѕРµРєС‚ ${args.projectSlug}`);
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
  const token = getAccessToken();
  let projectId: string | null = null;
  if (token) {
    const cached =
      typeof window !== "undefined"
        ? localStorage.getItem(`projectId:${args.projectSlug}`)
        : null;
    if (cached) {
      projectId = cached;
    } else {
      const proj = await ensureProject(token, args.projectSlug, `РџСЂРѕРµРєС‚ ${args.projectSlug}`);
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

  const token = getAccessToken();
  let projectId: string | null = null;
  if (token) {
    const cached =
      typeof window !== "undefined"
        ? localStorage.getItem(`projectId:${args.projectSlug}`)
        : null;
    if (cached) {
      projectId = cached;
    } else {
      const proj = await ensureProject(token, args.projectSlug, `РџСЂРѕРµРєС‚ ${args.projectSlug}`);
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
