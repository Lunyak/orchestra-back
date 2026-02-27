import { syncPull, syncPullScene } from "./api";
import { getDesktopApi } from "../shared/platform/desktop-api";
import { flushDesktopOutbox } from "./desktopOutbox";

const HEAVY_KEYS = ["steps", "playlist", "sounds", "lightChannels", "theaterLayout"] as const;
type HeavyKey = (typeof HEAVY_KEYS)[number];

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

export async function resyncDesktopProject(
  accessToken: string,
  projectSlug: string,
): Promise<{
  updatedScenes: number;
  totalScenes: number;
}> {
  const api = getDesktopApi();
  if (!api?.readProjectScene || !api?.saveProjectScene) {
    throw new Error("Desktop API недоступен");
  }

  // Сначала стараемся выгрузить локальные изменения (outbox), чтобы не потерять их при pull.
  await flushDesktopOutbox(accessToken, projectSlug);

  const localSceneNames: string[] =
    typeof (api as any).listProjectScenes === "function"
      ? await (api as any).listProjectScenes(projectSlug)
      : [];

  // Optimized: pull scenes one-by-one (no full project snapshot).
  // Fallback to legacy syncPull if endpoint is unavailable.
  let updatedScenes = 0;
  let totalScenes = 0;

  const sceneNamesToSync = (localSceneNames ?? [])
    .map((x) => String(x ?? "").replace(/\.json$/i, "").trim())
    .filter(Boolean);

  try {
    for (const sceneName of sceneNamesToSync) {
      totalScenes += 1;
      const { scene } = await syncPullScene(accessToken, projectSlug, sceneName);
      const serverRaw = scene?.rawJson ?? {};
      const localRaw = (await api.readProjectScene(projectSlug, sceneName)) ?? {};

      // "Smart" merge:
      // - server is source of truth for heavy structures
      // - keep local-only meta keys (if any)
      // - preserve desktop-only sound.filePath
      const next: any = { ...(isPlainObject(localRaw) ? localRaw : {}) };

      const metaLocal = pickMeta(localRaw);
      const metaServer = pickMeta(serverRaw);
      Object.assign(next, metaLocal, metaServer);

      let changed = !deepEqualByStableStringify(metaLocal, metaServer);

      for (const key of HEAVY_KEYS) {
        if (key === "sounds") {
          const mergedSounds = mergeSoundsPreservingLocalFilePath(
            (localRaw as any)?.sounds,
            (serverRaw as any)?.sounds,
          );
          if (
            !deepEqualByStableStringify(
              (localRaw as any)?.sounds ?? null,
              mergedSounds,
            )
          ) {
            next.sounds = mergedSounds;
            changed = true;
          }
          continue;
        }

        const localV = (localRaw as any)?.[key];
        const serverV = (serverRaw as any)?.[key];
        if (!deepEqualByStableStringify(localV ?? null, serverV ?? null)) {
          next[key] = serverV ?? null;
          changed = true;
        }
      }

      if (changed) {
        await api.saveProjectScene(projectSlug, sceneName, next, {
          skipOutbox: true,
        });
        updatedScenes += 1;
      }
    }

    return { updatedScenes, totalScenes };
  } catch (err) {
    // Legacy fallback: if per-scene pull isn't available, do full project pull.
    console.warn("[resync] pull-scene failed, fallback to syncPull", err);
    const pull = await syncPull(accessToken, null, projectSlug);
    const serverScenes = Array.isArray(pull?.scenes) ? pull.scenes : [];
    const related = serverScenes.filter(
      (s: any) => String(s?.projectId ?? "").trim() && s?.rawJson,
    );

    totalScenes = related.length;
    for (const s of related) {
      const sceneId = String(s.id ?? "");
      const parts = sceneId.split(":");
      const sceneName = parts.length >= 2 ? parts.slice(1).join(":") : "";
      if (!sceneName) continue;
      const serverRaw = s.rawJson ?? {};
      const localRaw = (await api.readProjectScene(projectSlug, sceneName)) ?? {};
      const next: any = { ...(isPlainObject(localRaw) ? localRaw : {}) };

      const metaLocal = pickMeta(localRaw);
      const metaServer = pickMeta(serverRaw);
      Object.assign(next, metaLocal, metaServer);
      let changed = !deepEqualByStableStringify(metaLocal, metaServer);

      for (const key of HEAVY_KEYS) {
        if (key === "sounds") {
          const mergedSounds = mergeSoundsPreservingLocalFilePath(
            (localRaw as any)?.sounds,
            (serverRaw as any)?.sounds,
          );
          if (
            !deepEqualByStableStringify(
              (localRaw as any)?.sounds ?? null,
              mergedSounds,
            )
          ) {
            next.sounds = mergedSounds;
            changed = true;
          }
          continue;
        }
        const localV = (localRaw as any)?.[key];
        const serverV = (serverRaw as any)?.[key];
        if (!deepEqualByStableStringify(localV ?? null, serverV ?? null)) {
          next[key] = serverV ?? null;
          changed = true;
        }
      }

      if (changed) {
        await api.saveProjectScene(projectSlug, sceneName, next, {
          skipOutbox: true,
        });
        updatedScenes += 1;
      }
    }
    return { updatedScenes, totalScenes };
  }
}
