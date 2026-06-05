import { resolveOfflineMediaUrl } from "../../../shared/platform/media-url";
import {
  fetchImageStreamBlobUrl,
  fetchVideoStreamBlobUrl,
} from "../../../sync/api/files";
import type {
  SceneHoldImage,
  SceneProjectorSettingsV1,
  SceneVideo,
} from "../../scene/model/scene-slice";
import { normalizeHoldImages } from "./scene-projector-persist";
import {
  enrichProjectorMediaRemoteKey,
  isDirectObjectStorageUrl,
  resolveProjectorStorageKey,
} from "./projector-storage-key";

export type ProjectorMediaContext = {
  projectSlug: string;
  videos?: SceneVideo[];
  holdImages?: SceneHoldImage[];
  projector?: SceneProjectorSettingsV1 | null;
};

export type ProjectorMediaAsset = {
  storageKey: string | null;
  fallbackSrc: string | null;
};

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

function listHoldImages(ctx: ProjectorMediaContext): SceneHoldImage[] {
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

function resolveProjectorMediaAsset(
  ctx: ProjectorMediaContext,
  item: { remoteKey?: string; remoteUrl?: string; file: string; filePath?: string },
  kind: "image" | "video",
): ProjectorMediaAsset {
  const enriched = enrichProjectorMediaRemoteKey(item);
  const storageKey = resolveProjectorStorageKey(enriched);

  const remote = String(enriched.remoteUrl ?? "").trim();
  if (/^https?:\/\//i.test(remote) && !isDirectObjectStorageUrl(remote)) {
    if (/localhost:3000\/files\//i.test(remote) || /\/files\/play\//i.test(remote)) {
      return { storageKey, fallbackSrc: remote };
    }
  }

  const offline = resolveOfflineMediaUrl({
    projectSlug: ctx.projectSlug,
    kind,
    fileName: enriched.file,
    filePath: enriched.filePath,
    remoteUrl: enriched.remoteUrl,
  });
  const resolved = offline.trim();
  const fallbackSrc =
    resolved && !isDirectObjectStorageUrl(resolved) ? resolved : null;
  return { storageKey, fallbackSrc };
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
  return fetchVideoStreamBlobUrl(readAccessToken(), storageKey);
}

/** @deprecated Используйте resolveProjectorHoldAsset + загрузку в окне проектора */
export async function resolveProjectorHoldPlaySrc(
  ctx: ProjectorMediaContext,
  holdId?: number | null,
): Promise<string | null> {
  const asset = resolveProjectorHoldAsset(ctx, holdId);
  if (!asset) return null;
  if (asset.storageKey) {
    const blobUrl = await fetchProjectorImageBlobUrl(asset.storageKey);
    if (blobUrl) return blobUrl;
  }
  return asset.fallbackSrc;
}

/** @deprecated Используйте resolveProjectorVideoAsset + загрузку в окне проектора */
export async function resolveProjectorVideoPlaySrc(
  ctx: ProjectorMediaContext,
  videoId: number,
): Promise<string | null> {
  const asset = resolveProjectorVideoAsset(ctx, videoId);
  if (!asset) return null;
  if (asset.storageKey) {
    const blobUrl = await fetchProjectorVideoBlobUrl(asset.storageKey);
    if (blobUrl) return blobUrl;
  }
  return asset.fallbackSrc;
}
