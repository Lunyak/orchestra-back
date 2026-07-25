import type {
  SceneLightKadrProjectorCueV1,
  SceneLightKadrSoundCueV1,
  SceneLightKadrV1,
  SceneLightKadrsDataV1,
} from "../../../shared/types/script";
import {
  createLightKadrId,
  normalizeLightKadrs,
  readSceneLightKadrs,
  renumberSceneLightKadrs,
  scanMarkdownKadrSections,
} from "../../theater/model/light-kadrs";
import {
  parseProjectorLineInSection,
  type KadrProjectorCue,
} from "../../theater/model/kadr-projector";
import {
  parseSoundLineInSection,
  type KadrSoundCue,
} from "../../theater/model/kadr-sound";
import { parseKadrCommentRawInSection } from "./kadr-section-comment";
import { parseKadrLabelsInSection } from "./kadr-section-labels";
import { parseKadrSectionImageMarkdownInSection } from "./kadr-section-image";
import { parseKadrTransitionRawInSection } from "./kadr-section-transition";

function parseKadrTitleFromHeading(headingTitle: string, kadrNo: number): string {
  const prefix = new RegExp(`^Картина\\s+${kadrNo}\\s*(?:·\\s*)?`, "i");
  return String(headingTitle ?? "").replace(prefix, "").trim();
}

function soundCueFromMarkdown(cue: KadrSoundCue | null): SceneLightKadrSoundCueV1 | undefined {
  if (!cue) return undefined;
  const playTrackIds = cue.playTrackIds.filter((id) => id > 0);
  const soundIds = cue.soundIds.filter((id) => id > 0);
  if (playTrackIds.length === 0 && soundIds.length === 0) return undefined;
  return {
    ...(playTrackIds.length > 0 ? { playTrackIds } : {}),
    ...(soundIds.length > 0 ? { soundIds } : {}),
    ...(cue.volume != null ? { volume: cue.volume } : {}),
    ...(cue.fadeMs != null ? { fadeMs: cue.fadeMs } : {}),
  };
}

function projectorCueFromMarkdown(
  cue: KadrProjectorCue | null,
): SceneLightKadrProjectorCueV1 | undefined {
  if (!cue) return undefined;
  if (cue.mode === "video") {
    return cue.muted === true
      ? { mode: "video", videoId: cue.videoId, muted: true }
      : { mode: "video", videoId: cue.videoId };
  }
  return cue.holdId != null && cue.holdId > 0
    ? { mode: "hold", holdId: cue.holdId }
    : { mode: "hold" };
}

function enrichKadrFromMarkdownSection(args: {
  base: SceneLightKadrV1;
  markdown: string;
  section: ReturnType<typeof scanMarkdownKadrSections>[number];
}): SceneLightKadrV1 {
  const { base, markdown, section } = args;
  const titleFromHeading = parseKadrTitleFromHeading(section.headingTitle, section.kadrNo);
  const sound = base.sound ?? soundCueFromMarkdown(parseSoundLineInSection(markdown, section));
  const projector =
    base.projector ?? projectorCueFromMarkdown(parseProjectorLineInSection(markdown, section));
  const labels = parseKadrLabelsInSection(markdown, section);
  const blackoutLabel = labels.find((label) => label.type === "blackout");
  const smokeLabel = labels.find((label) => label.type === "smoke");
  const smokeMachineLabel = labels.some(
    (label) => label.type === "smoke-machine" || label.type === "smoke",
  );
  const transitionText =
    base.transitionText ??
    (parseKadrTransitionRawInSection(markdown, section).trim() || undefined);
  const commentText =
    base.commentText ??
    (parseKadrCommentRawInSection(markdown, section).trim() || undefined);
  const imageMarkdown =
    base.imageMarkdown ??
    (parseKadrSectionImageMarkdownInSection(markdown, section).trim() || undefined);

  return normalizeLightKadrs({
    v: 1,
    kadrs: [
      {
        ...base,
        title: base.title?.trim() || titleFromHeading || undefined,
        ...(sound ? { sound } : {}),
        ...(projector ? { projector } : {}),
        ...(transitionText ? { transitionText } : {}),
        ...(commentText ? { commentText } : {}),
        ...(imageMarkdown ? { imageMarkdown } : {}),
        blackoutDurationSec: base.blackoutDurationSec ?? blackoutLabel?.seconds,
        smokeDurationSec: base.smokeDurationSec ?? smokeLabel?.seconds,
        smokeMachine: base.smokeMachine === true || smokeMachineLabel ? true : undefined,
      },
    ],
  }).kadrs[0]!;
}

/**
 * Одноразовая миграция: подтянуть картины / медиа из markdown в JSON.
 * Не удаляет JSON-картины, которых нет в markdown.
 */
export function migrateSceneLightKadrsFromMarkdown(scene: {
  markdown?: string | null;
  lightKadrs?: SceneLightKadrsDataV1 | null;
}): SceneLightKadrsDataV1 {
  const markdown = String(scene.markdown ?? "");
  const existing = readSceneLightKadrs(scene);
  const sections = scanMarkdownKadrSections(markdown);
  if (sections.length === 0) return existing;

  const byId = new Map(existing.kadrs.map((kadr) => [kadr.id, kadr]));
  const usedIds = new Set<string>();
  const nextKadrs: SceneLightKadrV1[] = [];

  for (const section of sections) {
    const existingById = section.id ? byId.get(section.id) : undefined;
    const existingByNo =
      existing.kadrs.find((kadr) => kadr.kadrNo === section.kadrNo && !usedIds.has(kadr.id)) ??
      undefined;
    const base =
      existingById ??
      existingByNo ??
      ({
        id: section.id ?? createLightKadrId(),
        kadrNo: section.kadrNo,
        programId: 1,
        faders: [],
      } satisfies SceneLightKadrV1);

    const enriched = enrichKadrFromMarkdownSection({
      base: { ...base, id: section.id ?? base.id, kadrNo: section.kadrNo },
      markdown,
      section,
    });
    usedIds.add(enriched.id);
    nextKadrs.push(enriched);
  }

  for (const kadr of existing.kadrs) {
    if (!usedIds.has(kadr.id)) nextKadrs.push(kadr);
  }

  return renumberSceneLightKadrs({ v: 1, kadrs: nextKadrs });
}
