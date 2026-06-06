import type {
  SceneLightChannelRolesV1,
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../scene/model/scene-slice";
import type {
  ScriptStep,
  StepLightKadrV1,
  StepLightKadrsDataV1,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { normalizeSelectedRecordChannels } from "../../../shared/components/light-console/light-channel-roles";
import { resolveLightFaders, resolveLightPrograms } from "../../../shared/components/light-console/light-console-data";
import { formatFaderShort } from "../../../shared/components/light-console/light-console-labels";
import { buildKadrFaderSnapshotFromSofitChannels } from "../../theater/model/theater-light-fader-bindings";
import {
  buildKadrFromConsole,
  findKadrById,
  type MarkdownKadrSection,
  readStepLightKadrsFromMarkdown,
  recordKadrToMarkdown,
  scanMarkdownKadrSections,
  upsertKadrInStep,
} from "../../theater/model/light-kadrs";
import {
  formatProjectorKadrLine,
  parseProjectorLineInSection,
  upsertProjectorLineInSection,
  VIDEO_LINE_PREFIX,
  type KadrProjectorCue,
} from "../../theater/model/kadr-projector";
import {
  formatSoundKadrLine,
  parseSoundLineInSection,
  upsertSoundLineInSection,
  type KadrSoundCue,
} from "../../theater/model/kadr-sound";
import {
  buildKadrRunLabelsFromDraft,
  parseKadrLabelsInSection,
  upsertKadrLabelsInSection,
} from "./kadr-section-labels";
import {
  insertKadrSectionImageAfterTransition,
  parseKadrSectionImageMarkdownInSection,
  stripKadrSectionStandaloneImages,
} from "./kadr-section-image";
import {
  parseKadrTransitionRawInSection,
  upsertKadrTransitionInSection,
} from "./kadr-section-transition";
import {
  insertKadrAfterInStep,
  type InsertKadrAfterTarget,
  type SpectacleTapeItem,
} from "./spectacle-kadr-tape";
import { getPlaylistPlaybackSnapshot } from "../../scene/model/scene-playback-bridge";
import { readPlayerVolume } from "../../../shared/player/player-prefs";

export type CreateKadrFaderOption = {
  key: string;
  channel: number;
  faderId: number;
  label: string;
  intensity: number;
  enabled: boolean;
};

export type KadrModalMode = "create" | "edit";

export type CreateKadrDraft = {
  title: string;
  playTrackId: number | null;
  soundIds: number[];
  projectorCue: KadrProjectorCue | null;
  blackout: boolean;
  programId: number;
  recordChannels: number[];
  includedFaderKeys: string[];
  faderLevels: Record<string, number>;
  imageMarkdown: string;
  blackoutDurationSec: number | null;
  smokeDurationSec: number | null;
  transitionText: string;
};

export function faderOptionKey(channel: number, faderId: number): string {
  return `${channel}:${faderId}`;
}

export function parseFaderOptionKey(key: string, fallbackChannel: number): {
  channel: number;
  faderId: number;
} | null {
  const [channelRaw, faderRaw] = String(key ?? "").split(":");
  const faderId = Math.trunc(Number(faderRaw) || 0);
  if (faderId <= 0) return null;
  const channel = Math.trunc(Number(channelRaw) || fallbackChannel) || fallbackChannel;
  return { channel, faderId };
}

export function buildFaderLevelsFromOptions(
  options: CreateKadrFaderOption[],
  prev?: Record<string, number>,
): Record<string, number> {
  const levels: Record<string, number> = { ...(prev ?? {}) };
  for (const item of options) {
    if (levels[item.key] == null) {
      levels[item.key] = item.intensity;
    }
  }
  return levels;
}

function applyDraftFaderStates(
  kadr: StepLightKadrV1,
  draft: CreateKadrDraft,
  liveConsoleChannel: number,
): StepLightKadrV1 {
  if (draft.blackout) {
    return { ...kadr, programId: 0, blackout: true, faders: [] };
  }

  const included = new Set(draft.includedFaderKeys);
  if (included.size === 0) {
    return { ...kadr, faders: [] };
  }

  const snapshotByKey = new Map(
    kadr.faders.map((row) => [
      faderOptionKey(row.channel ?? liveConsoleChannel, row.faderId),
      row,
    ]),
  );

  const faders = draft.includedFaderKeys
    .map((key) => {
      if (!included.has(key)) return null;
      const parsed = parseFaderOptionKey(key, liveConsoleChannel);
      if (!parsed) return null;
      const existing = snapshotByKey.get(key);
      const rawLevel = draft.faderLevels[key];
      const intensity =
        rawLevel != null
          ? Math.min(1, Math.max(0, rawLevel))
          : (existing?.intensity ?? 0);
      return {
        faderId: parsed.faderId,
        channel: parsed.channel,
        intensity,
        enabled: intensity > 0.02,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  return { ...kadr, faders };
}

export function listCreateKadrFaderOptions(args: {
  recordChannels: number[];
  liveConsoleChannel: number;
  liveFaders: SceneLightFadersDataV1;
  lightFaders: SceneLightFadersDataV1;
  lightPrograms: SceneLightProgramsDataV1 | null | undefined;
  spotlights: TheaterSpotlight[];
  lightChannelsCount: number;
}): CreateKadrFaderOption[] {
  const programs = resolveLightPrograms(args.lightPrograms);
  const baseFaders = resolveLightFaders(args.lightFaders);
  const liveFaders = resolveLightFaders(args.liveFaders);
  const channels = normalizeSelectedRecordChannels(
    args.recordChannels,
    args.lightChannelsCount,
  );
  if (channels.length === 0) return [];

  const rows = buildKadrFaderSnapshotFromSofitChannels({
    baseFaders,
    programs,
    sofitChannels: channels,
    liveChannel: args.liveConsoleChannel,
    liveFaders,
    lightChannelsCount: args.lightChannelsCount,
    spotlights: args.spotlights,
  });

  return rows.map((row) => {
    const channel = row.channel ?? args.liveConsoleChannel;
    const faderId = row.faderId;
    const level = row.intensity ?? 0;
    const on = (row.enabled ?? true) !== false && level > 0.02;
    return {
      key: faderOptionKey(channel, faderId),
      channel,
      faderId,
      label: `K${channel} · ${formatFaderShort(faderId)}`,
      intensity: level,
      enabled: on,
    };
  });
}

export function buildInitialCreateKadrDraft(args: {
  lightChannelsCount: number;
  lightChannelRoles: SceneLightChannelRolesV1 | null;
  liveConsoleChannel: number;
  liveFaders: SceneLightFadersDataV1;
  lightFaders: SceneLightFadersDataV1;
  lightPrograms: SceneLightProgramsDataV1 | null | undefined;
  spotlights: TheaterSpotlight[];
}): CreateKadrDraft {
  const recordChannels = normalizeSelectedRecordChannels(
    args.lightChannelRoles?.sofitChannels,
    args.lightChannelsCount,
  );
  const programs = resolveLightPrograms(args.lightPrograms);
  const faderOptions = listCreateKadrFaderOptions({
    recordChannels,
    liveConsoleChannel: args.liveConsoleChannel,
    liveFaders: args.liveFaders,
    lightFaders: args.lightFaders,
    lightPrograms: args.lightPrograms,
    spotlights: args.spotlights,
    lightChannelsCount: args.lightChannelsCount,
  });

  return {
    title: "",
    playTrackId: null,
    soundIds: [],
    projectorCue: null,
    blackout: false,
    programId: programs.activeProgramId ?? 1,
    recordChannels,
    includedFaderKeys: faderOptions.map((item) => item.key),
    faderLevels: buildFaderLevelsFromOptions(faderOptions),
    imageMarkdown: "",
    blackoutDurationSec: null,
    smokeDurationSec: null,
    transitionText: "",
  };
}

function applyKadrHeadingTitle(
  markdown: string,
  section: MarkdownKadrSection,
  title: string,
): string {
  const trimmed = title.trim();
  if (!trimmed) return markdown;
  const lineEnd = markdown.indexOf("\n", section.headingStart);
  const headingLineEnd = lineEnd === -1 ? section.headingEnd : lineEnd;
  const nextHeading = `### Картина ${section.kadrNo} · ${trimmed}`;
  return markdown.slice(0, section.headingStart) + nextHeading + markdown.slice(headingLineEnd);
}

function findSectionByKadrId(markdown: string, kadrId: string): MarkdownKadrSection | null {
  return scanMarkdownKadrSections(markdown).find((section) => section.id === kadrId) ?? null;
}

export function parseKadrTitleFromHeading(headingTitle: string, kadrNo: number): string {
  const prefix = new RegExp(`^Картина\\s+${kadrNo}\\s*(?:·\\s*)?`, "i");
  return String(headingTitle ?? "").replace(prefix, "").trim();
}

const PROJECTOR_PLACEHOLDER_LINE = `${VIDEO_LINE_PREFIX} _«Записать проектор» — ролик на экран_`;

type ApplyKadrDraftArgs = {
  draft: CreateKadrDraft;
  kadrId: string;
  kadrNo: number;
  markdown: string;
  kadrs: StepLightKadrsDataV1;
  section: MarkdownKadrSection;
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1;
  lightPrograms: SceneLightProgramsDataV1 | null | undefined;
  spotlights: TheaterSpotlight[];
  liveConsoleChannel: number;
  liveFaders: SceneLightFadersDataV1;
  playlist: Array<{ id: number; title: string }>;
  sounds: Array<{ id: number; title: string }>;
  videos: Array<{ id: number; title: string }>;
  holdImages: Array<{ id: number; title: string }>;
  summaryVerb: "создана" | "обновлена";
  clearEmptyMedia: boolean;
};

function applyKadrDraftToSection(args: ApplyKadrDraftArgs): {
  nextMarkdown: string;
  nextKadrs: StepLightKadrsDataV1;
  kadrId: string;
  kadrNo: number;
  summary: string;
} | null {
  const { draft, kadrId, kadrNo } = args;
  let markdown = args.markdown;
  let kadrs = args.kadrs;
  let section = args.section;

  markdown = applyKadrHeadingTitle(markdown, section, draft.title);
  section = findSectionByKadrId(markdown, kadrId);
  if (!section) return null;

  const faders = resolveLightFaders(args.lightFaders);
  const liveFaders = resolveLightFaders(args.liveFaders);
  const programs = resolveLightPrograms(args.lightPrograms);
  const recordChannels = normalizeSelectedRecordChannels(
    draft.recordChannels,
    args.lightChannels.length,
  );
  const isBlackout = draft.blackout;

  let kadr: StepLightKadrV1 = buildKadrFromConsole({
    id: kadrId,
    kadrNo,
    title: draft.title.trim() || section.headingTitle,
    programId: isBlackout ? 0 : Math.max(1, Math.trunc(draft.programId) || 1),
    faders,
    spotlights: args.spotlights,
    lightPrograms: programs,
    sofitChannels: recordChannels,
    liveConsoleChannel: args.liveConsoleChannel,
    lightChannelsCount: args.lightChannels.length,
    blackout: isBlackout ? true : undefined,
  });

  kadr = applyDraftFaderStates(kadr, draft, args.liveConsoleChannel);

  kadrs = upsertKadrInStep({ kadrs, kadr });
  markdown = recordKadrToMarkdown({
    markdown,
    section: { ...section, id: kadrId },
    kadr,
    lightChannels: args.lightChannels,
    lightFaders: faders,
    programs: args.lightPrograms,
  });
  section = findSectionByKadrId(markdown, kadrId);
  if (!section) return null;

  const hasSound =
    (draft.playTrackId != null && draft.playTrackId > 0) || draft.soundIds.length > 0;

  if (hasSound || args.clearEmptyMedia) {
    const snap = getPlaylistPlaybackSnapshot();
    const cue: KadrSoundCue = hasSound
      ? {
          playTrackIds:
            draft.playTrackId != null && draft.playTrackId > 0 ? [draft.playTrackId] : [],
          soundIds: [...new Set(draft.soundIds.filter((id) => id > 0))],
          volume: snap.volume ?? readPlayerVolume(),
        }
      : { playTrackIds: [], soundIds: [] };
    const soundLine = formatSoundKadrLine(cue, {
      playlist: args.playlist,
      sounds: args.sounds,
    });
    markdown = upsertSoundLineInSection(markdown, section, soundLine);
  }

  if (draft.projectorCue || args.clearEmptyMedia) {
    section = findSectionByKadrId(markdown, kadrId);
    if (!section) return null;
    const projectorLine = draft.projectorCue
      ? formatProjectorKadrLine(draft.projectorCue, {
          videos: args.videos,
          holdImages: args.holdImages,
        })
      : PROJECTOR_PLACEHOLDER_LINE;
    markdown = upsertProjectorLineInSection(markdown, section, projectorLine);
  }

  const runLabels = buildKadrRunLabelsFromDraft({
    blackoutDurationSec: draft.blackoutDurationSec,
    smokeDurationSec: draft.smokeDurationSec,
  });
  if (runLabels.length > 0 || args.clearEmptyMedia) {
    section = findSectionByKadrId(markdown, kadrId);
    if (!section) return null;
    markdown = upsertKadrLabelsInSection(markdown, section, runLabels);
  }

  if (draft.transitionText.trim() || args.clearEmptyMedia) {
    section = findSectionByKadrId(markdown, kadrId);
    if (!section) return null;
    markdown = upsertKadrTransitionInSection(markdown, section, draft.transitionText.trim());
  }

  section = findSectionByKadrId(markdown, kadrId);
  if (!section) return null;
  if (draft.imageMarkdown.trim()) {
    markdown = insertKadrSectionImageAfterTransition(markdown, section, draft.imageMarkdown);
  } else if (args.clearEmptyMedia) {
    markdown = stripKadrSectionStandaloneImages(markdown, section);
  }

  kadrs = upsertKadrInStep({
    kadrs,
    kadr: { ...kadr, title: draft.title.trim() || kadr.title },
  });

  const parts = [`Картина ${kadrNo} ${args.summaryVerb}`];
  if (isBlackout) parts.push("блекаут");
  else if (kadr.faders.length > 0) parts.push(`свет · ${kadr.faders.length} F`);
  if (hasSound) parts.push("звук");
  if (draft.projectorCue) parts.push("видео");
  if (draft.imageMarkdown.trim()) parts.push("картинка");
  if (runLabels.length > 0) parts.push("метки");
  if (draft.transitionText.trim()) parts.push("переход");

  return {
    nextMarkdown: markdown,
    nextKadrs: kadrs,
    kadrId,
    kadrNo,
    summary: parts.join(" · "),
  };
}

export function buildEditKadrDraftFromTapeItem(args: {
  step: ScriptStep;
  item: SpectacleTapeItem;
  lightPrograms: SceneLightProgramsDataV1 | null | undefined;
}): CreateKadrDraft | null {
  const { step, item } = args;
  if (item.isPlaceholder || !item.section) return null;

  const markdown = String(step.markdown ?? "");
  const section = item.section;
  const kadrs = readStepLightKadrsFromMarkdown(step);
  const kadrId = item.kadrId ?? section.id;
  const kadr =
    (kadrId ? findKadrById(kadrs, kadrId) : undefined) ??
    kadrs.kadrs.find((row) => row.kadrNo === item.kadrNo);
  if (!kadr) return null;

  const title =
    parseKadrTitleFromHeading(section.headingTitle, item.kadrNo) ||
    kadr.title?.trim() ||
    "";

  const soundCue = parseSoundLineInSection(markdown, section);
  const projectorCue = parseProjectorLineInSection(markdown, section);
  const labels = parseKadrLabelsInSection(markdown, section);
  const blackoutLabel = labels.find((label) => label.type === "blackout");
  const smokeLabel = labels.find((label) => label.type === "smoke");

  const isBlackout = Boolean(kadr.blackout || kadr.programId <= 0);
  const programs = resolveLightPrograms(args.lightPrograms);
  const recordChannels = kadr.recordChannels ?? [];
  const includedFaderKeys = kadr.faders.map((row) =>
    faderOptionKey(row.channel ?? recordChannels[0] ?? 1, row.faderId),
  );
  const faderLevels: Record<string, number> = {};
  for (const row of kadr.faders) {
    const key = faderOptionKey(row.channel ?? recordChannels[0] ?? 1, row.faderId);
    faderLevels[key] = Math.min(1, Math.max(0, row.intensity ?? 0));
  }

  return {
    title,
    playTrackId: soundCue?.playTrackIds[0] ?? null,
    soundIds: soundCue?.soundIds ?? [],
    projectorCue,
    blackout: isBlackout,
    programId: isBlackout
      ? programs.activeProgramId ?? 1
      : Math.max(1, Math.trunc(kadr.programId) || 1),
    recordChannels,
    includedFaderKeys,
    faderLevels,
    imageMarkdown: parseKadrSectionImageMarkdownInSection(markdown, section),
    blackoutDurationSec: blackoutLabel?.seconds ?? null,
    smokeDurationSec: smokeLabel?.seconds ?? null,
    transitionText: parseKadrTransitionRawInSection(markdown, section),
  };
}

export function updateKadrFromDraft(args: {
  step: ScriptStep;
  item: SpectacleTapeItem;
  draft: CreateKadrDraft;
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1;
  lightPrograms: SceneLightProgramsDataV1 | null | undefined;
  spotlights: TheaterSpotlight[];
  liveConsoleChannel: number;
  liveFaders: SceneLightFadersDataV1;
  playlist: Array<{ id: number; title: string }>;
  sounds: Array<{ id: number; title: string }>;
  videos: Array<{ id: number; title: string }>;
  holdImages: Array<{ id: number; title: string }>;
}): {
  nextMarkdown: string;
  nextKadrs: StepLightKadrsDataV1;
  kadrId: string;
  kadrNo: number;
  summary: string;
} | null {
  const { step, item, draft } = args;
  if (item.isPlaceholder || !item.section) return null;

  const kadrId = item.kadrId ?? item.section.id;
  if (!kadrId) return null;

  const markdown = String(step.markdown ?? "");
  const kadrs = readStepLightKadrsFromMarkdown(step);
  const section = findSectionByKadrId(markdown, kadrId) ?? item.section;
  if (!section) return null;

  return applyKadrDraftToSection({
    draft,
    kadrId,
    kadrNo: item.kadrNo,
    markdown,
    kadrs,
    section,
    lightChannels: args.lightChannels,
    lightFaders: args.lightFaders,
    lightPrograms: args.lightPrograms,
    spotlights: args.spotlights,
    liveConsoleChannel: args.liveConsoleChannel,
    liveFaders: args.liveFaders,
    playlist: args.playlist,
    sounds: args.sounds,
    videos: args.videos,
    holdImages: args.holdImages,
    summaryVerb: "обновлена",
    clearEmptyMedia: true,
  });
}

export function createKadrFromDraft(args: {
  step: ScriptStep;
  draft: CreateKadrDraft;
  insertAfter?: InsertKadrAfterTarget | null;
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1;
  lightPrograms: SceneLightProgramsDataV1 | null | undefined;
  spotlights: TheaterSpotlight[];
  liveConsoleChannel: number;
  liveFaders: SceneLightFadersDataV1;
  playlist: Array<{ id: number; title: string }>;
  sounds: Array<{ id: number; title: string }>;
  videos: Array<{ id: number; title: string }>;
  holdImages: Array<{ id: number; title: string }>;
}): {
  nextMarkdown: string;
  nextKadrs: StepLightKadrsDataV1;
  kadrId: string;
  kadrNo: number;
  summary: string;
} | null {
  const { step, draft } = args;
  const base = insertKadrAfterInStep({ step, after: args.insertAfter ?? null });
  const section = findSectionByKadrId(base.nextMarkdown, base.kadrId);
  if (!section) return null;

  return applyKadrDraftToSection({
    draft,
    kadrId: base.kadrId,
    kadrNo: base.kadrNo,
    markdown: base.nextMarkdown,
    kadrs: base.nextKadrs,
    section,
    lightChannels: args.lightChannels,
    lightFaders: args.lightFaders,
    lightPrograms: args.lightPrograms,
    spotlights: args.spotlights,
    liveConsoleChannel: args.liveConsoleChannel,
    liveFaders: args.liveFaders,
    playlist: args.playlist,
    sounds: args.sounds,
    videos: args.videos,
    holdImages: args.holdImages,
    summaryVerb: "создана",
    clearEmptyMedia: false,
  });
}
