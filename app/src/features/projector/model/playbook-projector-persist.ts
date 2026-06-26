import type {
  PlaybookHoldImage,
  SceneProjectorSettingsV1,
  PlaybookVideo,
} from "../../playbook/model/playbook-slice";
import {
  enrichProjectorMediaRemoteKey,
  resolveProjectorStorageKey,
} from "./projector-storage-key";

export type PlaybookProjectorMediaV1 = {
  v: 1;
  videos?: PlaybookVideo[];
  holdImages?: PlaybookHoldImage[];
  projector?: SceneProjectorSettingsV1;
};
function legacyHoldAsImage(projector?: SceneProjectorSettingsV1): PlaybookHoldImage | null {
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

function enrichHoldImageList(holdImages: PlaybookHoldImage[]): PlaybookHoldImage[] {
  return holdImages.map((h) => enrichProjectorMediaRemoteKey(h));
}

function enrichVideoList(videos: PlaybookVideo[]): PlaybookVideo[] {
  return videos.map((v) => enrichProjectorMediaRemoteKey(v));
}

export function normalizeHoldImages(
  holdImages: PlaybookHoldImage[] | undefined,
  projector?: SceneProjectorSettingsV1,
): PlaybookHoldImage[] {
  const list = enrichHoldImageList(
    Array.isArray(holdImages) ? holdImages.filter((h) => h && Number(h.id) > 0) : [],
  );
  if (list.length > 0) return list;
  const legacy = legacyHoldAsImage(projector);
  return legacy ? [legacy] : [];
}

export function packProjectorMedia(input: {
  videos?: PlaybookVideo[];
  holdImages?: PlaybookHoldImage[];
  projector?: SceneProjectorSettingsV1 | null;
}): PlaybookProjectorMediaV1 | null {
  const videos = enrichVideoList(Array.isArray(input.videos) ? input.videos : []);
  const holdImages = normalizeHoldImages(input.holdImages, input.projector ?? undefined);
  const projector = input.projector ?? undefined;
  if (videos.length === 0 && holdImages.length === 0 && !projector) return null;
  return { v: 1, videos, holdImages, projector };
}

export function unpackProjectorMedia(raw: unknown): {
  videos: PlaybookVideo[];
  holdImages: PlaybookHoldImage[];
  projector?: SceneProjectorSettingsV1;
} {
  if (!raw || typeof raw !== "object" || (raw as PlaybookProjectorMediaV1).v !== 1) {
    return { videos: [], holdImages: [] };
  }
  const bag = raw as PlaybookProjectorMediaV1;
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
