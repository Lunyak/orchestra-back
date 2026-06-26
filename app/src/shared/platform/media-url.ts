import { Capacitor } from "@capacitor/core";
import { getDesktopApi } from "./desktop-api";
import { localProjectMediaDevUrl } from "./local-project-dev";

/** URL для <audio> / <img>: локальный файл на native или remote. */
export function resolveOfflineMediaUrl(opts: {
  projectSlug: string;
  kind: "playlist" | "sound" | "video" | "image";
  fileName: string;
  filePath?: string | null;
  remoteUrl?: string | null;
  titleHint?: string | null;
}): string {
  const filePath = String(opts.filePath ?? "").trim();
  if (filePath) {
    if (/^https?:\/\//i.test(filePath)) return filePath;
    const looksAbsolute = /^([a-zA-Z]:[\\/]|\/)/.test(filePath);
    if (looksAbsolute && getDesktopApi()) {
      const normalized = filePath.replace(/\\/g, "/");
      return normalized.startsWith("file://") ? normalized : `file://${normalized}`;
    }
    if (Capacitor.isNativePlatform()) {
      return Capacitor.convertFileSrc(filePath);
    }
    const api = getDesktopApi();
    if (api?.resolveFileSrc) {
      const resolved = api.resolveFileSrc(opts.projectSlug, filePath);
      if (typeof resolved === "string") return resolved;
      if (resolved && typeof (resolved as Promise<string>).then === "function") {
        return filePath;
      }
    }
    const scheme = mediaSchemeForKind(opts.kind);
    const url = new URL(`${scheme}://${encodeURIComponent(opts.projectSlug)}/`);
    url.pathname = `/${opts.fileName || filePath.replace(/^.*[/\\]/, "")}`;
    return url.toString();
  }

  const remote = String(opts.remoteUrl ?? "").trim();
  const fileBase = String(opts.fileName ?? "")
    .trim()
    .replace(/^.*[/\\]/, "");

  // Десктоп Electron: project-video:// / project-images://
  const api = getDesktopApi();
  if (api && fileBase) {
    const scheme = mediaSchemeForKind(opts.kind);
    const url = new URL(`${scheme}://${encodeURIComponent(opts.projectSlug)}/`);
    url.pathname = `/${fileBase}`;
    return url.toString();
  }

  // Браузер + npm run dev: файлы с диска через Vite middleware
  const devLocal = localProjectMediaDevUrl(
    opts.projectSlug,
    opts.kind,
    fileBase,
    String(opts.titleHint ?? "").trim() || undefined,
  );
  if (devLocal) return devLocal;

  if (/^https?:\/\//i.test(remote)) return remote;

  return remote || opts.fileName;
}

export function isOfflineNativePlatform(): boolean {
  const api = getDesktopApi();
  return Capacitor.isNativePlatform() || Boolean(api?.readProjectPlaybook ?? api?.invoke);
}

export function isDesktopApp(): boolean {
  return Boolean(getDesktopApi()?.readProjectPlaybook);
}

/** Браузер на npm run dev — медиа с локального диска. */
export function isBrowserDevLocalProjects(): boolean {
  return Boolean(import.meta.env.DEV) && !isDesktopApp();
}

export function isLocalProjectMediaUrl(url: string | null | undefined): boolean {
  const value = String(url ?? "").trim();
  return (
    /^project-(video|audio|images|sounds|sound-icons|models):/i.test(value) ||
    value.startsWith("/local-project-media/") ||
    value.startsWith("blob:")
  );
}

function mediaSchemeForKind(kind: "playlist" | "sound" | "video" | "image"): string {
  if (kind === "playlist") return "project-audio";
  if (kind === "video") return "project-video";
  if (kind === "image") return "project-images";
  return "project-sounds";
}
