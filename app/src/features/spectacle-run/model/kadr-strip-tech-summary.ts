import type {
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../scene/model/scene-slice";
import {
  fadersForKadrDisplay,
  findKadrById,
  type MarkdownKadrSection,
  readStepLightKadrsFromMarkdown,
} from "../../theater/model/light-kadrs";
import {
  findProjectorLineInSection,
  parseProjectorLineInSection,
  type KadrProjectorCue,
} from "../../theater/model/kadr-projector";
import { findSoundLineInSection, parseSoundLineInSection } from "../../theater/model/kadr-sound";
import { formatFaderShort } from "../../../shared/components/light-console/light-console-labels";
import { buildLightConsoleSplitModel } from "../../../shared/components/light-console/light-console-split";
import { parseLightChannel } from "../../../shared/components/show-script/utils/lightTokens";
import type { ScriptStep, StepLightKadrV1 } from "../../../shared/types/script";
import { parseKadrTitleFromHeading } from "./create-kadr-from-draft";
import { parseKadrLabelsInSection, type KadrRunLabel } from "./kadr-section-labels";
import type { SpectacleTapeItem } from "./spectacle-kadr-tape";

export type KadrStripProjectorPreview = {
  mode: "video" | "hold";
  videoId: number | null;
  holdId: number | null;
  title: string;
};

export type KadrStripTechRow = {
  label: string;
  value: string;
  projectorPreview?: KadrStripProjectorPreview;
};

export type KadrStripTechSummary = {
  headingTitle: string;
  rows: KadrStripTechRow[];
  blackout: boolean;
  cornerLabels: KadrRunLabel[];
};

type MediaLookup = {
  playlist?: Array<{ id: number; title: string }>;
  sounds?: Array<{ id: number; title: string }>;
  videos?: Array<{ id: number; title: string }>;
  holdImages?: Array<{ id: number; title: string }>;
};

const ACTION_FIELD_RE = /^-\s*\*\*Действие\/задача\*\*:\s*(.*)$/im;

function stripKadrFieldMarkdown(text: string): string {
  return String(text ?? "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/orchestra-image:[^\s]+/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeStripFieldValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-f0-9]{16,}$/i.test(trimmed)) return "";
  if (trimmed.length > 72) return `${trimmed.slice(0, 69)}…`;
  return trimmed;
}

function isKadrPlaceholderText(text: string): boolean {
  const value = text.trim();
  if (!value) return true;
  if (/^_/.test(value) && /_$/.test(value)) return true;
  if (/не записано|при создании картины|репетиция|пульт ниже/i.test(value)) return true;
  return false;
}

function findFieldBody(
  markdown: string,
  section: MarkdownKadrSection,
  pattern: RegExp,
): string | null {
  const slice = String(markdown ?? "").slice(section.headingEnd, section.sectionEnd);
  const match = pattern.exec(slice);
  return match?.[1] != null ? match[1].trim() : null;
}

function resolveKadrForItem(
  item: SpectacleTapeItem,
  step: ScriptStep | undefined,
): StepLightKadrV1 | undefined {
  if (!step || item.isPlaceholder || !item.section) return undefined;
  const kadrs = readStepLightKadrsFromMarkdown(step);
  return (
    (item.kadrId ? findKadrById(kadrs, item.kadrId) : undefined) ??
    kadrs.kadrs.find((k) => k.kadrNo === item.kadrNo)
  );
}

function programLabel(
  programId: number,
  lightChannels: string[],
  lightPrograms: SceneLightProgramsDataV1 | null | undefined,
): string {
  if (programId <= 0) return "блекаут";
  const program = lightPrograms?.programs.find((p) => p.id === programId);
  if (program?.label?.trim()) return program.label.trim();
  const channelRaw = lightChannels[programId - 1];
  if (channelRaw) {
    const parsed = parseLightChannel(channelRaw);
    if (parsed.label) return parsed.label;
  }
  return `П${programId}`;
}

function formatLightSummary(
  kadr: StepLightKadrV1,
  lightChannels: string[],
  lightFaders: SceneLightFadersDataV1,
  lightPrograms: SceneLightProgramsDataV1 | null | undefined,
): string {
  if (kadr.blackout || kadr.programId <= 0) return "Блекаут";

  const displayFaders = fadersForKadrDisplay(kadr, lightFaders);
  const split = buildLightConsoleSplitModel({
    programId: kadr.programId,
    lightChannels,
    faders: displayFaders,
    kadrFaderStates: kadr.faders,
    sofitChannels: kadr.recordChannels ?? [],
  });

  return `П${kadr.programId} · ${split.programLabel}`;
}

function formatFaderSummary(kadr: StepLightKadrV1): string | null {
  const activeFaders = kadr.faders
    .filter((row) => row.enabled !== false && (row.intensity ?? 0) > 0.02)
    .map((row) => {
      const pct = Math.round(Math.min(1, Math.max(0, row.intensity ?? 0)) * 100);
      return `${formatFaderShort(row.faderId)} ${pct}%`;
    });

  if (activeFaders.length === 0) return null;
  return activeFaders.join(", ");
}

function formatSoundSummary(
  markdown: string,
  section: MarkdownKadrSection,
  media: MediaLookup,
): string | null {
  const cue = parseSoundLineInSection(markdown, section);
  if (!cue) return null;

  const parts: string[] = [];
  for (const trackId of cue.playTrackIds) {
    const title = media.playlist?.find((t) => t.id === trackId)?.title?.trim();
    parts.push(title ? `«${title}»` : `трек ${trackId}`);
  }
  for (const soundId of cue.soundIds) {
    const title = media.sounds?.find((s) => s.id === soundId)?.title?.trim();
    parts.push(title ? `SFX «${title}»` : `SFX ${soundId}`);
  }
  if (cue.volume != null && Number.isFinite(cue.volume) && cue.playTrackIds.length > 0) {
    parts.push(`${Math.round(cue.volume * 100)}%`);
  }

  const value = humanizeStripFieldValue(parts.join(", "));
  return value || null;
}

function formatSoundFallback(
  markdown: string,
  section: MarkdownKadrSection,
): string | null {
  const body = findSoundLineInSection(markdown, section);
  if (body == null) return null;
  const value = humanizeStripFieldValue(stripKadrFieldMarkdown(body));
  if (!value || isKadrPlaceholderText(value)) return null;
  return value;
}

function buildProjectorPreview(
  cue: KadrProjectorCue,
  media: MediaLookup,
): KadrStripProjectorPreview | undefined {
  if (cue.mode === "video" && cue.videoId > 0) {
    const title =
      media.videos?.find((video) => video.id === cue.videoId)?.title?.trim() ||
      `Видео ${cue.videoId}`;
    return { mode: "video", videoId: cue.videoId, holdId: null, title };
  }

  if (cue.mode === "hold") {
    const holdId = cue.holdId != null && cue.holdId > 0 ? cue.holdId : null;
    const title =
      (holdId != null
        ? media.holdImages?.find((hold) => hold.id === holdId)?.title?.trim()
        : null) || "Заставка";
    return { mode: "hold", videoId: null, holdId, title };
  }

  return undefined;
}

function formatVideoSummary(
  markdown: string,
  section: MarkdownKadrSection,
  media: MediaLookup,
): { value: string; projectorPreview?: KadrStripProjectorPreview } | null {
  const cue = parseProjectorLineInSection(markdown, section);
  if (cue) {
    const projectorPreview = buildProjectorPreview(cue, media);
    if (cue.mode === "video") {
      const title = media.videos?.find((v) => v.id === cue.videoId)?.title?.trim();
      const value = title ? title : `Видео ${cue.videoId}`;
      return { value, projectorPreview };
    }

    if (cue.holdId != null && cue.holdId > 0) {
      const title = media.holdImages?.find((h) => h.id === cue.holdId)?.title?.trim();
      const value = title ? title : `Заставка ${cue.holdId}`;
      return { value, projectorPreview };
    }

    return { value: "Заставка", projectorPreview };
  }

  const body = findProjectorLineInSection(markdown, section);
  if (body == null) return null;
  const value = humanizeStripFieldValue(stripKadrFieldMarkdown(body));
  if (!value || isKadrPlaceholderText(value)) return null;
  return { value };
}

function pushTextField(
  rows: KadrStripTechRow[],
  label: string,
  markdown: string,
  section: MarkdownKadrSection,
  pattern: RegExp,
): void {
  const body = findFieldBody(markdown, section, pattern);
  if (body == null) return;
  const value = humanizeStripFieldValue(stripKadrFieldMarkdown(body));
  if (!value || isKadrPlaceholderText(value)) return;
  rows.push({ label, value });
}

export function buildKadrStripTechSummary(args: {
  item: SpectacleTapeItem;
  step: ScriptStep | undefined;
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1;
  lightPrograms?: SceneLightProgramsDataV1 | null;
  media?: MediaLookup;
}): KadrStripTechSummary {
  const { item, step } = args;
  const headingTitle = item.isPlaceholder
    ? "Без картин"
    : parseKadrTitleFromHeading(item.headingTitle ?? "", item.kadrNo);

  if (item.isPlaceholder || !item.section || !step) {
    return { headingTitle, rows: [], blackout: false, cornerLabels: [] };
  }

  const markdown = String(step.markdown ?? "");
  const section = item.section;
  const kadr = resolveKadrForItem(item, step);
  const rows: KadrStripTechRow[] = [];
  const media = args.media ?? {};

  if (kadr) {
    rows.push({
      label: "Свет",
      value: formatLightSummary(kadr, args.lightChannels, args.lightFaders, args.lightPrograms),
    });
    const faders = formatFaderSummary(kadr);
    if (faders) rows.push({ label: "Фейдеры", value: faders });
    if (kadr.nextProgramId != null && kadr.nextProgramId > 0) {
      const next = programLabel(kadr.nextProgramId, args.lightChannels, args.lightPrograms);
      rows.push({ label: "Далее", value: `П${kadr.nextProgramId} · ${next}` });
    }
  }

  const sound = formatSoundSummary(markdown, section, media) ?? formatSoundFallback(markdown, section);
  if (sound) rows.push({ label: "Звук", value: sound });

  const video = formatVideoSummary(markdown, section, media);
  if (video) {
    rows.push({
      label: "Видео",
      value: video.value,
      projectorPreview: video.projectorPreview,
    });
  }

  pushTextField(rows, "Действие", markdown, section, ACTION_FIELD_RE);

  const cornerLabels = parseKadrLabelsInSection(markdown, section);

  return {
    headingTitle,
    rows,
    blackout: Boolean(kadr?.blackout || (kadr && kadr.programId <= 0)),
    cornerLabels,
  };
}
