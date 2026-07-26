import type {
  PlaybookLightChannelRolesV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../playbook/model/playbook-slice";
import type {
  ScriptScene,
  SceneLightKadrRequisiteCueV1,
  SceneLightKadrV1,
  SceneLightKadrsDataV1,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { normalizeSelectedRecordChannels } from "../../../shared/components/light-console/light-channel-roles";
import { resolveLightFaders, resolveLightPrograms } from "../../../shared/components/light-console/light-console-data";
import { formatFaderShort } from "../../../shared/components/light-console/light-console-labels";
import { buildKadrFaderSnapshotFromSofitChannels } from "../../theater/model/theater-light-fader-bindings";
import {
  buildKadrFromConsole,
  findKadrById,
  readSceneLightKadrs,
} from "../../theater/model/light-kadrs";
import {
  insertKadrInSceneData,
  upsertFullKadrInScene,
} from "../../theater/model/kadr-store";
import type { KadrProjectorCue } from "../../theater/model/kadr-projector";
import { getPlaylistPlaybackSnapshot } from "../../playbook/model/playbook-playback-bridge";
import { readPlayerVolume } from "../../../shared/player/player-prefs";
import type { InsertKadrAfterTarget, SpectacleTapeItem } from "./spectacle-kadr-tape";

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
  requisites: SceneLightKadrRequisiteCueV1[];
  blackout: boolean;
  programId: number;
  recordChannels: number[];
  includedFaderKeys: string[];
  faderLevels: Record<string, number>;
  imageMarkdown: string;
  blackoutDurationSec: number | null;
  smokeDurationSec: number | null;
  transitionText: string;
  commentText: string;
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

/** Поддерживает список фейдеров при смене каналов K: не включает новые F автоматически. */
export function syncDraftFaderOptions(
  draft: Pick<CreateKadrDraft, "includedFaderKeys" | "faderLevels">,
  options: CreateKadrFaderOption[],
): Pick<CreateKadrDraft, "includedFaderKeys" | "faderLevels"> {
  const validKeys = new Set(options.map((item) => item.key));
  const includedFaderKeys = draft.includedFaderKeys.filter((key) => validKeys.has(key));
  const prunedLevels = Object.fromEntries(
    Object.entries(draft.faderLevels).filter(([key]) => validKeys.has(key)),
  ) as Record<string, number>;
  const faderLevels = buildFaderLevelsFromOptions(options, prunedLevels);
  return { includedFaderKeys, faderLevels };
}

function applyDraftFaderStates(
  kadr: SceneLightKadrV1,
  draft: CreateKadrDraft,
  liveConsoleChannel: number,
): SceneLightKadrV1 {
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
  liveFaders: PlaybookLightFadersDataV1;
  lightFaders: PlaybookLightFadersDataV1;
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined;
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
  lightChannelRoles: PlaybookLightChannelRolesV1 | null;
  liveConsoleChannel: number;
  liveFaders: PlaybookLightFadersDataV1;
  lightFaders: PlaybookLightFadersDataV1;
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined;
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
    requisites: [],
    blackout: false,
    programId: programs.activeProgramId ?? 1,
    recordChannels,
    includedFaderKeys: [],
    faderLevels: buildFaderLevelsFromOptions(faderOptions),
    imageMarkdown: "",
    blackoutDurationSec: null,
    smokeDurationSec: null,
    transitionText: "",
    commentText: "",
  };
}

export function parseKadrTitleFromHeading(headingTitle: string, kadrNo: number): string {
  const prefix = new RegExp(`^Картина\\s+${kadrNo}\\s*(?:·\\s*)?`, "i");
  return String(headingTitle ?? "").replace(prefix, "").trim();
}

type ApplyKadrDraftArgs = {
  draft: CreateKadrDraft;
  kadrId: string;
  kadrNo: number;
  kadrs: SceneLightKadrsDataV1;
  lightChannels: string[];
  lightFaders: PlaybookLightFadersDataV1;
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined;
  spotlights: TheaterSpotlight[];
  liveConsoleChannel: number;
  liveFaders: PlaybookLightFadersDataV1;
  summaryVerb: "создана" | "обновлена";
  smokeMachineEnabled?: boolean;
  existingTitle?: string;
};

function applyKadrDraftToJson(args: ApplyKadrDraftArgs): {
  nextKadrs: SceneLightKadrsDataV1;
  kadrId: string;
  kadrNo: number;
  summary: string;
} | null {
  const { draft, kadrId, kadrNo } = args;
  const faders = resolveLightFaders(args.lightFaders);
  const programs = resolveLightPrograms(args.lightPrograms);
  const recordChannels = normalizeSelectedRecordChannels(
    draft.recordChannels,
    args.lightChannels.length,
  );
  const isBlackout = draft.blackout;
  const title = draft.title.trim() || args.existingTitle?.trim() || undefined;

  let kadr: SceneLightKadrV1 = buildKadrFromConsole({
    id: kadrId,
    kadrNo,
    title,
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

  const hasSound =
    (draft.playTrackId != null && draft.playTrackId > 0) || draft.soundIds.length > 0;
  if (hasSound) {
    const snap = getPlaylistPlaybackSnapshot();
    kadr = {
      ...kadr,
      sound: {
        playTrackIds:
          draft.playTrackId != null && draft.playTrackId > 0 ? [draft.playTrackId] : [],
        soundIds: [...new Set(draft.soundIds.filter((id) => id > 0))],
        volume: snap.volume ?? readPlayerVolume(),
      },
    };
  } else {
    const { sound: _removed, ...rest } = kadr;
    kadr = rest;
  }

  if (draft.projectorCue) {
    kadr = { ...kadr, projector: draft.projectorCue };
  } else {
    const { projector: _removed, ...rest } = kadr;
    kadr = rest;
  }

  if (draft.requisites.length > 0) {
    kadr = { ...kadr, requisites: draft.requisites };
  } else {
    const { requisites: _removed, ...rest } = kadr;
    kadr = rest;
  }

  const smokeMachineEnabled = args.smokeMachineEnabled === true;
  kadr = {
    ...kadr,
    title,
    transitionText: draft.transitionText.trim() || undefined,
    commentText: draft.commentText.trim() || undefined,
    imageMarkdown: draft.imageMarkdown.trim() || undefined,
    blackoutDurationSec:
      draft.blackoutDurationSec != null && draft.blackoutDurationSec > 0
        ? Math.trunc(draft.blackoutDurationSec)
        : undefined,
    smokeDurationSec:
      draft.smokeDurationSec != null && draft.smokeDurationSec > 0
        ? Math.trunc(draft.smokeDurationSec)
        : undefined,
    ...(smokeMachineEnabled || draft.smokeDurationSec != null
      ? { smokeMachine: true }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  if (!smokeMachineEnabled && draft.smokeDurationSec == null) {
    const { smokeMachine: _removed, ...rest } = kadr;
    kadr = rest;
  }

  const nextKadrs = upsertFullKadrInScene({ kadrs: args.kadrs, kadr });

  const parts = [`Картина ${kadrNo} ${args.summaryVerb}`];
  if (isBlackout) parts.push("блекаут");
  else if (kadr.faders.length > 0) parts.push(`свет · ${kadr.faders.length} F`);
  if (hasSound) parts.push("звук");
  if (draft.projectorCue) parts.push("видео");
  if (draft.requisites.length > 0) parts.push("реквизит");
  if (draft.imageMarkdown.trim()) parts.push("картинка");
  if (draft.blackoutDurationSec != null || draft.smokeDurationSec != null) parts.push("метки");
  if (draft.transitionText.trim()) parts.push("переход");
  if (draft.commentText.trim()) parts.push("комментарий");

  return {
    nextKadrs,
    kadrId,
    kadrNo,
    summary: parts.join(" · "),
  };
}

export function buildEditKadrDraftFromTapeItem(args: {
  scene: ScriptScene;
  item: SpectacleTapeItem;
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined;
}): CreateKadrDraft | null {
  const { scene, item } = args;
  if (item.isPlaceholder) return null;

  const kadrs = readSceneLightKadrs(scene);
  const kadr =
    (item.kadrId ? findKadrById(kadrs, item.kadrId) : undefined) ??
    kadrs.kadrs.find((row) => row.kadrNo === item.kadrNo);
  if (!kadr) return null;

  const title =
    kadr.title?.trim() ||
    parseKadrTitleFromHeading(item.headingTitle, item.kadrNo) ||
    "";

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
    playTrackId: kadr.sound?.playTrackIds?.[0] ?? null,
    soundIds: kadr.sound?.soundIds ?? [],
    projectorCue: kadr.projector ?? null,
    requisites: kadr.requisites ?? [],
    blackout: isBlackout,
    programId: isBlackout
      ? programs.activeProgramId ?? 1
      : Math.max(1, Math.trunc(kadr.programId) || 1),
    recordChannels,
    includedFaderKeys,
    faderLevels,
    imageMarkdown: kadr.imageMarkdown ?? "",
    blackoutDurationSec: kadr.blackoutDurationSec ?? null,
    smokeDurationSec: kadr.smokeDurationSec ?? null,
    transitionText: kadr.transitionText ?? "",
    commentText: kadr.commentText ?? kadr.note ?? "",
  };
}

export function updateKadrFromDraft(args: {
  scene: ScriptScene;
  item: SpectacleTapeItem;
  draft: CreateKadrDraft;
  lightChannels: string[];
  lightFaders: PlaybookLightFadersDataV1;
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined;
  spotlights: TheaterSpotlight[];
  liveConsoleChannel: number;
  liveFaders: PlaybookLightFadersDataV1;
  playlist: Array<{ id: number; title: string }>;
  sounds: Array<{ id: number; title: string }>;
  videos: Array<{ id: number; title: string }>;
  holdImages: Array<{ id: number; title: string }>;
}): {
  nextKadrs: SceneLightKadrsDataV1;
  kadrId: string;
  kadrNo: number;
  summary: string;
} | null {
  const { scene, item, draft } = args;
  if (item.isPlaceholder || !item.kadrId) return null;

  return applyKadrDraftToJson({
    draft,
    kadrId: item.kadrId,
    kadrNo: item.kadrNo,
    kadrs: readSceneLightKadrs(scene),
    lightChannels: args.lightChannels,
    lightFaders: args.lightFaders,
    lightPrograms: args.lightPrograms,
    spotlights: args.spotlights,
    liveConsoleChannel: args.liveConsoleChannel,
    liveFaders: args.liveFaders,
    summaryVerb: "обновлена",
    smokeMachineEnabled: scene.theaterSmokeMachine === true,
    existingTitle: item.headingTitle,
  });
}

export function createKadrFromDraft(args: {
  scene: ScriptScene;
  draft: CreateKadrDraft;
  insertAfter?: InsertKadrAfterTarget | null;
  lightChannels: string[];
  lightFaders: PlaybookLightFadersDataV1;
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined;
  spotlights: TheaterSpotlight[];
  liveConsoleChannel: number;
  liveFaders: PlaybookLightFadersDataV1;
  playlist: Array<{ id: number; title: string }>;
  sounds: Array<{ id: number; title: string }>;
  videos: Array<{ id: number; title: string }>;
  holdImages: Array<{ id: number; title: string }>;
}): {
  nextKadrs: SceneLightKadrsDataV1;
  kadrId: string;
  kadrNo: number;
  summary: string;
} | null {
  const { scene, draft } = args;
  const base = insertKadrInSceneData({
    scene,
    afterKadrId: args.insertAfter?.id ?? null,
  });

  return applyKadrDraftToJson({
    draft,
    kadrId: base.kadrId,
    kadrNo: base.kadrNo,
    kadrs: base.nextKadrs,
    lightChannels: args.lightChannels,
    lightFaders: args.lightFaders,
    lightPrograms: args.lightPrograms,
    spotlights: args.spotlights,
    liveConsoleChannel: args.liveConsoleChannel,
    liveFaders: args.liveFaders,
    summaryVerb: "создана",
    smokeMachineEnabled: scene.theaterSmokeMachine === true,
  });
}
