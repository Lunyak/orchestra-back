import { createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  desktopAddProjectAudio,
  desktopDeleteProjectAudio,
  desktopPickProjectAudio,
  desktopPickProjectSound,
  desktopPickProjectSoundIcon,
} from "../../../shared/platform/desktop-methods";
import { createId } from "../../../shared/utils/createId";
import { uploadProjectFile } from "../../../sync/api/files";
import { ensureProject } from "../../../sync/api/projects";
import type { PlaylistTrack } from "../../../shared/types/playlist";
import { saveDesktopProjectMediaFromFile } from "../../../shared/platform/desktop-project-media";
import type {
  PlaybookHoldImage,
  PlaybookVideo,
  SceneSound,
  SceneVoiceLineTake,
} from "./playbook-types";
import {
  ensureProjectIdCached,
  getAccessToken,
  nextHoldImageIds,
  nextPlaylistIds,
  nextSoundIds,
  nextVideoIds,
  persistScenePlaylistToDesktop,
  voiceExtFromMime,
} from "./playbook-slice-helpers";
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
>("playbook/uploadVoiceLineTakeWeb", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) throw new Error("РќРµС‚ С‚РѕРєРµРЅР° Р°РІС‚РѕСЂРёР·Р°С†РёРё");

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
>("playbook/uploadSceneSoundsWeb", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("РќРµС‚ С‚РѕРєРµРЅР° Р°РІС‚РѕСЂРёР·Р°С†РёРё");
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
  const ids = nextSoundIds(state.playbook.playbookData?.sounds, files.length);

  const uploaded: SceneSound[] = [];
  // РџРѕ РѕРґРЅРѕРјСѓ, С‡С‚РѕР±С‹ РЅРµ РїРѕР»РѕР¶РёС‚СЊ СЃРµСЂРІРµСЂ
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

export const uploadPlaybookVideosWeb = createAsyncThunk<
  { projectSlug: string; videos: PlaybookVideo[] },
  { projectSlug: string; files: File[] }
>("playbook/uploadPlaybookVideosWeb", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("РќРµС‚ С‚РѕРєРµРЅР° Р°РІС‚РѕСЂРёР·Р°С†РёРё");
  }
  const files = (args.files ?? []).filter(Boolean);
  if (files.length === 0) return { projectSlug: args.projectSlug, videos: [] };

  const projectSlug = args.projectSlug;
  const cachedId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;
  const projectId =
    cachedId ??
    (await ensureProject(token, projectSlug, `РџСЂРѕРµРєС‚ ${projectSlug}`)).id;
  if (!cachedId) ensureProjectIdCached(projectSlug, projectId);

  const state = api.getState() as RootState;
  const ids = nextVideoIds(state.playbook.playbookData?.videos, files.length);

  const uploaded: PlaybookVideo[] = [];
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

export const uploadPlaybookHoldImagesWeb = createAsyncThunk<
  { projectSlug: string; holdImages: PlaybookHoldImage[] },
  { projectSlug: string; files: File[] }
>("playbook/uploadPlaybookHoldImagesWeb", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("РќРµС‚ С‚РѕРєРµРЅР° Р°РІС‚РѕСЂРёР·Р°С†РёРё");
  }
  const files = (args.files ?? []).filter(Boolean);
  if (files.length === 0) return { projectSlug: args.projectSlug, holdImages: [] };

  const projectSlug = args.projectSlug;
  const cachedId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;
  const projectId =
    cachedId ??
    (await ensureProject(token, projectSlug, `РџСЂРѕРµРєС‚ ${projectSlug}`)).id;
  if (!cachedId) ensureProjectIdCached(projectSlug, projectId);

  const state = api.getState() as RootState;
  const ids = nextHoldImageIds(state.playbook.playbookData?.holdImages, files.length);

  const uploaded: PlaybookHoldImage[] = [];
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
>("playbook/uploadScenePlaylistWeb", async (args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) {
    throw new Error("РќРµС‚ С‚РѕРєРµРЅР° Р°РІС‚РѕСЂРёР·Р°С†РёРё");
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
  const current = (state.playbook.playbookData?.playlist ?? []) as PlaylistTrack[];
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
>("playbook/setSoundIcon", async (args, api) => {
  const projectSlug = args.projectSlug;
  const desktopApi = getDesktopApi();
  const token = getAccessToken(api.getState as () => RootState);

  const cachedId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectSlug}`) : null;

  let projectId: string | null = cachedId;
  if (token && !projectId) {
    projectId = (await ensureProject(token, projectSlug, `РџСЂРѕРµРєС‚ ${projectSlug}`)).id;
    ensureProjectIdCached(projectSlug, projectId);
  }

  // Web path: we get File directly from <input type="file" />
  if (args.file) {
    if (!token || !projectId) throw new Error("РќРµС‚ С‚РѕРєРµРЅР° Р°РІС‚РѕСЂРёР·Р°С†РёРё");
    const { key, url } = await uploadProjectFile(token, {
      projectId,
      type: "image",
      file: args.file,
    });
    return {
      projectSlug,
      soundId: args.soundId,
      changes: {
        icon: args.file.name,
        iconRemoteKey: key,
        iconRemoteUrl: url,
      },
    };
  }

  // Desktop path: pick local file via Electron
  if (!desktopApi?.pickProjectSoundIcon) {
    throw new Error("РќРµРґРѕСЃС‚СѓРїРµРЅ РІС‹Р±РѕСЂ РёРєРѕРЅРєРё");
  }

  const res = await desktopPickProjectSoundIcon(desktopApi, projectSlug, projectId || undefined);
  if (!res?.ok) {
    // canceled is not an error: no state change
    if (res?.canceled) {
      return { projectSlug, soundId: args.soundId, changes: {} };
    }
    throw new Error(res?.error ?? "РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹Р±СЂР°С‚СЊ РёРєРѕРЅРєСѓ");
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
>("playbook/pickSceneSoundsDesktop", async (args, api) => {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error("Desktop API РЅРµРґРѕСЃС‚СѓРїРµРЅ");
  }
  const res = await desktopPickProjectSound(desktopApi, args.projectSlug);
  if (!res?.ok) {
    if (res?.canceled) return { projectSlug: args.projectSlug, sounds: [] };
    throw new Error(res?.error ?? "РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹Р±СЂР°С‚СЊ Р·РІСѓРє");
  }
  const tracks = Array.isArray(res.tracks) ? res.tracks : [];
  if (tracks.length === 0) return { projectSlug: args.projectSlug, sounds: [] };

  const state = api.getState() as RootState;
  const ids = nextSoundIds(state.playbook.playbookData?.sounds, tracks.length);

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
>("playbook/pickScenePlaylistTracksDesktop", async (args, api) => {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error("Desktop API РЅРµРґРѕСЃС‚СѓРїРµРЅ");
  }

  const res = await desktopPickProjectAudio(desktopApi, args.projectSlug);
  if (!res?.ok) {
    if (res?.canceled) {
      const state = api.getState() as RootState;
      const current = (state.playbook.playbookData?.playlist ?? []) as PlaylistTrack[];
      return { projectSlug: args.projectSlug, sceneName: args.sceneName, playlist: current };
    }
    throw new Error(res?.error ?? "РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹Р±СЂР°С‚СЊ Р°СѓРґРёРѕ");
  }

  const tracks = Array.isArray(res.tracks) ? res.tracks : [];
  if (tracks.length === 0) {
    const state = api.getState() as RootState;
    const current = (state.playbook.playbookData?.playlist ?? []) as PlaylistTrack[];
    return { projectSlug: args.projectSlug, sceneName: args.sceneName, playlist: current };
  }

  const state = api.getState() as RootState;
  const current = (state.playbook.playbookData?.playlist ?? []) as PlaylistTrack[];
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
>("playbook/addScenePlaylistTracksFromPathsDesktop", async (args, api) => {
  const desktopApi = getDesktopApi();
  if (!desktopApi) throw new Error("Desktop API РЅРµРґРѕСЃС‚СѓРїРµРЅ");

  const res = await desktopAddProjectAudio(desktopApi, args.projectSlug, args.filePaths);
  if (!res?.ok) {
    throw new Error(res?.error ?? "РќРµ СѓРґР°Р»РѕСЃСЊ РґРѕР±Р°РІРёС‚СЊ Р°СѓРґРёРѕ");
  }
  const tracks = Array.isArray(res.tracks) ? res.tracks : [];
  if (tracks.length === 0) {
    const state = api.getState() as RootState;
    const current = (state.playbook.playbookData?.playlist ?? []) as PlaylistTrack[];
    return { projectSlug: args.projectSlug, sceneName: args.sceneName, playlist: current };
  }

  const state = api.getState() as RootState;
  const current = (state.playbook.playbookData?.playlist ?? []) as PlaylistTrack[];
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
>("playbook/persistScenePlaylistDesktop", async (args, api) => {
  const state = api.getState() as RootState;
  const current = (state.playbook.playbookData?.playlist ?? []) as PlaylistTrack[];
  await persistScenePlaylistToDesktop(args.projectSlug, args.sceneName, current, api.getState as () => RootState);
  return { projectSlug: args.projectSlug, sceneName: args.sceneName, playlist: current };
});

export const deleteScenePlaylistTrackDesktop = createAsyncThunk<
  { projectSlug: string; sceneName: string; removedId: number },
  { projectSlug: string; sceneName: string; id: number; file: string }
>("playbook/deleteScenePlaylistTrackDesktop", async (args, api) => {
  const desktopApi = getDesktopApi();
  if (!desktopApi) throw new Error("Desktop API РЅРµРґРѕСЃС‚СѓРїРµРЅ");

  try {
    const res = await desktopDeleteProjectAudio(desktopApi, args.projectSlug, args.file);
    if (!res?.ok) {
      console.error("[playlist] deleteProjectAudio failed:", res?.error);
    }
  } catch (err) {
    console.error("[playlist] deleteProjectAudio error:", err);
  }

  const state = api.getState() as RootState;
  const prev = (state.playbook.playbookData?.playlist ?? []) as PlaylistTrack[];
  const next = prev.filter((t) => Number(t.id) !== Number(args.id));
  await persistScenePlaylistToDesktop(args.projectSlug, args.sceneName, next, api.getState as () => RootState);
  return { projectSlug: args.projectSlug, sceneName: args.sceneName, removedId: args.id };
});
