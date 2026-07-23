import { dispatchSyncPull, dispatchSyncPullScene } from "../shared/api/rtk/sync-dispatch";
import { getDesktopApi } from "../shared/platform/desktop-api";
import { flushDesktopOutbox } from "./desktopOutbox";
import {
  normalizeLightChannelsFromServer,
  normalizeScriptScenesFromSyncApi,
  normalizeTheaterLayoutFromServer,
  readPlaybookScenes,
} from "../features/playbook/model/playbook-normalize";
import { pullPlaybooksFromSync, pullScriptScenesFromSync, syncPullIncludeForPlaybook, syncRowMatchesPlaybook } from "./sync-pull-normalize";

const HEAVY_KEYS = ["scenes"] as const;

function stableStringify(value: any): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number" || t === "boolean") return JSON.stringify(value);
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  if (t === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function deepEqualByStableStringify(a: any, b: any): boolean {
  return stableStringify(a) === stableStringify(b);
}

function isPlainObject(v: any): v is Record<string, any> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function pickMeta(obj: any): Record<string, any> {
  if (!isPlainObject(obj)) return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if ((HEAVY_KEYS as readonly string[]).includes(k)) continue;
    if (k === "steps") continue;
    out[k] = v;
  }
  return out;
}

function mergeSoundsPreservingLocalFilePath(localSounds: any, serverSounds: any) {
  const local = Array.isArray(localSounds) ? localSounds : [];
  const server = Array.isArray(serverSounds) ? serverSounds : [];
  const localById = new Map<number, any>();
  local.forEach((s: any) => {
    if (typeof s?.id === "number") localById.set(s.id, s);
  });
  return server.map((s: any) => {
    const id = typeof s?.id === "number" ? s.id : null;
    const prev = id != null ? localById.get(id) : null;
    const filePath = prev?.filePath;
    return filePath ? { ...s, filePath } : s;
  });
}

function buildServerSceneRawFromPull(args: {
  scenes?: unknown;
  theaterLayout?: unknown;
  lightChannels?: unknown;
  scene?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const scene = args.scene ?? null;
  const normalizedLayout = normalizeTheaterLayoutFromServer(args.theaterLayout);
  const normalizedLightChannels = Array.isArray(args.lightChannels)
    ? normalizeLightChannelsFromServer(args.lightChannels)
    : undefined;
  const scriptScenesRaw = args.scenes;

  return {
    scenes: normalizeScriptScenesFromSyncApi(scriptScenesRaw),
    ...(normalizedLayout ? { theaterLayout: normalizedLayout } : {}),
    ...(normalizedLightChannels ? { lightChannels: normalizedLightChannels } : {}),
    ...(scene?.lightFaders ? { lightFaders: scene.lightFaders } : {}),
    ...(scene?.lightPrograms ? { lightPrograms: scene.lightPrograms } : {}),
    ...(scene?.lightChannelRoles ? { lightChannelRoles: scene.lightChannelRoles } : {}),
    ...(scene?.projectorMedia ? { projectorMedia: scene.projectorMedia } : {}),
    ...(scene?.sceneRoles ? { sceneRoles: scene.sceneRoles } : {}),
  };
}

export async function resyncDesktopProject(
  accessToken: string,
  projectSlug: string,
): Promise<{
  updatedScenes: number;
  totalScenes: number;
}> {
  const api = getDesktopApi();
  if (!api?.readProjectPlaybook || !api?.saveProjectPlaybook) {
    throw new Error("Desktop API недоступен");
  }

  // Сначала стараемся выгрузить локальные изменения (outbox), чтобы не потерять их при pull.
  await flushDesktopOutbox(accessToken, projectSlug);

  const localSceneNames: string[] =
    typeof (api as any).listProjectScenes === "function"
      ? await (api as any).listProjectScenes(projectSlug)
      : [];

  let updatedScenes = 0;
  let totalScenes = 0;

  const sceneNamesToSync = (localSceneNames ?? [])
    .map((x) => String(x ?? "").replace(/\.json$/i, "").trim())
    .filter(Boolean);

  try {
    for (const sceneName of sceneNamesToSync) {
      totalScenes += 1;
      const pull = await dispatchSyncPullScene({
        projectSlug,
        sceneName,
        include: {
          scenes: true,
          theaterLayout: true,
          lightChannels: true,
        },
      });
      const serverRaw = buildServerSceneRawFromPull({
        scenes: pullScriptScenesFromSync(pull),
        theaterLayout: pull.theaterLayout,
        lightChannels: pull.lightChannels,
        scene: pull.scene as Record<string, unknown> | null,
      });
      const localRaw = (await api.readProjectPlaybook(projectSlug, sceneName)) ?? {};

      const next: any = { ...(isPlainObject(localRaw) ? localRaw : {}) };

      const metaLocal = pickMeta(localRaw);
      const metaServer = pickMeta(serverRaw);
      if (Array.isArray(metaServer.sounds)) {
        metaServer.sounds = mergeSoundsPreservingLocalFilePath(
          metaLocal.sounds,
          metaServer.sounds,
        );
      }
      Object.assign(next, metaLocal, metaServer);

      let changed = !deepEqualByStableStringify(metaLocal, metaServer);

      const localScenes = readPlaybookScenes(isPlainObject(localRaw) ? localRaw : null);
      const serverScenes = Array.isArray((serverRaw as any)?.scenes)
        ? (serverRaw as any).scenes
        : [];
      if (!deepEqualByStableStringify(localScenes, serverScenes)) {
        next.scenes = serverScenes;
        delete next.steps;
        changed = true;
      }

      if (changed) {
        await api.saveProjectPlaybook(projectSlug, sceneName, next, {
          skipOutbox: true,
        });
        updatedScenes += 1;
      }
    }

    return { updatedScenes, totalScenes };
  } catch (err) {
    console.warn("[resync] pull-scene failed, fallback to syncPull", err);
    const pull = await dispatchSyncPull({
      projectSlug,
      lastSyncAt: null,
      include: syncPullIncludeForPlaybook(),
    });
    const serverPlaybooks = pullPlaybooksFromSync(pull);
    const related = serverPlaybooks.filter((s: any) => String(s?.projectId ?? "").trim());

    totalScenes = related.length;
    for (const s of related) {
      const sceneId = String(s.id ?? "");
      const parts = sceneId.split(":");
      const sceneName = parts.length >= 2 ? parts.slice(1).join(":") : "";
      if (!sceneName) continue;
      const pulledScriptScenes = pullScriptScenesFromSync(pull).filter((st) =>
        syncRowMatchesPlaybook(st, sceneId),
      );
      const theaterLayoutRow = (Array.isArray((pull as any)?.theaterLayouts)
        ? (pull as any).theaterLayouts
        : []
      ).find((row: unknown) => syncRowMatchesPlaybook(row, sceneId));
      const lightChannelRows = (Array.isArray((pull as any)?.lightChannels)
        ? (pull as any).lightChannels
        : []
      ).filter((row: unknown) => syncRowMatchesPlaybook(row, sceneId));

      const serverRaw = buildServerSceneRawFromPull({
        scenes: pulledScriptScenes,
        theaterLayout: theaterLayoutRow,
        lightChannels: lightChannelRows,
        scene: s as Record<string, unknown>,
      });
      const localRaw = (await api.readProjectPlaybook(projectSlug, sceneName)) ?? {};
      const next: any = { ...(isPlainObject(localRaw) ? localRaw : {}) };

      const metaLocal = pickMeta(localRaw);
      const metaServer = pickMeta(serverRaw);
      if (Array.isArray(metaServer.sounds)) {
        metaServer.sounds = mergeSoundsPreservingLocalFilePath(
          metaLocal.sounds,
          metaServer.sounds,
        );
      }
      Object.assign(next, metaLocal, metaServer);
      let changed = !deepEqualByStableStringify(metaLocal, metaServer);

      const localScenes = readPlaybookScenes(isPlainObject(localRaw) ? localRaw : null);
      const serverScenes = Array.isArray((serverRaw as any)?.scenes)
        ? (serverRaw as any).scenes
        : [];
      if (!deepEqualByStableStringify(localScenes, serverScenes)) {
        next.scenes = serverScenes;
        delete next.steps;
        changed = true;
      }

      if (changed) {
        await api.saveProjectPlaybook(projectSlug, sceneName, next, {
          skipOutbox: true,
        });
        updatedScenes += 1;
      }
    }
    return { updatedScenes, totalScenes };
  }
}

/** Обёртка для PlatformContext: токен берётся из localStorage. */
export async function resyncDesktopProjectFromSettings(
  projectSlug: string,
): Promise<{ updatedScenes: number; totalScenes: number }> {
  const accessToken =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (!accessToken) {
    throw new Error("Нужно войти в аккаунт перед resync");
  }
  return resyncDesktopProject(accessToken, projectSlug);
}
