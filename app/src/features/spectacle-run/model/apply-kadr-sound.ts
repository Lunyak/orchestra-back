import {
  invokePlaylistPlay,
  invokeSoundPlay,
} from "../../playbook/model/playbook-playback-bridge";
import type { KadrSoundCue } from "../../theater/model/kadr-sound";

export function applyKadrSound(cue: KadrSoundCue | null | undefined) {
  if (!cue) return;

  const primaryTrack = cue.playTrackIds[0];
  if (primaryTrack != null && primaryTrack > 0) {
    const playOptions: {
      volume?: number;
      continueIfPlaying: boolean;
    } = { continueIfPlaying: true };
    if (cue.volume != null && Number.isFinite(cue.volume)) {
      playOptions.volume = cue.volume;
    }
    invokePlaylistPlay(primaryTrack, playOptions);
  }

  for (const soundId of cue.soundIds) {
    if (soundId > 0) invokeSoundPlay(soundId);
  }
}
