import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { resolveBrowserPickedMediaUrl } from "../../../shared/platform/browser-picked-media";
import { localProjectMediaDevUrl } from "../../../shared/platform/local-project-dev";
import { isBrowserDevLocalProjects, resolveOfflineMediaUrl } from "../../../shared/platform/media-url";
import { storageKeyToImageBasename } from "../../../shared/utils/markdownImages";
import {
  fetchImageStreamBlobUrl,
  fetchVideoStreamBlobUrl,
  getPlayUrl,
} from "../../../sync/api/files";
import { api } from "../../../sync/api/client";
import type {
  PlaybookHoldImage,
  SceneProjectorSettingsV1,
  PlaybookVideo,
} from "../../playbook/model/playbook-slice";
import { normalizeHoldImages } from "./playbook-projector-persist";
import {
  enrichProjectorMediaRemoteKey,
  isDirectObjectStorageUrl,
  resolveProjectorStorageKey,
} from "./projector-storage-key";

export type ProjectorMediaContext = {
  projectSlug: string;
  videos?: PlaybookVideo[];
  holdImages?: PlaybookHoldImage[];
  projector?: SceneProjectorSettingsV1 | null;
};

export type ProjectorMediaAsset = {
  storageKey: string | null;
  fallbackSrc: string | null;
  fileName: string | null;
};

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

function listHoldImages(ctx: ProjectorMediaContext): PlaybookHoldImage[] {
  return normalizeHoldImages(ctx.holdImages, ctx.projector ?? undefined);
}

export function resolveDefaultHoldId(ctx: ProjectorMediaContext): number | null {
  const holds = listHoldImages(ctx);
  if (holds.length === 0) return null;
  const preferred = ctx.projector?.defaultHoldId;
  if (preferred != null && holds.some((h) => Number(h.id) === Number(preferred))) {
    return Number(preferred);
  }
  return Number(holds[0].id);
}

function projectorMediaFileName(
  item: { file: string },
  storageKey: string | null,
  kind: "image" | "video",
): string {
  const direct = String(item.file ?? "")
    .trim()
    .replace(/^.*[/\\]/, "");
  if (direct) return direct;
  if (!storageKey) return "";
  if (kind === "image") return storageKeyToImageBasename(storageKey);
  return storageKey.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "";
}

function desktopProjectMediaUrl(
  projectSlug: string,
  fileName: string,
  kind: "image" | "video",
): string | null {
  const clean = String(fileName ?? "")
    .trim()
    .replace(/^.*[/\\]/, "");
  if (!clean || !getDesktopApi()) return null;
  const scheme = kind === "video" ? "project-video" : "project-images";
  const url = new URL(`${scheme}://${encodeURIComponent(projectSlug)}/`);
  url.pathname = `/${clean}`;
  return url.toString();
}

function resolveProjectorMediaAsset(
  ctx: ProjectorMediaContext,
  item: {
    remoteKey?: string;
    remoteUrl?: string;
    file: string;
    filePath?: string;
    title?: string;
  },
  kind: "image" | "video",
): ProjectorMediaAsset {
  const enriched = enrichProjectorMediaRemoteKey(item);
  const storageKey = resolveProjectorStorageKey(enriched);
  const fileName = projectorMediaFileName(enriched, storageKey, kind);
  const titleHint = String(enriched.title ?? "").trim();
  const mediaKind = kind === "video" ? "video" : "image";

  if (!getDesktopApi()) {
    const picked = resolveBrowserPickedMediaUrl(fileName || enriched.file, titleHint, ctx.projectSlug);
    if (picked) return { storageKey, fallbackSrc: picked, fileName: fileName || null };
  }

  const devLocal = localProjectMediaDevUrl(
    ctx.projectSlug,
    mediaKind,
    fileName || enriched.file,
    titleHint,
  );
  const desktopLocal = desktopProjectMediaUrl(ctx.projectSlug, fileName, kind);
  const localPlay = desktopLocal ?? devLocal;

  // Браузер + npm run dev: всегда с диска (Desktop/xxx), не с сервера.
  // storageKey оставляем — если локальный файл не найден, превью уйдёт на remote.
  if (isBrowserDevLocalProjects() && localPlay) {
    return { storageKey, fallbackSrc: localPlay, fileName: fileName || null };
  }

  const offline = resolveOfflineMediaUrl({
    projectSlug: ctx.projectSlug,
    kind: mediaKind,
    fileName: fileName || enriched.file,
    filePath: enriched.filePath,
    remoteUrl: enriched.remoteUrl,
    titleHint,
  });
  const resolvedOffline = offline.trim();
  const localSrc =
    resolvedOffline && !isDirectObjectStorageUrl(resolvedOffline) ? resolvedOffline : null;
  const localPlayResolved = desktopLocal ?? devLocal;

  // Локальная копия на диске — без повторной загрузки с сервера.
  if (localSrc && (String(enriched.filePath ?? "").trim() || localPlayResolved)) {
    return { storageKey, fallbackSrc: localSrc, fileName: fileName || null };
  }

  if (localPlayResolved) {
    return { storageKey, fallbackSrc: localPlayResolved, fileName: fileName || null };
  }

  const remote = String(enriched.remoteUrl ?? "").trim();
  if (/^https?:\/\//i.test(remote) && !isDirectObjectStorageUrl(remote)) {
    if (/localhost:3000\/files\//i.test(remote) || /\/files\/play\//i.test(remote)) {
      return { storageKey, fallbackSrc: remote, fileName: fileName || null };
    }
  }

  return { storageKey, fallbackSrc: localSrc, fileName: fileName || null };
}

export function resolveProjectorHoldAsset(
  ctx: ProjectorMediaContext,
  holdId?: number | null,
): (ProjectorMediaAsset & { holdId: number | null }) | null {
  const holds = listHoldImages(ctx);
  if (holds.length === 0) return null;

  const targetId =
    holdId != null && holdId > 0
      ? holdId
      : resolveDefaultHoldId(ctx);
  if (targetId == null) return null;

  const hold = holds.find((h) => Number(h.id) === Number(targetId));
  if (!hold) return null;

  const asset = resolveProjectorMediaAsset(ctx, hold, "image");
  return { ...asset, holdId: targetId };
}

export function resolveProjectorVideoAsset(
  ctx: ProjectorMediaContext,
  videoId: number,
): ProjectorMediaAsset | null {
  const video = (ctx.videos ?? []).find((v) => Number(v.id) === Number(videoId));
  if (!video) return null;
  return resolveProjectorMediaAsset(ctx, video, "video");
}

export async function fetchProjectorImageBlobUrl(storageKey: string): Promise<string | null> {
  return fetchImageStreamBlobUrl(readAccessToken(), storageKey);
}

export async function fetchProjectorVideoBlobUrl(storageKey: string): Promise<string | null> {
  const token = readAccessToken();
  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const { data } = await api.get<Blob>("/files/stream", {
      params: { key: storageKey },
      responseType: "blob",
      headers,
    });
    if (!data || !(data instanceof Blob) || data.size === 0) return null;
    const type = (data.type || "").toLowerCase();
    if (
      type.startsWith("text/") ||
      type.startsWith("application/json") ||
      type.startsWith("application/xml")
    ) {
      return null;
    }
    // Без явного video/* <video> часто не отдаёт duration (чёрный экран в модалке).
    const playable =
      type.startsWith("video/") || type.startsWith("audio/")
        ? data
        : new Blob([data], { type: "video/mp4" });
    return URL.createObjectURL(playable);
  } catch {
    return fetchVideoStreamBlobUrl(token, storageKey);
  }
}

/** Для превью: signed play-url (без скачивания всего файла), иначе blob. */
export async function fetchProjectorVideoPreviewUrl(
  storageKey: string,
): Promise<{ src: string; blob: boolean } | null> {
  const token = readAccessToken();
  if (token) {
    try {
      const { url } = await getPlayUrl(token, storageKey);
      const playUrl = String(url ?? "").trim();
      if (playUrl) return { src: playUrl, blob: false };
    } catch {
      /* fall through to stream blob */
    }
  }
  const blobUrl = await fetchVideoStreamBlobUrl(token, storageKey);
  if (!blobUrl) return null;
  return { src: blobUrl, blob: true };
}

/**
 * Кандидаты для выбора кадра превью (по приоритету).
 * Модалка пробует следующий, если текущий не отдаёт duration.
 */
export type ProjectorVideoFramePickerCandidate = {
  src: string;
  blob: boolean;
  storageKey: string | null;
  label: string;
};

export async function resolveProjectorVideoFramePickerCandidates(
  ctx: ProjectorMediaContext,
  videoId: number,
): Promise<ProjectorVideoFramePickerCandidate[]> {
  const asset = resolveProjectorVideoAsset(ctx, videoId);
  if (!asset) return [];

  const out: ProjectorVideoFramePickerCandidate[] = [];
  const seen = new Set<string>();
  const push = (src: string | null | undefined, blob: boolean, label: string) => {
    const value = String(src ?? "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push({
      src: value,
      blob,
      storageKey: asset.storageKey,
      label,
    });
  };

  const local = String(asset.fallbackSrc ?? "").trim();

  // 1) Локальный blob из folder picker — обычно seekable
  if (local.toLowerCase().startsWith("blob:")) {
    push(local, true, "local-blob");
  }

  // 2) Полный stream blob с сервера — надёжный duration
  if (asset.storageKey) {
    const blobUrl = await fetchProjectorVideoBlobUrl(asset.storageKey);
    if (blobUrl) push(blobUrl, true, "storage-blob");
  }

  // 3) Signed play-url
  if (asset.storageKey) {
    const remote = await fetchProjectorVideoPreviewUrl(asset.storageKey);
    if (remote?.src) push(remote.src, remote.blob, "play-url");
  }

  // 4) Локальные пути (dev / desktop) — в конце, часто без metadata
  if (local && !local.toLowerCase().startsWith("blob:")) {
    push(local, false, "local-path");
  }

  return out;
}
