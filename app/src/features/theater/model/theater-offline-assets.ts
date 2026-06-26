import type { ScriptScene, TheaterModel } from "../../../shared/types/script";
import { decodeOrchestraModelKey } from "../../../shared/project-assets/orchestraModelRef";
import { readSceneTheaterModels } from "./theater-scene-models";
import {
  getDecorTextureFilePath,
  isDecorTexturePreset,
} from "./theater-decor-textures";

export type TheaterOfflineAssetKind = "model" | "decor-texture";

export type TheaterOfflineAsset = {
  kind: TheaterOfflineAssetKind;
  /** Safe file name for cache folder */
  fileName: string;
  /** Path inside project folder (models/… or images/…) */
  relativePath: string;
  /** Remote URL when available (http decor textures) */
  remoteUrl?: string;
};

export type TheaterOfflineManifest = {
  assets: TheaterOfflineAsset[];
  modelCount: number;
  textureCount: number;
  remoteCount: number;
};

function safeFileName(relativePath: string): string {
  return relativePath.replace(/[/\\]/g, "_").replace(/^\.+/, "") || "asset.bin";
}

function pushUnique(
  list: TheaterOfflineAsset[],
  seen: Set<string>,
  asset: TheaterOfflineAsset,
) {
  const key = `${asset.kind}:${asset.relativePath}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(asset);
}

function collectFromModel(
  model: TheaterModel,
  list: TheaterOfflineAsset[],
  seen: Set<string>,
) {
  if (model.type === "file" && model.file?.trim()) {
    const fileRef = model.file.trim();
    const orchestraKey = decodeOrchestraModelKey(fileRef);
    if (/^https?:\/\//i.test(fileRef)) {
      pushUnique(list, seen, {
        kind: "model",
        fileName: safeFileName(fileRef),
        relativePath: fileRef,
        remoteUrl: fileRef,
      });
    } else if (orchestraKey) {
      pushUnique(list, seen, {
        kind: "model",
        fileName: safeFileName(orchestraKey),
        relativePath: fileRef,
      });
    } else {
      const relativePath = fileRef.replace(/^\/+/, "");
      pushUnique(list, seen, {
        kind: "model",
        fileName: safeFileName(relativePath),
        relativePath,
      });
    }
  }
  const textureRef = model.decorTexture?.trim();
  if (!textureRef || isDecorTexturePreset(textureRef)) return;
  if (/^data:image\//i.test(textureRef)) return;

  if (/^https?:\/\//i.test(textureRef)) {
    const relativePath = `images/theater-${safeFileName(textureRef)}`;
    pushUnique(list, seen, {
      kind: "decor-texture",
      fileName: safeFileName(relativePath),
      relativePath,
      remoteUrl: textureRef,
    });
    return;
  }

  const fromFilePrefix = getDecorTextureFilePath(textureRef);
  const relativePath = (fromFilePrefix ?? textureRef).replace(/^\/+/, "");
  pushUnique(list, seen, {
    kind: "decor-texture",
    fileName: safeFileName(relativePath),
    relativePath,
  });
}

export function collectTheaterOfflineAssets(scenes: ScriptScene[]): TheaterOfflineManifest {
  const assets: TheaterOfflineAsset[] = [];
  const seen = new Set<string>();

  for (const scene of scenes) {
    for (const model of readSceneTheaterModels(scene)) {
      collectFromModel(model, assets, seen);
    }
  }

  const modelCount = assets.filter((item) => item.kind === "model").length;
  const textureCount = assets.filter((item) => item.kind === "decor-texture").length;
  const remoteCount = assets.filter((item) => item.remoteUrl).length;

  return { assets, modelCount, textureCount, remoteCount };
}
