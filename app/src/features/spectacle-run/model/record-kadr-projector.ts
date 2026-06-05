import type { MarkdownKadrSection } from "../../theater/model/light-kadrs";
import {
  formatProjectorKadrLine,
  type KadrProjectorCue,
  upsertProjectorLineInSection,
} from "../../theater/model/kadr-projector";

export type RecordProjectorKadrInput = {
  markdown: string;
  section: MarkdownKadrSection;
  videos?: Array<{ id: number; title: string }>;
  holdImages?: Array<{ id: number; title: string }>;
  cue: KadrProjectorCue;
};

export type RecordProjectorKadrResult = {
  nextMarkdown: string;
  summary: string;
};

export function recordProjectorKadrForSection(
  input: RecordProjectorKadrInput,
): RecordProjectorKadrResult | null {
  if (!input.section) return null;

  const projectorLine = formatProjectorKadrLine(input.cue, {
    videos: input.videos,
    holdImages: input.holdImages,
  });
  const nextMarkdown = upsertProjectorLineInSection(
    input.markdown,
    input.section,
    projectorLine,
  );

  let summary = "Видео: заставка";
  if (input.cue.mode === "hold") {
    const holdId = input.cue.holdId;
    if (holdId != null && holdId > 0) {
      const hold = input.holdImages?.find((h) => Number(h.id) === holdId);
      const label = hold?.title?.trim() || `заставка ${holdId}`;
      summary = `Видео: ${label}`;
    }
  } else {
    const { videoId } = input.cue;
    const video = input.videos?.find((v) => v.id === videoId);
    const label = video?.title?.trim() || `видео ${videoId}`;
    summary = `Видео: ${label}`;
  }

  return { nextMarkdown, summary };
}
