import { getApiBaseUrl } from "../../sync/api/client";
import { fetchImageStreamBlobUrl, getPlayUrl } from "../../sync/api/files";
import { resolveBrowserPickedMediaUrl } from "./browser-picked-media";
import { getDesktopApi } from "./desktop-api";
import { localProjectSoundIconDevUrl } from "./local-project-dev";

export type SoundIconFields = {
  icon?: string;
  iconRemoteKey?: string;
  iconRemoteUrl?: string;
  iconPreviewUrl?: string;
};

export function buildSoundIconPlayUrl(key: string): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  return `${base}/files/play/${encodeURIComponent(key)}`;
}

function isDirectPublicMediaUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) && !/\/files\/play\//i.test(url);
}

function readAccessToken(accessToken: string | null | undefined): string | null {
  if (accessToken) return accessToken;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export function resolveDesktopSoundIconUrl(
  projectSlug: string,
  iconFile: string,
  projectId?: string | null,
): string {
  const safe = String(iconFile ?? "").trim().replace(/^.*[/\\]/, "");
  if (!safe) return "";
  const url = new URL(`project-sound-icons://${encodeURIComponent(projectSlug)}/`);
  const encodedFile = encodeURIComponent(safe);
  url.pathname = projectId
    ? `/${encodeURIComponent(projectId)}/${encodedFile}`
    : `/${encodedFile}`;
  return url.toString();
}

function resolveLocalIconFile(projectSlug: string, iconFile: string): string {
  const picked = resolveBrowserPickedMediaUrl(iconFile, undefined, projectSlug);
  if (picked) return picked;
  const devIcon = localProjectSoundIconDevUrl(projectSlug, iconFile);
  if (devIcon) return devIcon;
  return "";
}

export async function resolveSoundIconDisplaySrc(
  projectSlug: string,
  track: SoundIconFields,
  accessToken: string | null | undefined,
  projectId?: string | null,
): Promise<string> {
  const preview = String(track.iconPreviewUrl ?? "").trim();
  if (preview) return preview;

  const token = readAccessToken(accessToken);
  const icon = String(track.icon ?? "").trim().replace(/^.*[/\\]/, "");

  if (icon) {
    if (!getDesktopApi()) {
      const local = resolveLocalIconFile(projectSlug, icon);
      if (local) return local;
    } else {
      return resolveDesktopSoundIconUrl(projectSlug, icon, projectId);
    }
  }

  const key = String(track.iconRemoteKey ?? "").trim();
  const remote = String(track.iconRemoteUrl ?? "").trim();

  if (isDirectPublicMediaUrl(remote)) return remote;

  if (key) {
    if (token) {
      const blob = await fetchImageStreamBlobUrl(token, key);
      if (blob) return blob;
      try {
        const { url } = await getPlayUrl(token, key);
        if (url) return url;
      } catch {
        /* try play path */
      }
    }
    return buildSoundIconPlayUrl(key);
  }

  if (remote && /^https?:\/\//i.test(remote)) {
    if (/\/files\/play\//i.test(remote)) {
      try {
        const pathKey = decodeURIComponent(
          new URL(remote).pathname.replace(/^\/files\/play\//, ""),
        );
        if (pathKey) return buildSoundIconPlayUrl(pathKey);
      } catch {
        /* use remote as-is */
      }
    }
    return remote;
  }

  return "";
}

export function soundTrackHasIcon(track: SoundIconFields): boolean {
  return Boolean(
    String(track.iconPreviewUrl ?? "").trim() ||
      String(track.icon ?? "").trim() ||
      String(track.iconRemoteUrl ?? "").trim() ||
      String(track.iconRemoteKey ?? "").trim(),
  );
}
