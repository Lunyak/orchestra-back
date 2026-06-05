import type { MarkdownKadrSection } from "../../theater/model/light-kadrs";
import {
  formatSoundKadrLine,
  type KadrSoundCue,
  upsertSoundLineInSection,
} from "../../theater/model/kadr-sound";
import { getPlaylistPlaybackSnapshot } from "../../scene/model/scene-playback-bridge";

export type RecordSoundKadrInput = {
  markdown: string;
  section: MarkdownKadrSection;
  playlist?: Array<{ id: number; title: string }>;
  sounds?: Array<{ id: number; title: string }>;
  /** Явный снимок; иначе — текущий трек плейлиста. */
  cue?: KadrSoundCue | null;
};

export type RecordSoundKadrResult = {
  nextMarkdown: string;
  summary: string;
};

export function recordSoundKadrForSection(
  input: RecordSoundKadrInput,
): RecordSoundKadrResult | null {
  if (!input.section) return null;

  let cue = input.cue ?? null;
  if (!cue) {
    const snap = getPlaylistPlaybackSnapshot();
    if (snap.trackId != null && snap.trackId > 0) {
      cue = {
        playTrackIds: [snap.trackId],
        soundIds: [],
        volume: snap.volume,
      };
    }
  }

  if (!cue || (cue.playTrackIds.length === 0 && cue.soundIds.length === 0)) {
    return null;
  }

  const soundLine = formatSoundKadrLine(cue, {
    playlist: input.playlist,
    sounds: input.sounds,
  });
  const nextMarkdown = upsertSoundLineInSection(
    input.markdown,
    input.section,
    soundLine,
  );

  const labels: string[] = [];
  if (cue.playTrackIds.length > 0) {
    const id = cue.playTrackIds[0];
    const title =
      input.playlist?.find((t) => t.id === id)?.title ??
      getPlaylistPlaybackSnapshot().trackTitle;
    labels.push(title?.trim() ? `трек «${title.trim()}»` : `трек ${id}`);
  }
  if (cue.soundIds.length > 0) {
    labels.push(`SFX ×${cue.soundIds.length}`);
  }

  return {
    nextMarkdown,
    summary: `Звук: ${labels.join(", ") || "записано"}`,
  };
}
