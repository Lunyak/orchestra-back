import type { RootState } from "../../../shared/store/store";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  desktopReadProjectPlaybook,
  desktopSaveProjectPlaybook,
} from "../../../shared/platform/desktop-methods";
import { ensureProject } from "../../../sync/api/projects";
import { flushDesktopOutbox } from "../../../sync/desktopOutbox";
import { normalizeHoldImages } from "../../projector/model/playbook-projector-persist";
import type { PlaylistTrack } from "../../../shared/types/playlist";
import type {
  SceneLightKadrsDataV1,
  ScriptScene,
} from "../../../shared/types/script";
import { syncSubscribedTheaterRequisites } from "../../theater/model/theater-decor-inventory";
import { normalizeLightKadrs } from "../../theater/model/light-kadrs";
import { readSceneTheaterModels } from "../../theater/model/theater-scene-models";
import {
  normalizeScriptRequisites,
  normalizeScriptRequisitesWithRemap,
} from "./playbook-normalize";
import type {
  PlaybookData,
  PlaybookHoldImage,
  PlaybookVideo,
} from "./playbook-types";

export { normalizeScriptRequisites };

function remapKadrRequisiteIds(
  lightKadrs: SceneLightKadrsDataV1 | null | undefined,
  idRemap: Map<number, number>,
): SceneLightKadrsDataV1 | null | undefined {
  if (!lightKadrs || idRemap.size === 0) return lightKadrs;
  const kadrs = lightKadrs.kadrs;
  if (!Array.isArray(kadrs) || kadrs.length === 0) return lightKadrs;
  let changed = false;
  const nextKadrs = kadrs.map((kadr) => {
    const cues = kadr.requisites;
    if (!Array.isArray(cues) || cues.length === 0) return kadr;
    let cuesChanged = false;
    const remapped = cues.map((cue) => {
      const nextId = idRemap.get(cue.requisiteId) ?? cue.requisiteId;
      if (nextId === cue.requisiteId) return cue;
      cuesChanged = true;
      return { ...cue, requisiteId: nextId };
    });
    if (!cuesChanged) return kadr;
    changed = true;
    return { ...kadr, requisites: remapped };
  });
  if (!changed) return lightKadrs;
  return normalizeLightKadrs(nextKadrs) ?? lightKadrs;
}

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

export function mergeProjectorPlaybookDataOnHydrate(
  incoming: PlaybookData | null,
  prev: PlaybookData | null,
): PlaybookData | null {
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

export function getAccessToken(getState: () => RootState): string | null {
  const fromState = getState().auth?.accessToken ?? null;
  if (fromState) return fromState;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export function ensureProjectIdCached(projectSlug: string, projectId: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(`projectId:${projectSlug}`, projectId);
  } catch {
    // ignore
  }
}

export function normalizeHydratedScenes(raw: ScriptScene[]): ScriptScene[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((scene) => {
    const { items, idRemap } = normalizeScriptRequisitesWithRemap(
      scene.requisites,
    );
    const requisites = syncSubscribedTheaterRequisites(
      items,
      readSceneTheaterModels(scene),
    );
    const lightKadrs = remapKadrRequisiteIds(scene.lightKadrs, idRemap);
    return {
      ...scene,
      requisites,
      ...(lightKadrs !== scene.lightKadrs ? { lightKadrs } : {}),
    };
  });
}

export function nextSoundIds(sounds: any[] | undefined, count: number): number[] {
  const maxId = (sounds ?? []).reduce((acc: number, s: any) => Math.max(acc, Number(s?.id ?? 0)), 0);
  return Array.from({ length: count }, (_v, i) => maxId + i + 1);
}

export function nextPlaylistIds(playlist: PlaylistTrack[] | undefined, count: number): number[] {
  const list = Array.isArray(playlist) ? playlist : [];
  const maxId = list.reduce((acc, t) => Math.max(acc, Number(t?.id ?? 0)), 0);
  return Array.from({ length: count }, (_v, i) => maxId + i + 1);
}

export function nextVideoIds(videos: PlaybookVideo[] | undefined, count: number): number[] {
  const list = Array.isArray(videos) ? videos : [];
  const maxId = list.reduce((acc, v) => Math.max(acc, Number(v?.id ?? 0)), 0);
  return Array.from({ length: count }, (_v, i) => maxId + i + 1);
}

export function nextHoldImageIds(holdImages: PlaybookHoldImage[] | undefined, count: number): number[] {
  const list = Array.isArray(holdImages) ? holdImages : [];
  const maxId = list.reduce((acc, h) => Math.max(acc, Number(h?.id ?? 0)), 0);
  return Array.from({ length: count }, (_v, i) => maxId + i + 1);
}

export function voiceExtFromMime(mime: string): string {
  const t = String(mime ?? "").toLowerCase();
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("wav")) return "wav";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("mp4")) return "m4a";
  return "webm";
}

export async function persistScenePlaylistToDesktop(
  projectSlug: string,
  sceneName: string,
  playlist: PlaylistTrack[],
  getState: () => RootState,
) {
  const desktopApi = getDesktopApi();
  if (!desktopApi) {
    throw new Error("Desktop API недоступен");
  }

  const current = await desktopReadProjectPlaybook(desktopApi, projectSlug, sceneName);
  const payload = { ...(current && typeof current === "object" ? current : {}), playlist };
  const result = await desktopSaveProjectPlaybook(desktopApi, projectSlug, sceneName, payload);
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

  await flushDesktopOutbox(token, projectSlug);
}
