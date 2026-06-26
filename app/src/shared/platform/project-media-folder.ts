/**
 * Папка с медиа для проекта (видео, заставки, mp3) — как «Open Folder» в VS Code.
 * Путь хранится per-project; на диске Electron — также в media-source.json.
 */

import type { PlaylistTrack } from "../types/playlist";
import { getDesktopApi } from "./desktop-api";
import {
  isBrowserFolderPickerSupported,
  pickBrowserMediaFolder,
  restoreBrowserMediaFolder,
  type BrowserPickedScan,
} from "./browser-picked-media";
import {
  fetchDevScannedMedia,
  fetchDevMediaRootProjectJson,
  mergeDevScannedProjectorMedia,
  registerDevProjectMediaRoot,
  type DevScannedMedia,
} from "./local-project-dev";
import { readBrowserPickedProjectJson } from "./browser-picked-media";

export type ProjectMediaFolderInfo = {
  path: string | null;
  label: string | null;
};

export type ProjectMediaScan = BrowserPickedScan & {
  source: "desktop" | "vite" | "browser" | "none";
  sounds?: Array<{ id: number; title: string; file: string; filePath?: string }>;
};

const STORAGE_KEY = (projectSlug: string) => `orchestra-project-media-folder:${projectSlug}`;

export function readStoredProjectMediaFolder(projectSlug: string): ProjectMediaFolderInfo {
  if (!projectSlug || typeof window === "undefined") {
    return { path: null, label: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY(projectSlug));
    if (!raw) return { path: null, label: null };
    const parsed = JSON.parse(raw) as { path?: string; label?: string };
    const path = String(parsed?.path ?? "").trim() || null;
    const label = String(parsed?.label ?? "").trim() || (path ? basename(path) : null);
    return { path, label };
  } catch {
    return { path: null, label: null };
  }
}

export function writeStoredProjectMediaFolder(
  projectSlug: string,
  info: ProjectMediaFolderInfo,
): void {
  if (!projectSlug || typeof window === "undefined") return;
  try {
    if (!info.path) {
      localStorage.removeItem(STORAGE_KEY(projectSlug));
      return;
    }
    localStorage.setItem(
      STORAGE_KEY(projectSlug),
      JSON.stringify({
        path: info.path,
        label: info.label ?? basename(info.path),
      }),
    );
    void registerDevProjectMediaRoot(projectSlug, info.path);
  } catch {
    /* ignore */
  }
}

function basename(value: string): string {
  const normalized = String(value ?? "").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

/** JSON из выбранной папки: notes-run.json, script.json (корень или scenesModules/). */
export async function readProjectFolderJson(
  projectSlug: string,
  kind: "script" | "notes-run",
): Promise<Record<string, unknown> | null> {
  if (!projectSlug) return null;

  const fromBrowser = readBrowserPickedProjectJson(projectSlug, kind);
  if (fromBrowser) return fromBrowser;

  const stored = readStoredProjectMediaFolder(projectSlug);
  if (stored.path && looksLikeFilesystemPath(stored.path)) {
    const fromMediaRoot = await fetchDevMediaRootProjectJson(projectSlug, kind, stored.path);
    if (fromMediaRoot) return fromMediaRoot;
  }

  return null;
}

function looksLikeFilesystemPath(value: string): boolean {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  return /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(trimmed);
}

export async function getProjectMediaFolderInfo(
  projectSlug: string,
): Promise<ProjectMediaFolderInfo> {
  const stored = readStoredProjectMediaFolder(projectSlug);
  if (stored.path) return stored;

  const api = getDesktopApi();
  if (api?.getProjectMediaFolder) {
    try {
      const res = (await api.getProjectMediaFolder(projectSlug)) as {
        ok?: boolean;
        path?: string;
        label?: string;
      };
      if (res?.ok && res.path) {
        const info = { path: res.path, label: res.label ?? basename(res.path) };
        writeStoredProjectMediaFolder(projectSlug, info);
        return info;
      }
    } catch {
      /* ignore */
    }
  }
  return { path: null, label: null };
}

function toScanResult(
  data: DevScannedMedia | BrowserPickedScan,
  source: ProjectMediaScan["source"],
): ProjectMediaScan {
  return {
    ok: Boolean(data.ok),
    source,
    mediaRoot: data.mediaRoot,
    folderName:
      "folderName" in data && data.folderName
        ? data.folderName
        : data.mediaRoot
          ? basename(data.mediaRoot)
          : undefined,
    videos: Array.isArray(data.videos) ? data.videos : [],
    holdImages: Array.isArray(data.holdImages) ? data.holdImages : [],
    sounds: Array.isArray((data as DevScannedMedia).sounds)
      ? (data as DevScannedMedia).sounds
      : [],
    error: data.error,
  };
}

/** Сканировать привязанную к проекту папку (без диалога). */
export async function scanProjectMediaFolder(projectSlug: string): Promise<ProjectMediaScan> {
  if (!projectSlug) {
    return { ok: false, source: "none", videos: [], holdImages: [], error: "Проект не выбран" };
  }

  const api = getDesktopApi();
  if (api?.scanProjectMediaFolder) {
    try {
      const res = (await api.scanProjectMediaFolder(projectSlug)) as DevScannedMedia & {
        ok?: boolean;
      };
      if (res?.ok) return toScanResult(res, "desktop");
    } catch {
      /* fall through */
    }
  }

  const stored = readStoredProjectMediaFolder(projectSlug);
  if (stored.path) {
    const dev = await fetchDevScannedMedia(stored.path);
    if (dev.ok) return toScanResult(dev, "vite");
  }

  const devDefault = await fetchDevScannedMedia();
  if (devDefault.ok) {
    return toScanResult(devDefault, "vite");
  }

  const restored = await restoreBrowserMediaFolder(projectSlug);
  if (restored.ok) {
    return toScanResult(restored, "browser");
  }

  return {
    ok: false,
    source: "none",
    videos: [],
    holdImages: [],
    error: restored.error ?? "Папка с медиа не выбрана",
  };
}

/** Диалог выбора папки (Electron / Chrome) и сохранение привязки к проекту. */
export async function pickProjectMediaFolder(projectSlug: string): Promise<ProjectMediaScan> {
  if (!projectSlug) {
    return { ok: false, source: "none", videos: [], holdImages: [], error: "Проект не выбран" };
  }

  const api = getDesktopApi();
  if (api?.pickProjectMediaFolder) {
    const res = (await api.pickProjectMediaFolder(projectSlug)) as DevScannedMedia & {
      ok?: boolean;
      canceled?: boolean;
      path?: string;
      label?: string;
      error?: string;
    };
    if (res?.canceled) {
      return { ok: false, source: "none", videos: [], holdImages: [], error: "Выбор папки отменён" };
    }
    if (res?.ok && res.path) {
      writeStoredProjectMediaFolder(projectSlug, {
        path: res.path,
        label: res.label ?? basename(res.path),
      });
      if (res.videos) return toScanResult(res, "desktop");
      return scanProjectMediaFolder(projectSlug);
    }
    return {
      ok: false,
      source: "none",
      videos: [],
      holdImages: [],
      error: res?.error ?? "Не удалось выбрать папку",
    };
  }

  if (isBrowserFolderPickerSupported()) {
    const picked = await pickBrowserMediaFolder(projectSlug);
    if (!picked.ok) {
      return { ...picked, source: "none", sounds: [] };
    }
    if (picked.mediaRoot) {
      writeStoredProjectMediaFolder(projectSlug, {
        path: picked.mediaRoot,
        label: picked.folderName ?? basename(picked.mediaRoot),
      });
    }
    return toScanResult(picked, "browser");
  }

  return {
    ok: false,
    source: "none",
    videos: [],
    holdImages: [],
    error: "Выбор папки доступен в desktop-приложении или Chrome/Edge",
  };
}

/** Подставить локальные file/filePath из выбранной папки в сцену. */
export function mergeScannedMediaIntoScene(
  prevVideos: Array<{ id: number; title: string; file: string; filePath?: string }>,
  prevHolds: Array<{ id: number; title: string; file: string; filePath?: string }>,
  prevPlaylist: PlaylistTrack[],
  scan: ProjectMediaScan,
): {
  videos: typeof prevVideos;
  holdImages: typeof prevHolds;
  playlist: PlaylistTrack[];
} {
  const { videos, holdImages } = mergeDevScannedProjectorMedia(prevVideos, prevHolds, scan);
  const sounds = scan.sounds ?? [];
  if (sounds.length === 0) {
    return { videos, holdImages, playlist: prevPlaylist };
  }

  const used = new Set<number>();
  const playlist = prevPlaylist.map((track) => {
    const match = sounds.find(
      (s) =>
        !used.has(s.id) &&
        (normTitle(s.title) === normTitle(track.title) ||
          normFile(s.file) === normFile(track.file)),
    );
    if (!match) return track;
    used.add(match.id);
    return {
      ...track,
      file: match.file,
      filePath: match.filePath,
      remoteKey: undefined,
      remoteUrl: undefined,
    };
  });

  let nextId =
    Math.max(0, ...prevPlaylist.map((t) => Number(t.id)), ...sounds.map((s) => s.id)) + 1;
  for (const sound of sounds) {
    if (used.has(sound.id)) continue;
    playlist.push({
      id: nextId++,
      title: sound.title,
      file: sound.file,
      filePath: sound.filePath,
      fadeMs: 500,
      loop: false,
    });
  }

  return { videos, holdImages, playlist };
}

function normTitle(value: string): string {
  return value.trim().toLowerCase();
}

function normFile(value: string): string {
  return String(value ?? "")
    .replace(/^.*[/\\]/, "")
    .toLowerCase();
}
