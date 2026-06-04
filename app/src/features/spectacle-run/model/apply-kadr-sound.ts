import {
  invokePlaylistPlay,
  invokeSoundPlay,
} from "../../scene/model/scene-playback-bridge";
import type { KadrSoundCue } from "../../theater/model/kadr-sound";

export function applyKadrSound(cue: KadrSoundCue | null | undefined) {
  if (!cue) return;

  const primaryTrack = cue.playTrackIds[0];
  if (primaryTrack != null && primaryTrack > 0) {
    invokePlaylistPlay(primaryTrack);
  }

  for (const soundId of cue.soundIds) {
    if (soundId > 0) invokeSoundPlay(soundId);
  }
}
