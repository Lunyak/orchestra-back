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
const jsonCaches = new Map<
  string,
  { script?: Record<string, unknown>; notesRun?: Record<string, unknown> }
>();
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
  jsonCaches.delete(projectSlug);
}

async function readJsonFileHandle(
  handle: FileSystemFileHandle,
): Promise<Record<string, unknown> | null> {
  try {
    const file = await handle.getFile();
    const parsed = JSON.parse(await file.text()) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function readJsonFromDir(
  handle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<Record<string, unknown> | null> {
  try {
    const fileHandle = await handle.getFileHandle(fileName);
    return readJsonFileHandle(fileHandle);
  } catch {
    return null;
  }
}

async function readScriptJsonFromDir(
  handle: FileSystemDirectoryHandle,
): Promise<Record<string, unknown> | null> {
  const direct = await readJsonFromDir(handle, "script.json");
  if (direct) return direct;
  try {
    const modules = await handle.getDirectoryHandle("scenesModules");
    const fromModules = await readJsonFromDir(modules, "script.json");
    if (fromModules) return fromModules;
  } catch {
    /* no scenesModules */
  }
  try {
    const legacy = await handle.getDirectoryHandle("scenes");
    return readJsonFromDir(legacy, "script.json");
  } catch {
    return null;
  }
}

export function readBrowserPickedProjectJson(
  projectSlug: string,
  kind: "script" | "notes-run",
): Record<string, unknown> | null {
  const entry = jsonCaches.get(projectSlug);
  if (!entry) return null;
  return kind === "script" ? (entry.script ?? null) : (entry.notesRun ?? null);
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

async function walkDirectoryFiles(
  handle: FileSystemDirectoryHandle,
  depth: number,
  maxDepth: number,
  onFile: (file: File) => void,
): Promise<void> {
  for await (const entry of handle.values()) {
    if (entry.kind === "file") {
      const fileHandle = entry as FileSystemFileHandle;
      onFile(await fileHandle.getFile());
      continue;
    }
    if (entry.kind === "directory" && depth < maxDepth) {
      await walkDirectoryFiles(entry as FileSystemDirectoryHandle, depth + 1, maxDepth, onFile);
    }
  }
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

  await walkDirectoryFiles(handle, 0, 4, (file) => {
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
  });

  videos.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  holdImages.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  sounds.sort((a, b) => a.title.localeCompare(b.title, "ru"));

  const notesRun = await readJsonFromDir(handle, "notes-run.json");
  const script = await readScriptJsonFromDir(handle);
  jsonCaches.set(projectSlug, {
    notesRun: notesRun ?? undefined,
    script: script ?? undefined,
  });

  if (videos.length === 0 && holdImages.length === 0 && sounds.length === 0 && !notesRun && !script) {
    return {
      ok: false,
      folderName: handle.name,
      mediaRoot: handle.name,
      videos: [],
      holdImages: [],
      sounds: [],
      error: "В папке нет mp4, jpg, mp3, script.json или notes-run.json",
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
    const picker = window.showDirectoryPicker;
    if (!picker) {
      return {
        ok: false,
        videos: [],
        holdImages: [],
        error: "Ваш браузер не поддерживает выбор папки (нужен Chrome или Edge)",
      };
    }
    const handle = await picker({ mode: "read" });
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
