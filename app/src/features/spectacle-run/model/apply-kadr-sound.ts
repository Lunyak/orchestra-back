import {
  invokePlaylistPlay,
  invokeSoundPlay,
} from "../../playbook/model/playbook-playback-bridge";
import type { SceneLightKadrSoundCueV1 } from "../../../shared/types/script";
import type { KadrSoundCue } from "../../theater/model/kadr-sound";

export function applyKadrSound(
  cue: KadrSoundCue | SceneLightKadrSoundCueV1 | null | undefined,
) {
  if (!cue) return;

  const playTrackIds = cue.playTrackIds ?? [];
  const soundIds = cue.soundIds ?? [];
  const primaryTrack = playTrackIds[0];
  if (primaryTrack != null && primaryTrack > 0) {
    const playOptions: {
      volume?: number;
      fadeMs?: number;
      continueIfPlaying: boolean;
    } = { continueIfPlaying: true };
    if (cue.volume != null && Number.isFinite(cue.volume)) {
      playOptions.volume = cue.volume;
    }
    if (cue.fadeMs != null && Number.isFinite(cue.fadeMs) && cue.fadeMs > 0) {
      playOptions.fadeMs = cue.fadeMs;
    }
    invokePlaylistPlay(primaryTrack, playOptions);
  }

  for (const soundId of soundIds) {
    if (soundId > 0) invokeSoundPlay(soundId);
  }
}
