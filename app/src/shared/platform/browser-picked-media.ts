/** Браузер: выбор папки через showDirectoryPicker, воспроизведение через blob: URL. */

const IDB_NAME = "orchestra-browser-media-v2";
const handleKey = (projectSlug: string) => `folder-handle:${projectSlug}`;

const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".mkv"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac"]);

export type BrowserPickedScan = {
  ok: boolean;
  folderName?: string;
  mediaRoot?: string;
  videos: Array<{ id: number; title: string; file: string; filePath?: string }>;
  holdImages: Array<{ id: number; title: string; file: string; filePath?: string }>;
  sounds?: Array<{ id: number; title: string; file: string; filePath?: string }>;
  error?: string;
};

type BlobCache = {
  byName: Map<string, string>;
  byTitle: Map<string, string>;
};

const blobCaches = new Map<string, BlobCache>();
let activeProjectSlug: string | null = null;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function revokeBlobCache(projectSlug: string): void {
  const cache = blobCaches.get(projectSlug);
  if (!cache) return;
  for (const url of new Set(cache.byName.values())) {
    URL.revokeObjectURL(url);
  }
  blobCaches.delete(projectSlug);
}

export function setBrowserPickedMediaProject(projectSlug: string | null): void {
  activeProjectSlug = projectSlug;
}

export function isBrowserFolderPickerSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function hasBrowserPickedMedia(projectSlug?: string): boolean {
  const slug = projectSlug ?? activeProjectSlug;
  if (!slug) return false;
  return (blobCaches.get(slug)?.byName.size ?? 0) > 0;
}

export function resolveBrowserPickedMediaUrl(
  fileName: string,
  titleHint?: string,
  projectSlug?: string,
): string | null {
  const slug = projectSlug ?? activeProjectSlug;
  const cache = slug ? blobCaches.get(slug) : undefined;
  if (!cache) return null;

  const file = String(fileName ?? "")
    .trim()
    .replace(/^.*[/\\]/, "");
  if (file) {
    const direct = cache.byName.get(file) ?? cache.byName.get(file.toLowerCase());
    if (direct) return direct;
  }
  const title = String(titleHint ?? "")
    .trim()
    .toLowerCase();
  if (title && cache.byTitle.has(title)) return cache.byTitle.get(title)!;
  return null;
}

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openMediaDb();
  return new Promise((resolve) => {
    const tx = db.transaction("kv", "readonly");
    const req = tx.objectStore("kv").get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function scanDirectoryHandle(
  projectSlug: string,
  handle: FileSystemDirectoryHandle,
): Promise<BrowserPickedScan> {
  revokeBlobCache(projectSlug);
  const cache: BlobCache = { byName: new Map(), byTitle: new Map() };
  blobCaches.set(projectSlug, cache);

  const videos: BrowserPickedScan["videos"] = [];
  const holdImages: BrowserPickedScan["holdImages"] = [];
  const sounds: NonNullable<BrowserPickedScan["sounds"]> = [];
  let videoId = 1;
  let holdId = 1;
  let soundId = 1;

  for await (const entry of handle.values()) {
    if (entry.kind !== "file") continue;
    const file = await entry.getFile();
    const ext = extOf(file.name);
    const title = file.name.replace(/\.[^.]+$/, "") || file.name;
    const blobUrl = URL.createObjectURL(file);
    cache.byName.set(file.name, blobUrl);
    cache.byName.set(file.name.toLowerCase(), blobUrl);
    cache.byTitle.set(title.toLowerCase(), blobUrl);

    if (VIDEO_EXT.has(ext)) {
      videos.push({ id: videoId++, title, file: file.name });
    } else if (IMAGE_EXT.has(ext)) {
      holdImages.push({ id: holdId++, title, file: file.name });
    } else if (AUDIO_EXT.has(ext)) {
      sounds.push({ id: soundId++, title, file: file.name });
    }
  }

  videos.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  holdImages.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  sounds.sort((a, b) => a.title.localeCompare(b.title, "ru"));

  if (videos.length === 0 && holdImages.length === 0 && sounds.length === 0) {
    return {
      ok: false,
      folderName: handle.name,
      mediaRoot: handle.name,
      videos: [],
      holdImages: [],
      sounds: [],
      error: "В папке нет mp4, jpg или mp3",
    };
  }

  return {
    ok: true,
    folderName: handle.name,
    mediaRoot: handle.name,
    videos,
    holdImages,
    sounds,
  };
}

export async function pickBrowserMediaFolder(projectSlug: string): Promise<BrowserPickedScan> {
  if (!projectSlug) {
    return { ok: false, videos: [], holdImages: [], error: "Проект не выбран" };
  }
  if (!isBrowserFolderPickerSupported()) {
    return {
      ok: false,
      videos: [],
      holdImages: [],
      error: "Ваш браузер не поддерживает выбор папки (нужен Chrome или Edge)",
    };
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: "read" });
    const permission = await handle.requestPermission({ mode: "read" });
    if (permission !== "granted") {
      return { ok: false, videos: [], holdImages: [], error: "Нет доступа к папке" };
    }
    await idbSet(handleKey(projectSlug), handle);
    activeProjectSlug = projectSlug;
    return scanDirectoryHandle(projectSlug, handle);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { ok: false, videos: [], holdImages: [], error: "Выбор папки отменён" };
    }
    return {
      ok: false,
      videos: [],
      holdImages: [],
      error: String((err as Error)?.message ?? err),
    };
  }
}

export async function restoreBrowserMediaFolder(projectSlug: string): Promise<BrowserPickedScan> {
  if (!projectSlug) {
    return { ok: false, videos: [], holdImages: [], error: "Проект не выбран" };
  }
  const handle = await idbGet<FileSystemDirectoryHandle>(handleKey(projectSlug));
  if (!handle) {
    return { ok: false, videos: [], holdImages: [], error: "Папка ещё не выбрана" };
  }
  try {
    const permission = await handle.requestPermission({ mode: "read" });
    if (permission !== "granted") {
      return { ok: false, videos: [], holdImages: [], error: "Нет доступа к папке" };
    }
    activeProjectSlug = projectSlug;
    return scanDirectoryHandle(projectSlug, handle);
  } catch (err) {
    return {
      ok: false,
      videos: [],
      holdImages: [],
      error: String((err as Error)?.message ?? err),
    };
  }
}

/** @deprecated Используйте scanProjectMediaFolder из project-media-folder.ts */
export async function resolveLocalMediaScan(projectSlug?: string): Promise<
  BrowserPickedScan & { source: "vite" | "browser" | "none" }
> {
  const { scanProjectMediaFolder } = await import("./project-media-folder");
  const scanned = await scanProjectMediaFolder(projectSlug ?? activeProjectSlug ?? "");
  return {
    ok: scanned.ok,
    source: scanned.source === "desktop" ? "vite" : scanned.source,
    mediaRoot: scanned.mediaRoot,
    folderName: scanned.folderName,
    videos: scanned.videos,
    holdImages: scanned.holdImages,
    sounds: scanned.sounds,
    error: scanned.error,
  };
}
