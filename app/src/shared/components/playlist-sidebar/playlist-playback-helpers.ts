import type { PlaylistTrack } from "../../types/playlist";

export type PlaylistAudioKey = "a" | "b";
export type PlaylistPreloadStatus = "idle" | "loading" | "ready" | "error";

export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function progressToPercent(progress: number, duration: number): number {
  if (duration <= 0) return 0;
  return Math.min(100, Math.max(0, (progress / duration) * 100));
}

export function volumeToPercent(volume: number): number {
  return Math.min(100, Math.max(0, volume * 100));
}

export function oppositeAudioKey(key: PlaylistAudioKey): PlaylistAudioKey {
  return key === "a" ? "b" : "a";
}

export function pickAudioByKey(
  key: PlaylistAudioKey,
  audioA: HTMLAudioElement | null,
  audioB: HTMLAudioElement | null,
): HTMLAudioElement | null {
  return key === "a" ? audioA : audioB;
}

export function findPlaylistTrack(
  playlist: PlaylistTrack[],
  trackId: number,
): PlaylistTrack | undefined {
  const byId = playlist.find((track) => Number(track.id) === Number(trackId));
  if (byId) return byId;
  return playlist[Number(trackId) - 1];
}

export function getPlaylistTrackIndex(
  playlist: PlaylistTrack[],
  track: PlaylistTrack | null | undefined,
): number {
  if (!track) return -1;
  return playlist.findIndex((item) => Number(item.id) === Number(track.id));
}

export function playlistContainsTrack(
  playlist: PlaylistTrack[],
  track: PlaylistTrack,
): boolean {
  return playlist.some((item) => Number(item.id) === Number(track.id));
}

export function waitForAudioReady(
  audio: HTMLAudioElement,
  options?: { includeLoadedMetadata?: boolean; timeoutMs?: number },
): Promise<"ready"> {
  const includeLoadedMetadata = options?.includeLoadedMetadata === true;
  const timeoutMs = options?.timeoutMs ?? 20000;

  return new Promise<"ready">((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("preload timeout"));
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve("ready");
    };
    const onErr = () => {
      cleanup();
      reject(new Error("preload error"));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("loadeddata", onReady);
      if (includeLoadedMetadata) {
        audio.removeEventListener("loadedmetadata", onReady);
      }
      audio.removeEventListener("error", onErr);
    };

    audio.addEventListener("canplay", onReady);
    audio.addEventListener("loadeddata", onReady);
    if (includeLoadedMetadata) {
      audio.addEventListener("loadedmetadata", onReady);
    }
    audio.addEventListener("error", onErr);
  });
}
