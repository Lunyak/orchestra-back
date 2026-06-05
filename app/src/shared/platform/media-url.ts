import { Capacitor } from "@capacitor/core";
import { getDesktopApi } from "./desktop-api";

/** URL для <audio> / <img>: локальный файл на native или remote. */
export function resolveOfflineMediaUrl(opts: {
  projectSlug: string;
  kind: "playlist" | "sound" | "video" | "image";
  fileName: string;
  filePath?: string | null;
  remoteUrl?: string | null;
}): string {
  const filePath = String(opts.filePath ?? "").trim();
  if (filePath) {
    if (/^https?:\/\//i.test(filePath)) return filePath;
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
  if (/^https?:\/\//i.test(remote)) return remote;

  const api = getDesktopApi();
  if (api) {
    const scheme = mediaSchemeForKind(opts.kind);
    const url = new URL(`${scheme}://${encodeURIComponent(opts.projectSlug)}/`);
    url.pathname = `/${opts.fileName}`;
    return url.toString();
  }

  return remote || opts.fileName;
}

export function isOfflineNativePlatform(): boolean {
  return Capacitor.isNativePlatform() || Boolean(getDesktopApi()?.invoke);
}

function mediaSchemeForKind(kind: "playlist" | "sound" | "video" | "image"): string {
  if (kind === "playlist") return "project-audio";
  if (kind === "video") return "project-video";
  if (kind === "image") return "project-images";
  return "project-sounds";
}
