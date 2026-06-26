import {
  buildPlaylistCacheKey,
  getCachedObjectUrl,
  isWebMediaCacheEnabled,
  resolveWebPlaylistPlaybackUrl,
} from "../../media/web-media-cache";
import { resolveOfflineMediaUrl } from "../../platform/media-url";
import { resolveBrowserPickedMediaUrl } from "../../platform/browser-picked-media";
import { getDesktopApi } from "../../platform/desktop-api";
import type { PlaylistTrack } from "../../types/playlist";

export async function resolvePlaylistTrackPlaybackSrc(
  projectName: string,
  track: PlaylistTrack,
  accessToken: string | null,
): Promise<string> {
  const titleHint = String(track.title ?? "").trim();

  if (isWebMediaCacheEnabled()) {
    const cacheKey = buildPlaylistCacheKey(projectName, track);
    const cached = await getCachedObjectUrl(cacheKey);
    if (cached) return cached;
  }

  if (!getDesktopApi()) {
    const picked = resolveBrowserPickedMediaUrl(track.file, titleHint, projectName);
    if (picked) return picked;
  }

  if (getDesktopApi() || track.filePath) {
    return resolveOfflineMediaUrl({
      projectSlug: projectName,
      kind: "playlist",
      fileName: track.file,
      filePath: track.filePath,
      remoteUrl: track.remoteUrl,
      titleHint,
    });
  }

  if (isWebMediaCacheEnabled()) {
    return resolveWebPlaylistPlaybackUrl(projectName, track, accessToken);
  }

  const remote = String(track.remoteUrl ?? "").trim();
  if (/^https?:\/\//i.test(remote)) return remote;
  return track.file;
}
