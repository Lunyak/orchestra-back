import { fetchSoundStreamBlobUrl, getPlayUrl } from "../../../sync/api/files";
import { resolveBrowserPickedMediaUrl } from "../../platform/browser-picked-media";
import { getDesktopApi } from "../../platform/desktop-api";
import { resolveOfflineMediaUrl } from "../../platform/media-url";

export type SoundPlaybackFields = {
  name?: string;
  file?: string;
  url?: string;
  filePath?: string;
  remoteUrl?: string;
  remoteKey?: string;
};

function pushUnique(list: string[], value: string | null | undefined) {
  const src = String(value ?? "").trim();
  if (!src) return;
  if (list.includes(src)) return;
  list.push(src);
}

function isLikelyPlayableSrc(src: string): boolean {
  return /^(blob:|file:|https?:|project-|\/local-project-media\/)/i.test(src);
}

/** Кандидаты URL для <audio>, по приоритету. */
export async function resolveSoundPlaybackCandidates(
  projectName: string,
  track: SoundPlaybackFields,
  accessToken: string | null,
): Promise<string[]> {
  const candidates: string[] = [];
  const fileName =
    String(track.file ?? "").trim() ||
    (track.filePath ? String(track.filePath).replace(/^.*[/\\]/, "") : "") ||
    String(track.url ?? "").trim();
  const titleHint = String(track.name ?? "").trim();
  const token =
    accessToken ??
    (typeof window !== "undefined" ? localStorage.getItem("accessToken") : null);
  const remoteKey = String(track.remoteKey ?? "").trim();
  const remoteUrl = String(track.remoteUrl ?? track.url ?? "").trim();

  if (!getDesktopApi()) {
    pushUnique(
      candidates,
      resolveBrowserPickedMediaUrl(fileName, titleHint, projectName),
    );
  }

  const offline = resolveOfflineMediaUrl({
    projectSlug: projectName,
    kind: "sound",
    fileName,
    filePath: track.filePath,
    remoteUrl,
    titleHint,
  });
  if (isLikelyPlayableSrc(offline)) {
    pushUnique(candidates, offline);
  }

  if (remoteKey && token) {
    try {
      const { url } = await getPlayUrl(token, remoteKey);
      if (url && /^https?:\/\//i.test(url)) {
        pushUnique(candidates, url);
      }
    } catch {
      // next
    }
  }

  if (/^https?:\/\//i.test(remoteUrl)) {
    pushUnique(candidates, remoteUrl);
  }

  if (remoteKey && token) {
    const blobUrl = await fetchSoundStreamBlobUrl(token, remoteKey);
    pushUnique(candidates, blobUrl);
  }

  return candidates.filter(isLikelyPlayableSrc);
}
