import type { ScriptStep, TheaterLayout } from "../shared/types/script";
import type { SceneLightFadersDataV1 } from "../features/scene/model/scene-slice";
import { applySceneFaderBindingsToSpotlights } from "../features/theater/model/theater-light-fader-bindings";
import { collectTheaterOfflineAssets } from "../features/theater/model/theater-offline-assets";
import { decodeOrchestraModelKey } from "../shared/project-assets/orchestraModelRef";
import { getDesktopApi } from "../shared/platform/desktop-api";
import {
  desktopReadProjectScene,
  desktopSaveProjectScene,
} from "../shared/platform/desktop-methods";
import { DEFAULT_THEATER_LAYOUT } from "../features/scene/model/scene-slice";
import { normalizePersistedTheaterLayout } from "../features/theater/model/theater-metrics";
import {
  collectMarkdownImagePrefetchTargets,
  httpUrlToImageFileName,
  pruneSceneImages,
  storageKeyToImageBasename,
} from "../shared/utils/markdownImages";
import { getPlayUrl } from "./api/files";

function isHttpUrl(u: string | undefined | null): boolean {
  return Boolean(u && /^https?:\/\//i.test(String(u).trim()));
}

function normalizeLightChannelsLoose(raw: unknown): string[] {
  if (!Array.isArray(raw)) return Array.from({ length: 8 }, () => "");
  return Array.from({ length: Math.max(8, raw.length) }, (_, i) => String(raw[i] ?? ""));
}

/**
 * После sync/pull с сервера: скачивает в папку проекта треки плейлиста и звуки по remoteUrl,
 * иконки звуков, а также все картинки из маркдауна шагов: `images` в script.json,
 * `orchestra-image:…`, относительные `./images/…` и прямые `https://…` в `![…](…)`.
 * Затем перезаписывает script.json и возвращает payload для hydrate.
 */
export async function prefetchDesktopOfflineAfterSync(args: {
  accessToken: string;
  projectSlug: string;
  projectId: string | null;
  minimalSceneData: {
    name?: string;
    playlist?: any[];
    sounds?: any[];
    sceneRoles?: unknown;
    lightFaders?: unknown;
    lightPrograms?: unknown;
  };
  normalizedSteps: ScriptStep[];
  normalizedLayout: TheaterLayout;
  normalizedLightChannels: string[];
}): Promise<{
  downloaded: number;
  skipped: number;
  errors: string[];
  rehydratePayload: Record<string, unknown> | null;
}> {
  const desktop = getDesktopApi();
  const errors: string[] = [];
  let downloaded = 0;
  let skipped = 0;

  if (!desktop?.invoke) {
    return {
      downloaded: 0,
      skipped: 0,
      errors: [],
      rehydratePayload: null,
    };
  }

  const invoke = desktop.invoke.bind(desktop) as (
    channel: string,
    payload: Record<string, unknown>,
  ) => Promise<any>;

  const downloadOne = async (opts: {
    kind: "playlist" | "sound" | "sound-icon" | "image" | "model" | "decor-texture";
    fileName: string;
    url: string;
  }) => {
    const r = await invoke("download-remote-asset", {
      projectName: args.projectSlug,
      projectId: args.projectId,
      kind: opts.kind,
      fileName: opts.fileName,
      url: opts.url,
      accessToken: args.accessToken,
    });
    if (!r?.ok) {
      errors.push(`${opts.kind} ${opts.fileName}: ${r?.error ?? "unknown"}`);
      return { ok: false as const, skipped: false };
    }
    if (r.skipped) skipped += 1;
    else downloaded += 1;
    return { ok: true as const, absolutePath: r.absolutePath as string, skipped: Boolean(r.skipped) };
  };

  try {
    const base =
      (await desktop.readProjectScene?.(args.projectSlug, "script")) ?? {};

    const playlist = Array.isArray(args.minimalSceneData.playlist)
      ? args.minimalSceneData.playlist.map((t: any) => ({ ...t }))
      : [];
    for (let i = 0; i < playlist.length; i += 1) {
      const t = playlist[i];
      const url = t?.remoteUrl;
      const fn = String(t?.file ?? "").trim();
      if (!fn || !isHttpUrl(url)) continue;
      const res = await downloadOne({ kind: "playlist", fileName: fn, url: String(url) });
      if (res.ok && res.absolutePath && !res.skipped) {
        playlist[i] = { ...t, filePath: res.absolutePath };
      }
    }

    const sounds = Array.isArray(args.minimalSceneData.sounds)
      ? args.minimalSceneData.sounds.map((s: any) => ({ ...s }))
      : [];
    for (let i = 0; i < sounds.length; i += 1) {
      let s = sounds[i];
      const soundUrl = s?.remoteUrl;
      const fn = String(s?.file ?? "").trim();
      if (fn && isHttpUrl(soundUrl)) {
        const res = await downloadOne({ kind: "sound", fileName: fn, url: String(soundUrl) });
        if (res.ok && res.absolutePath && !res.skipped) {
          s = { ...s, filePath: res.absolutePath };
        }
      }
      const iconUrl = s?.iconRemoteUrl;
      const iconFn = String(s?.icon ?? "").trim();
      if (iconFn && isHttpUrl(iconUrl)) {
        await downloadOne({
          kind: "sound-icon",
          fileName: iconFn,
          url: String(iconUrl),
        });
      }
      sounds[i] = s;
    }

    const baseImages =
      base && typeof base === "object" && (base as any).images && typeof (base as any).images === "object"
        ? { ...(base as any).images }
        : {};
    const pruned = pruneSceneImages(baseImages, args.normalizedSteps) ?? {};
    const images: Record<string, { remoteKey?: string; remoteUrl?: string }> = { ...pruned };

    const imgTargets = collectMarkdownImagePrefetchTargets(args.normalizedSteps);
    for (const t of imgTargets) {
      if (t.kind === "orchestra") {
        const bn = storageKeyToImageBasename(t.key);
        if (!bn) continue;
        try {
          const { url } = await getPlayUrl(args.accessToken, t.key);
          const u = String(url ?? "").trim();
          if (!u) continue;
          images[bn] = { ...images[bn], remoteKey: t.key, remoteUrl: u };
        } catch {
          /* offline / expired token — пропускаем, частичный кэш лучше чем падение */
        }
      } else if (t.kind === "http") {
        const bn = httpUrlToImageFileName(t.url);
        images[bn] = { ...images[bn], remoteUrl: t.url };
      }
    }

    for (const name of Object.keys(images)) {
      const meta = images[name];
      const u = meta?.remoteUrl;
      if (!u) continue;
      const urlStr = String(u).trim();
      if (!isHttpUrl(urlStr) && !urlStr.startsWith("/")) continue;
      await downloadOne({ kind: "image", fileName: name, url: urlStr });
    }

    const theaterOffline = collectTheaterOfflineAssets(args.normalizedSteps);
    for (const asset of theaterOffline.assets) {
      if (asset.kind === "model") {
        const orchestraKey = decodeOrchestraModelKey(asset.relativePath);
        if (orchestraKey) {
          try {
            const { url } = await getPlayUrl(args.accessToken, orchestraKey);
            const u = String(url ?? "").trim();
            if (isHttpUrl(u)) {
              await downloadOne({
                kind: "model",
                fileName: asset.fileName,
                url: u,
              });
            }
          } catch {
            /* offline / expired token */
          }
          continue;
        }
      }
      if (!asset.remoteUrl || !isHttpUrl(asset.remoteUrl)) continue;
      await downloadOne({
        kind: asset.kind === "model" ? "model" : "decor-texture",
        fileName: asset.fileName,
        url: asset.remoteUrl,
      });
    }

    const stepsForOffline = applySceneFaderBindingsToSpotlights(
      args.normalizedSteps,
      args.minimalSceneData.lightFaders as SceneLightFadersDataV1 | null | undefined,
    );

    const payload: Record<string, unknown> = {
      ...base,
      name: args.minimalSceneData.name ?? (base as any)?.name ?? "script",
      steps: stepsForOffline,
      theaterLayout: args.normalizedLayout,
      lightChannels: args.normalizedLightChannels,
      playlist,
      sounds,
      sceneRoles: args.minimalSceneData.sceneRoles ?? (base as any)?.sceneRoles,
      lightFaders: args.minimalSceneData.lightFaders ?? (base as any)?.lightFaders,
      lightPrograms: args.minimalSceneData.lightPrograms ?? (base as any)?.lightPrograms,
      images: Object.keys(images).length ? images : (base as any)?.images,
      theaterOfflineManifest: {
        modelCount: theaterOffline.modelCount,
        textureCount: theaterOffline.textureCount,
        remoteCount: theaterOffline.remoteCount,
        assets: theaterOffline.assets.map((item) => ({
          kind: item.kind,
          fileName: item.fileName,
          relativePath: item.relativePath,
          hasRemote: Boolean(item.remoteUrl),
        })),
      },
    };

    const saveRes = await desktopSaveProjectScene(desktop, args.projectSlug, "script", payload, {
      skipOutbox: true,
    });
    if (!saveRes?.ok) {
      errors.push(`saveProjectScene: ${saveRes?.error ?? "failed"}`);
      return { downloaded, skipped, errors, rehydratePayload: null };
    }

    const fresh = await desktopReadProjectScene(desktop, args.projectSlug, "script");
    if (!fresh || typeof fresh !== "object") {
      return { downloaded, skipped, errors, rehydratePayload: null };
    }

    const f = fresh as any;
    const rawLayout = (f.theaterLayout as TheaterLayout | undefined) ?? args.normalizedLayout;
    const theaterLayout = rawLayout
      ? normalizePersistedTheaterLayout(rawLayout)
      : DEFAULT_THEATER_LAYOUT;
    const lc = Array.isArray(f.lightChannels)
      ? normalizeLightChannelsLoose(f.lightChannels)
      : args.normalizedLightChannels;

    const sceneData = {
      name: f.name,
      playlist: Array.isArray(f.playlist) ? f.playlist : [],
      sounds: Array.isArray(f.sounds) ? f.sounds : [],
      sceneRoles: f.sceneRoles,
      lightFaders: f.lightFaders,
      lightPrograms: f.lightPrograms,
      images: f.images && typeof f.images === "object" ? f.images : undefined,
    };

    const stepsOut = applySceneFaderBindingsToSpotlights(
      Array.isArray(f.steps) && f.steps.length ? (f.steps as ScriptStep[]) : stepsForOffline,
      sceneData.lightFaders as SceneLightFadersDataV1 | null | undefined,
    );

    const rehydratePayload: Record<string, unknown> = {
      sceneData,
      steps: stepsOut,
      theaterLayout,
      isSceneReady: true,
      serverShadow: {
        sceneData,
        steps: stepsOut,
        theaterLayout,
        lightChannels: lc,
      },
    };

    return { downloaded, skipped, errors, rehydratePayload };
  } catch (e: any) {
    errors.push(e?.message ?? String(e));
    return { downloaded, skipped, errors, rehydratePayload: null };
  }
}
