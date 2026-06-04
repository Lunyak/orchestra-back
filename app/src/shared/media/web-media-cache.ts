import { getPlayUrl } from "../../sync/api/files";
import type { PlaylistTrack } from "../types/playlist";
import { isOfflineNativePlatform } from "../platform/media-url";

const DB_NAME = "orchestra-web-media-cache";
const DB_VERSION = 1;
const STORE = "blobs";
const MAX_CACHE_BYTES = 400 * 1024 * 1024;

type CacheRecord = {
  key: string;
  blob: Blob;
  size: number;
  mimeType: string;
  updatedAt: number;
};

const objectUrlByKey = new Map<string, string>();

export function isWebMediaCacheEnabled(): boolean {
  return typeof indexedDB !== "undefined" && !isOfflineNativePlatform();
}

export function buildPlaylistCacheKey(
  projectSlug: string,
  track: Pick<PlaylistTrack, "id" | "file" | "remoteKey">,
): string {
  const file = String(track.file ?? "").trim();
  const remoteKey = String(track.remoteKey ?? "").trim();
  return `${projectSlug}:playlist:${track.id}:${file}:${remoteKey}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const request = run(store);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error("indexedDB request failed"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error("indexedDB transaction failed"));
      }),
  );
}

function revokeObjectUrlForKey(key: string) {
  const prev = objectUrlByKey.get(key);
  if (prev) {
    URL.revokeObjectURL(prev);
    objectUrlByKey.delete(key);
  }
}

export async function isWebMediaCached(key: string): Promise<boolean> {
  if (!isWebMediaCacheEnabled()) return false;
  try {
    const record = await withStore<CacheRecord | undefined>("readonly", (store) =>
      store.get(key),
    );
    return Boolean(record?.blob && record.blob.size > 0);
  } catch {
    return false;
  }
}

async function listCacheRecords(): Promise<CacheRecord[]> {
  return withStore<CacheRecord[]>("readonly", (store) => store.getAll());
}

async function pruneCacheIfNeeded() {
  const records = await listCacheRecords();
  let total = records.reduce((sum, item) => sum + item.size, 0);
  if (total <= MAX_CACHE_BYTES) return;

  records.sort((a, b) => a.updatedAt - b.updatedAt);
  for (const record of records) {
    if (total <= MAX_CACHE_BYTES * 0.85) break;
    await deleteWebMediaCache(record.key);
    total -= record.size;
  }
}

export async function deleteWebMediaCache(key: string): Promise<void> {
  revokeObjectUrlForKey(key);
  await withStore("readwrite", (store) => store.delete(key));
}

export async function putWebMediaCache(key: string, blob: Blob): Promise<void> {
  const record: CacheRecord = {
    key,
    blob,
    size: blob.size,
    mimeType: blob.type || "application/octet-stream",
    updatedAt: Date.now(),
  };
  revokeObjectUrlForKey(key);
  await withStore("readwrite", (store) => store.put(record));
  await pruneCacheIfNeeded();
}

export async function getCachedObjectUrl(key: string): Promise<string | null> {
  if (!isWebMediaCacheEnabled()) return null;
  const existing = objectUrlByKey.get(key);
  if (existing) return existing;

  try {
    const record = await withStore<CacheRecord | undefined>("readonly", (store) =>
      store.get(key),
    );
    if (!record?.blob || record.blob.size === 0) return null;
    const url = URL.createObjectURL(record.blob);
    objectUrlByKey.set(key, url);
    return url;
  } catch {
    return null;
  }
}

export async function resolvePlaylistFetchUrl(
  track: PlaylistTrack,
  accessToken: string | null,
): Promise<string | null> {
  const remote = String(track.remoteUrl ?? "").trim();
  if (/^https?:\/\//i.test(remote)) return remote;
  const key = String(track.remoteKey ?? "").trim();
  if (key && accessToken) {
    try {
      const { url } = await getPlayUrl(accessToken, key);
      if (url && /^https?:\/\//i.test(url)) return url;
    } catch {
      // fall through
    }
  }
  return remote || null;
}

export async function fetchAndCachePlaylistTrack(
  projectSlug: string,
  track: PlaylistTrack,
  accessToken: string | null,
): Promise<void> {
  if (!isWebMediaCacheEnabled()) return;

  const cacheKey = buildPlaylistCacheKey(projectSlug, track);
  if (await isWebMediaCached(cacheKey)) return;

  const fetchUrl = await resolvePlaylistFetchUrl(track, accessToken);
  if (!fetchUrl || !/^https?:\/\//i.test(fetchUrl)) {
    throw new Error("no fetch url");
  }

  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status}`);
  }
  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("empty blob");
  }
  await putWebMediaCache(cacheKey, blob);
}

export async function resolveWebPlaylistPlaybackUrl(
  projectSlug: string,
  track: PlaylistTrack,
  accessToken: string | null,
): Promise<string> {
  const cacheKey = buildPlaylistCacheKey(projectSlug, track);
  const cached = await getCachedObjectUrl(cacheKey);
  if (cached) return cached;

  const fetchUrl = await resolvePlaylistFetchUrl(track, accessToken);
  if (fetchUrl && /^https?:\/\//i.test(fetchUrl)) return fetchUrl;

  return String(track.file ?? "").trim() || "";
}
