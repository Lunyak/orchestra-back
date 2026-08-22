export type PlaylistPlaybackSnapshot = {
  trackId: number | null;
  trackTitle?: string;
  fadeMs?: number;
  /** Громкость плеера 0…1. */
  volume?: number;
  progress?: number;
  duration?: number;
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
let playlistProgressSnapshot = { progress: 0, duration: 0 };
const playlistActiveListeners = new Set<PlaylistActiveListener>();
const playlistProgressListeners = new Set<PlaylistActiveListener>();

function bumpPlaylistActiveTrack() {
  playlistVisualSnapshot = {
    trackId: playlistActiveTrackId,
    isPlaying: playlistIsPlaying,
  };
  playlistActiveListeners.forEach((listener) => listener());
}

function bumpPlaylistProgress() {
  playlistProgressListeners.forEach((listener) => listener());
}

export function subscribePlaylistActiveTrack(listener: PlaylistActiveListener) {
  playlistActiveListeners.add(listener);
  return () => {
    playlistActiveListeners.delete(listener);
  };
}

export function subscribePlaylistProgress(listener: PlaylistActiveListener) {
  playlistProgressListeners.add(listener);
  return () => {
    playlistProgressListeners.delete(listener);
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

export function getPlaylistProgressSnapshot() {
  return playlistProgressSnapshot;
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

export function updatePlaylistProgress(progress: number, duration: number) {
  const nextProgress = Number.isFinite(progress) ? Math.max(0, progress) : 0;
  const nextDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const prev = playlistProgressSnapshot;
  if (
    Math.abs(prev.progress - nextProgress) < 0.05 &&
    Math.abs(prev.duration - nextDuration) < 0.05
  ) {
    return;
  }
  playlistProgressSnapshot = {
    progress: nextProgress,
    duration: nextDuration,
  };
  bumpPlaylistProgress();
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
let playlistToggleHandler: (() => void) | undefined;
let playlistPrevHandler: (() => void) | undefined;
let playlistNextHandler: (() => void) | undefined;

export function registerPlaylistPauseHandler(handler: (() => void) | undefined) {
  playlistPauseHandler = handler;
}

export function invokePlaylistPause() {
  playlistPauseHandler?.();
}

export function registerPlaylistToggleHandler(handler: (() => void) | undefined) {
  playlistToggleHandler = handler;
}

export function invokePlaylistToggle() {
  playlistToggleHandler?.();
}

export function registerPlaylistPrevHandler(handler: (() => void) | undefined) {
  playlistPrevHandler = handler;
}

export function invokePlaylistPrev() {
  playlistPrevHandler?.();
}

export function registerPlaylistNextHandler(handler: (() => void) | undefined) {
  playlistNextHandler = handler;
}

export function invokePlaylistNext() {
  playlistNextHandler?.();
}

let playlistSeekHandler: ((value: number) => void) | undefined;

export function registerPlaylistSeekHandler(
  handler: ((value: number) => void) | undefined,
) {
  playlistSeekHandler = handler;
}

export function invokePlaylistSeek(value: number) {
  playlistSeekHandler?.(value);
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
    progress: fromPlayer?.progress ?? playlistProgressSnapshot.progress,
    duration: fromPlayer?.duration ?? playlistProgressSnapshot.duration,
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
