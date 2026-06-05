import type {
  SceneHoldImage,
  SceneProjectorSettingsV1,
  SceneVideo,
} from "../../scene/model/scene-slice";
import {
  enrichProjectorMediaRemoteKey,
  resolveProjectorStorageKey,
} from "./projector-storage-key";

export type SceneProjectorMediaV1 = {
  v: 1;
  videos?: SceneVideo[];
  holdImages?: SceneHoldImage[];
  projector?: SceneProjectorSettingsV1;
};

function legacyHoldAsImage(projector?: SceneProjectorSettingsV1): SceneHoldImage | null {
  if (!projector) return null;
  const file = String(projector.holdImageFile ?? "").trim();
  const url = String(projector.holdImageRemoteUrl ?? "").trim();
  if (!file && !url) return null;
  return enrichProjectorMediaRemoteKey({
    id: projector.defaultHoldId ?? 1,
    title: file.replace(/\.[^.]+$/, "") || "Заставка",
    file: file || "hold.jpg",
    remoteKey:
      projector.holdImageRemoteKey ??
      resolveProjectorStorageKey({
        remoteUrl: projector.holdImageRemoteUrl,
      }) ??
      undefined,
    remoteUrl: projector.holdImageRemoteUrl,
    filePath: projector.holdImageFilePath,
  });
}

function enrichHoldImageList(holdImages: SceneHoldImage[]): SceneHoldImage[] {
  return holdImages.map((h) => enrichProjectorMediaRemoteKey(h));
}

function enrichVideoList(videos: SceneVideo[]): SceneVideo[] {
  return videos.map((v) => enrichProjectorMediaRemoteKey(v));
}

export function normalizeHoldImages(
  holdImages: SceneHoldImage[] | undefined,
  projector?: SceneProjectorSettingsV1,
): SceneHoldImage[] {
  const list = enrichHoldImageList(
    Array.isArray(holdImages) ? holdImages.filter((h) => h && Number(h.id) > 0) : [],
  );
  if (list.length > 0) return list;
  const legacy = legacyHoldAsImage(projector);
  return legacy ? [legacy] : [];
}

export function packProjectorMedia(input: {
  videos?: SceneVideo[];
  holdImages?: SceneHoldImage[];
  projector?: SceneProjectorSettingsV1 | null;
}): SceneProjectorMediaV1 | null {
  const videos = enrichVideoList(Array.isArray(input.videos) ? input.videos : []);
  const holdImages = normalizeHoldImages(input.holdImages, input.projector ?? undefined);
  const projector = input.projector ?? undefined;
  if (videos.length === 0 && holdImages.length === 0 && !projector) return null;
  return { v: 1, videos, holdImages, projector };
}

export function unpackProjectorMedia(raw: unknown): {
  videos: SceneVideo[];
  holdImages: SceneHoldImage[];
  projector?: SceneProjectorSettingsV1;
} {
  if (!raw || typeof raw !== "object" || (raw as SceneProjectorMediaV1).v !== 1) {
    return { videos: [], holdImages: [] };
  }
  const bag = raw as SceneProjectorMediaV1;
  const videos = enrichVideoList(
    Array.isArray(bag.videos) ? bag.videos.filter((v) => v && Number(v.id) > 0) : [],
  );
  const projector =
    bag.projector && typeof bag.projector === "object" && bag.projector.v === 1
      ? bag.projector
      : undefined;
  const holdImages = normalizeHoldImages(bag.holdImages, projector);
  return { videos, holdImages, projector };
}

/** Ключи image/* в хранилище, которые нельзя удалять при GC (заставки проектора). */
export function collectProjectorHoldImageRemoteKeys(raw: unknown): string[] {
  const bag = unpackProjectorMedia(raw);
  const keys = new Set<string>();
  for (const hold of bag.holdImages) {
    const key = resolveProjectorStorageKey(hold);
    if (key) keys.add(key);
  }
  const legacyKey =
    resolveProjectorStorageKey({
      remoteKey: bag.projector?.holdImageRemoteKey,
      remoteUrl: bag.projector?.holdImageRemoteUrl,
    }) ?? null;
  if (legacyKey) keys.add(legacyKey);
  return [...keys];
}
