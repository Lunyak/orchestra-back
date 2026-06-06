export type PlaylistPlaybackSnapshot = {
  trackId: number | null;
  trackTitle?: string;
  fadeMs?: number;
  /** Громкость плеера 0…1. */
  volume?: number;
};

export type PlaylistPlayOptions = {
  /** Целевая громкость 0…1 перед стартом трека. */
  volume?: number;
  /**
   * Если тот же трек уже играет — не останавливать и не перезапускать с начала.
   * По умолчанию true для invokePlaylistPlay (прогон, markdown).
   */
  continueIfPlaying?: boolean;
};

let playlistPlayHandler:
  | ((trackId: number, options?: PlaylistPlayOptions) => void)
  | undefined;
let soundToggleHandler: ((soundId: number) => void) | undefined;
let soundPlayHandler: ((soundId: number) => void) | undefined;
let playlistSnapshotProvider: (() => PlaylistPlaybackSnapshot) | undefined;

type PlaylistActiveListener = () => void;

let playlistActiveTrackId: number | null = null;
let playlistIsPlaying = false;
let playlistVisualSnapshot = { trackId: null as number | null, isPlaying: false };
const playlistActiveListeners = new Set<PlaylistActiveListener>();

function bumpPlaylistActiveTrack() {
  playlistVisualSnapshot = {
    trackId: playlistActiveTrackId,
    isPlaying: playlistIsPlaying,
  };
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

export function getPlaylistIsPlaying(): boolean {
  return playlistIsPlaying;
}

export function getPlaylistVisualSnapshot() {
  return playlistVisualSnapshot;
}

export function setPlaylistActiveTrackId(trackId: number | null) {
  updatePlaylistVisualPlayback(trackId, playlistIsPlaying);
}

export function updatePlaylistVisualPlayback(trackId: number | null, isPlaying: boolean) {
  const nextId =
    trackId != null && Number.isFinite(Number(trackId)) ? Number(trackId) : null;
  const nextPlaying = Boolean(isPlaying);
  if (playlistActiveTrackId === nextId && playlistIsPlaying === nextPlaying) return;
  playlistActiveTrackId = nextId;
  playlistIsPlaying = nextPlaying;
  bumpPlaylistActiveTrack();
}

export function registerPlaylistPlayHandler(
  handler: (trackId: number, options?: PlaylistPlayOptions) => void,
) {
  playlistPlayHandler = handler;
}

export function invokePlaylistPlay(trackId: number, options?: PlaylistPlayOptions) {
  playlistPlayHandler?.(trackId, options);
}

let playlistPauseHandler: (() => void) | undefined;

export function registerPlaylistPauseHandler(handler: (() => void) | undefined) {
  playlistPauseHandler = handler;
}

export function invokePlaylistPause() {
  playlistPauseHandler?.();
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
