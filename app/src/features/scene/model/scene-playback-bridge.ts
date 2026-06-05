export type PlaylistPlaybackSnapshot = {
  trackId: number | null;
  trackTitle?: string;
  fadeMs?: number;
  /** Громкость плеера 0…1. */
  volume?: number;
};

let playlistPlayHandler: ((trackId: number) => void) | undefined;
let soundToggleHandler: ((soundId: number) => void) | undefined;
let soundPlayHandler: ((soundId: number) => void) | undefined;
let playlistSnapshotProvider: (() => PlaylistPlaybackSnapshot) | undefined;

type PlaylistActiveListener = () => void;

let playlistActiveTrackId: number | null = null;
const playlistActiveListeners = new Set<PlaylistActiveListener>();

function bumpPlaylistActiveTrack() {
  playlistActiveListeners.forEach((listener) => listener());
}

export function subscribePlaylistActiveTrack(listener: PlaylistActiveListener) {
  playlistActiveListeners.add(listener);
  return () => {
    playlistActiveListeners.delete(listener);
  };
}

export function getPlaylistActiveTrackId(): number | null {
  return playlistActiveTrackId;
}

export function setPlaylistActiveTrackId(trackId: number | null) {
  const next =
    trackId != null && Number.isFinite(Number(trackId)) ? Number(trackId) : null;
  if (playlistActiveTrackId === next) return;
  playlistActiveTrackId = next;
  bumpPlaylistActiveTrack();
}

export function registerPlaylistPlayHandler(handler: (trackId: number) => void) {
  playlistPlayHandler = handler;
}

export function invokePlaylistPlay(trackId: number) {
  playlistPlayHandler?.(trackId);
}

export function registerPlaylistSnapshotProvider(
  provider: (() => PlaylistPlaybackSnapshot) | undefined,
) {
  playlistSnapshotProvider = provider;
}

export function getPlaylistPlaybackSnapshot(): PlaylistPlaybackSnapshot {
  const fromPlayer = playlistSnapshotProvider?.();
  const trackId = fromPlayer?.trackId ?? playlistActiveTrackId;
  return {
    trackId,
    trackTitle: fromPlayer?.trackTitle,
    fadeMs: fromPlayer?.fadeMs,
    volume: fromPlayer?.volume,
  };
}

export function registerSoundToggleHandler(handler: (soundId: number) => void) {
  soundToggleHandler = handler;
}

export function invokeSoundToggle(soundId: number) {
  soundToggleHandler?.(soundId);
}

export function registerSoundPlayHandler(handler: ((soundId: number) => void) | undefined) {
  soundPlayHandler = handler;
}

export function invokeSoundPlay(soundId: number) {
  if (soundPlayHandler) {
    soundPlayHandler(soundId);
    return;
  }
  invokeSoundToggle(soundId);
}
