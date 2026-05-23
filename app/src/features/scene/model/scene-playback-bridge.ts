let playlistPlayHandler: ((trackId: number) => void) | undefined;
let soundToggleHandler: ((soundId: number) => void) | undefined;

export function registerPlaylistPlayHandler(handler: (trackId: number) => void) {
  playlistPlayHandler = handler;
}

export function invokePlaylistPlay(trackId: number) {
  playlistPlayHandler?.(trackId);
}

export function registerSoundToggleHandler(handler: (soundId: number) => void) {
  soundToggleHandler = handler;
}

export function invokeSoundToggle(soundId: number) {
  soundToggleHandler?.(soundId);
}
