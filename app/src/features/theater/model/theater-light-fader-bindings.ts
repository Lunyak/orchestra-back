import type {
  PlaybookLightFaderV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../playbook/model/playbook-slice";
import type { SceneLightKadrFaderStateV1 } from "../../../shared/types/script";
import {
  applyProgramFaderStatesToBoard,
  buildCompleteLightFaders,
  buildFaderBoardForConsoleChannel,
  readProgramChannelFaderStates,
  resolveLightPrograms,
} from "../../../shared/components/light-console/light-console-data";
import { normalizeSelectedRecordChannels } from "../../../shared/components/light-console/light-channel-roles";
import type { ScriptScene, TheaterSpotlight } from "../../../shared/types/script";
import {
  formatChannelShort,
  formatFaderShort,
} from "../../../shared/components/light-console/light-console-labels";
import {
  THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
  THEATER_SPOTLIGHT_UI_INTENSITY_MAX,
} from "./theater-scene-lighting";

export function formatCompactChannelSlot(slot: number): string {
  return formatChannelShort(slot);
}

export function formatCompactFaderLabel(faderId: number): string {
  return formatFaderShort(faderId);
}

/** UI-яркость софита → уровень F (0…1) для общей доски пульта. */
export function sceneFaderLevelFromSpotlightUiIntensity(uiIntensity: number): number {
  const max = THEATER_SPOTLIGHT_UI_INTENSITY_MAX;
  if (!Number.isFinite(uiIntensity) || max <= 0) return 0;
  return Math.min(1, Math.max(0, uiIntensity / max));
}

export function hasSpotlightFaderId(spotlight: TheaterSpotlight): boolean {
  return Number.isFinite(spotlight.faderId);
}

/** Явно заданный фейдер софита. Без подстановки id софита. */
export function readSpotlightFaderId(spotlight: TheaterSpotlight): number | undefined {
  if (!Number.isFinite(spotlight.faderId)) return undefined;
  return Math.max(1, Math.trunc(spotlight.faderId!));
}

export function readSpotlightChannel(spotlight: TheaterSpotlight): number | undefined {
  const raw = spotlight.channel;
  if (raw === null || raw === undefined) return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

/** Канал фейдера для конкретного софита (из link или поля channel). */
export function readFaderChannelForSpotlight(
  fader: PlaybookLightFaderV1,
  spotlightId?: number,
): number | undefined {
  if (spotlightId != null) {
    const link = (fader.links ?? []).find(
      (item) =>
        item.spotlightId === spotlightId && Number.isFinite(item.channel),
    );
    if (link) return Math.max(1, Math.trunc(link.channel));
    if (fader.spotlightId === spotlightId && Number.isFinite(fader.channel)) {
      return Math.max(1, Math.trunc(fader.channel!));
    }
    return undefined;
  }
  if (Number.isFinite(fader.channel)) return Math.max(1, Math.trunc(fader.channel!));
  const firstLink = (fader.links ?? []).find((item) => Number.isFinite(item.channel));
  if (firstLink) return Math.max(1, Math.trunc(firstLink.channel));
  return undefined;
}

export type FaderMatchOptions = {
  /** Активный канал на пульте (выбранный слот). Фейдер влияет только на софиты этого канала. */
  consoleChannel?: number;
};

/** Софит подчиняется фейдеру при совпадении faderId и канала (канал пульта или привязки link). */
export function spotlightMatchesFader(
  spotlight: TheaterSpotlight,
  fader: PlaybookLightFaderV1,
  options?: FaderMatchOptions,
): boolean {
  if (readSpotlightFaderId(spotlight) !== fader.id) return false;
  const spotChannel = readSpotlightChannel(spotlight);
  if (spotChannel == null) return false;

  const consoleChannel =
    options?.consoleChannel != null && Number.isFinite(options.consoleChannel)
      ? Math.max(1, Math.trunc(options.consoleChannel))
      : undefined;
  if (consoleChannel != null) {
    return spotChannel === consoleChannel;
  }

  const assignmentChannel = readFaderChannelForSpotlight(fader, spotlight.id);
  if (assignmentChannel == null) return false;
  return spotChannel === assignmentChannel;
}

/** Привязка софита к фейдеру (опционально с учётом активного K на пульте). */
export function spotlightAssignedToFader(
  spotlight: TheaterSpotlight,
  fader: PlaybookLightFaderV1,
  options?: FaderMatchOptions,
): boolean {
  return spotlightMatchesFader(spotlight, fader, options);
}

/** Уровень фейдера 0…1 (не яркость софита). Выключен или ≤0 → 0. */
export function readFaderLevel(
  fader: Pick<PlaybookLightFaderV1, "intensity" | "enabled"> | null | undefined,
): number {
  if (!fader || fader.enabled === false) return 0;
  const raw =
    typeof fader.intensity === "number" && Number.isFinite(fader.intensity)
      ? fader.intensity
      : 1;
  if (raw <= 0) return 0;
  return Math.min(1, raw);
}

export function resolveFaderForSpotlight(
  spotlight: TheaterSpotlight,
  lightFaders: PlaybookLightFadersDataV1 | null | undefined,
  options?: FaderMatchOptions,
): PlaybookLightFaderV1 | undefined {
  const faderId = readSpotlightFaderId(spotlight);
  if (faderId == null || !lightFaders || lightFaders.v !== 1) return undefined;
  const fader = lightFaders.faders.find((item) => item.id === faderId);
  if (!fader || !spotlightMatchesFader(spotlight, fader, options)) return undefined;
  return fader;
}

export function readSpotlightBaseUiIntensity(spotlight: TheaterSpotlight): number {
  return Number.isFinite(spotlight.intensity)
    ? Math.max(0, spotlight.intensity!)
    : THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY;
}

/** Итоговая яркость для отрисовки: свет софита × коэффициент фейдера. */
export function effectiveSpotlightUiIntensity(
  spotlight: TheaterSpotlight,
  fader?: Pick<PlaybookLightFaderV1, "intensity" | "enabled"> | null,
): number {
  const level = fader != null ? readFaderLevel(fader) : 1;
  if (level <= 0) return 0;
  const base = readSpotlightBaseUiIntensity(spotlight);
  return base * level;
}

/** Копия софита с учётом фейдера только для 3D/превью (не меняет сохранённые данные сцены). */
export function applyFaderToSpotlightForDisplay(
  spotlight: TheaterSpotlight,
  lightFaders: PlaybookLightFadersDataV1 | null | undefined,
  options?: FaderMatchOptions,
): TheaterSpotlight {
  const faderId = readSpotlightFaderId(spotlight);
  if (faderId == null || !lightFaders || lightFaders.v !== 1) return spotlight;
  const fader = lightFaders.faders.find((item) => item.id === faderId);
  if (!fader || !spotlightMatchesFader(spotlight, fader, options)) return spotlight;

  const level = readFaderLevel(fader);
  if (level <= 0) {
    return {
      ...spotlight,
      intensity: 0,
      enabled: false,
    };
  }

  const faderColor = String(fader.color ?? "").trim();
  return {
    ...spotlight,
    intensity: effectiveSpotlightUiIntensity(spotlight, fader),
    enabled: spotlight.enabled !== false,
    ...(/^#[0-9a-f]{6}$/i.test(faderColor) ? { color: faderColor } : {}),
  };
}

export function applyFadersToSpotlightsForDisplay(
  spotlights: TheaterSpotlight[],
  lightFaders: PlaybookLightFadersDataV1 | null | undefined,
  options?: FaderMatchOptions,
): TheaterSpotlight[] {
  if (!lightFaders || lightFaders.v !== 1) return spotlights;
  return spotlights.map((spotlight) =>
    applyFaderToSpotlightForDisplay(spotlight, lightFaders, options),
  );
}

/**
 * 3D/превью: у каждого софита уровни F своего K (снимок channels[K]).
 * Живая доска пульта — только для выбранного канала (liveConsoleChannel).
 */
export function applyFadersToSpotlightsPerChannelDisplay(
  spotlights: TheaterSpotlight[],
  lightFaders: PlaybookLightFadersDataV1 | null | undefined,
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined,
  liveConsoleChannel?: number,
): TheaterSpotlight[] {
  if (!lightFaders || lightFaders.v !== 1) return spotlights;
  const liveChannel =
    liveConsoleChannel != null && Number.isFinite(liveConsoleChannel) && liveConsoleChannel > 0
      ? Math.trunc(liveConsoleChannel)
      : undefined;
  const hasPrograms = lightPrograms?.v === 1 && Array.isArray(lightPrograms.programs);

  if (!hasPrograms) {
    return applyFadersToSpotlightsForDisplay(
      spotlights,
      lightFaders,
      liveChannel != null ? { consoleChannel: liveChannel } : undefined,
    );
  }

  const maxSpotChannel = spotlights.reduce(
    (max, spotlight) => Math.max(max, readSpotlightChannel(spotlight) ?? 0),
    liveChannel ?? 0,
  );
  const programs = resolveLightPrograms(lightPrograms, maxSpotChannel, maxSpotChannel);

  return spotlights.map((spotlight) => {
    const spotChannel = readSpotlightChannel(spotlight);
    if (spotChannel == null) return spotlight;

    const useLiveBoard = liveChannel != null && spotChannel === liveChannel;
    const faderBoard = buildFaderBoardForConsoleChannel(lightFaders, programs, spotChannel, {
      useLiveBoard,
    });

    return applyFaderToSpotlightForDisplay(spotlight, faderBoard);
  });
}

function readFaderIdFromApiValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

/** Софит с API/БД → формат редактора. */
export function mapTheaterSpotlightFromApi(sp: any): TheaterSpotlight {
  return {
    id: Number(sp?.sourceId ?? sp?.id ?? 0),
    label: String(sp?.label ?? ""),
    position: sp?.position,
    target: sp?.target,
    angleDeg: Number(sp?.angleDeg ?? 0),
    intensity: Number(sp?.intensity ?? 0),
    color: sp?.color ?? undefined,
    enabled: Boolean(sp?.enabled),
    channel: sp?.channel ?? undefined,
    faderId: readFaderIdFromApiValue(sp?.faderId),
    isRgb: sp?.isRgb ?? undefined,
    modelLowDetail: sp?.modelLowDetail === true ? true : undefined,
    mountModelId:
      typeof sp?.mountModelId === "number" && Number.isFinite(sp.mountModelId)
        ? sp.mountModelId
        : undefined,
    mountPointId:
      typeof sp?.mountPointId === "string" && sp.mountPointId.trim()
        ? sp.mountPointId.trim()
        : undefined,
    hidden: sp?.hidden === true ? true : undefined,
    gridCol:
      typeof sp?.gridCol === "number" && Number.isFinite(sp.gridCol)
        ? sp.gridCol
        : undefined,
    gridRow:
      typeof sp?.gridRow === "number" && Number.isFinite(sp.gridRow)
        ? sp.gridRow
        : undefined,
  };
}

/** Софит редактора → payload sync/БД. */
export function mapTheaterSpotlightToSync(spotlight: TheaterSpotlight) {
  const faderId = readSpotlightFaderId(spotlight);
  return {
    id: spotlight.id,
    label: spotlight.label,
    position: spotlight.position,
    target: spotlight.target,
    angleDeg: spotlight.angleDeg,
    intensity: spotlight.intensity,
    color: spotlight.color,
    enabled: spotlight.enabled,
    channel: spotlight.channel,
    isRgb: spotlight.isRgb,
    modelLowDetail: spotlight.modelLowDetail ?? false,
    mountModelId: spotlight.mountModelId ?? null,
    mountPointId: spotlight.mountPointId ?? null,
    hidden: spotlight.hidden,
    gridCol: spotlight.gridCol,
    gridRow: spotlight.gridRow,
    faderId: faderId ?? null,
  };
}

export function spotlightBelongsToFader(
  spotlight: TheaterSpotlight,
  fader: PlaybookLightFaderV1,
  options?: FaderMatchOptions,
): boolean {
  return spotlightMatchesFader(spotlight, fader, options);
}

export function getSpotlightsBoundToFader(
  fader: PlaybookLightFaderV1,
  spotlights: TheaterSpotlight[],
  options?: FaderMatchOptions,
): TheaterSpotlight[] {
  return spotlights.filter((spotlight) =>
    spotlightMatchesFader(spotlight, fader, options),
  );
}

/** Софит привязан к F на K: в софите выбран F, на доске есть link (как после bindSpotlightToFader). */
export function isSpotlightEquipmentBindingActive(
  spotlight: TheaterSpotlight,
  lightFaders?: PlaybookLightFadersDataV1 | null,
): boolean {
  if (spotlight.hidden) return false;
  const faderId = readSpotlightFaderId(spotlight);
  const channel = readSpotlightChannel(spotlight);
  if (faderId == null || channel == null) return false;
  if (!lightFaders || lightFaders.v !== 1) return false;

  const fader = lightFaders.faders.find((item) => item.id === faderId);
  if (!fader) return false;

  const ch = Math.trunc(channel);
  return (fader.links ?? []).some(
    (link) =>
      link.spotlightId === spotlight.id &&
      Number.isFinite(link.channel) &&
      Math.trunc(link.channel) === ch,
  );
}

export type ActiveEquipmentBinding = {
  channel: number;
  faderId: number;
  spotlightId: number;
};

/** Активные привязки K+F из 3D (как в списке софитов). */
export function collectActiveEquipmentBindings(
  spotlights: TheaterSpotlight[],
  options?: {
    channels?: number[];
    lightChannelsCount?: number;
    lightFaders?: PlaybookLightFadersDataV1 | null;
  },
): ActiveEquipmentBinding[] {
  const allow =
    options?.channels != null
      ? new Set(
          normalizeSelectedRecordChannels(
            options.channels,
            options.lightChannelsCount ?? 64,
          ),
        )
      : null;
  const byKey = new Map<string, ActiveEquipmentBinding>();

  for (const spotlight of spotlights) {
    if (!isSpotlightEquipmentBindingActive(spotlight, options?.lightFaders)) continue;
    const channel = readSpotlightChannel(spotlight)!;
    const faderId = readSpotlightFaderId(spotlight)!;
    if (allow && !allow.has(channel)) continue;
    byKey.set(`${channel}:${faderId}`, {
      channel,
      faderId,
      spotlightId: spotlight.id,
    });
  }

  return [...byKey.values()].sort(
    (a, b) => (a.channel ?? 0) - (b.channel ?? 0) || a.faderId - b.faderId,
  );
}

/** FaderId софитов/RGB на канале K (из 3D). */
export function equipmentFaderIdsOnChannel(
  channel: number,
  spotlights: TheaterSpotlight[],
  lightFaders?: PlaybookLightFadersDataV1 | null,
): number[] {
  const ch = Math.max(1, Math.trunc(channel) || 1);
  return collectActiveEquipmentBindings(spotlights, { lightFaders })
    .filter((item) => item.channel === ch)
    .map((item) => item.faderId);
}

/** На канале K к фейдеру F привязан софит/RGB в 3D (channel + faderId). */
export function isFaderEquipmentOnChannel(
  channel: number,
  faderId: number,
  spotlights: TheaterSpotlight[],
  lightFaders?: PlaybookLightFadersDataV1 | null,
): boolean {
  const ch = Math.max(1, Math.trunc(channel) || 1);
  const id = Math.max(1, Math.trunc(faderId) || 1);
  return collectActiveEquipmentBindings(spotlights, { lightFaders }).some(
    (item) => item.channel === ch && item.faderId === id,
  );
}

/** На канале K к фейдеру F привязан хотя бы один софит или RGB в 3D. */
export function faderHasEquipmentOnChannel(
  fader: PlaybookLightFaderV1,
  channel: number,
  spotlights: TheaterSpotlight[],
  lightFaders?: PlaybookLightFadersDataV1 | null,
): boolean {
  return isFaderEquipmentOnChannel(channel, fader.id, spotlights, lightFaders);
}

export function readFaderBoardChannel(fader: PlaybookLightFaderV1): number {
  return fader.channel ?? fader.links?.[0]?.channel ?? fader.id;
}

/** Фейдер относится к выбранному каналу K (привязка или софиты на этом K). */
export function faderBelongsToConsoleChannel(
  fader: PlaybookLightFaderV1,
  channel: number,
  spotlights: TheaterSpotlight[],
): boolean {
  const ch = Math.max(1, Math.trunc(channel));
  if (readFaderBoardChannel(fader) === ch) return true;
  if ((fader.links ?? []).some((link) => link.channel === ch)) return true;
  return getSpotlightsBoundToFader(fader, spotlights, { consoleChannel: ch }).length > 0;
}

export function resolveKadrFaderChannel(
  state: Pick<SceneLightKadrFaderStateV1, "faderId" | "channel">,
  fader?: PlaybookLightFaderV1 | null,
): number {
  const fromState = state.channel;
  if (fromState != null && Number.isFinite(fromState) && fromState > 0) {
    return Math.trunc(fromState);
  }
  if (fader) return readFaderBoardChannel(fader);
  return Math.max(1, Math.trunc(state.faderId));
}

/**
 * Снимок картины: только K из toggles и только F с оборудованием в 3D на этом K.
 * Для активного K — живая доска; для остальных — память программы K.
 */
export function buildKadrFaderSnapshotFromSofitChannels(args: {
  baseFaders: PlaybookLightFadersDataV1;
  programs: PlaybookLightProgramsDataV1;
  sofitChannels: number[];
  liveChannel: number;
  liveFaders: PlaybookLightFadersDataV1;
  lightChannelsCount?: number;
  spotlights?: TheaterSpotlight[];
}): SceneLightKadrFaderStateV1[] {
  const liveCh = Math.max(1, Math.trunc(args.liveChannel) || 1);
  const selected = normalizeSelectedRecordChannels(
    args.sofitChannels,
    args.lightChannelsCount ?? 64,
  );
  const byKey = new Map<string, SceneLightKadrFaderStateV1>();
  const spotlights = args.spotlights ?? [];

  for (const channel of selected) {
    const faderIds = equipmentFaderIdsOnChannel(channel, spotlights, args.baseFaders);
    if (faderIds.length === 0) continue;

    const programs = resolveLightPrograms(args.programs, channel);
    const board =
      channel === liveCh
        ? args.liveFaders
        : buildFaderBoardForConsoleChannel(args.baseFaders, programs, channel);

    for (const faderId of faderIds) {
      const fader = board.faders.find((item) => item.id === faderId);
      if (!fader) continue;
      const level = readFaderLevel(fader);
      const on = (fader.enabled ?? true) !== false && level > 0.02;
      byKey.set(`${channel}:${faderId}`, {
        faderId,
        channel,
        intensity: level,
        enabled: on,
      });
    }
  }

  return [...byKey.values()].sort(
    (a, b) => (a.channel ?? 0) - (b.channel ?? 0) || a.faderId - b.faderId,
  );
}

export function buildKadrFaderSnapshotForScene(
  faders: PlaybookLightFadersDataV1,
  spotlights: TheaterSpotlight[] = [],
  liveChannel?: number,
): SceneLightKadrFaderStateV1[] {
  const ch =
    liveChannel != null && Number.isFinite(liveChannel) && liveChannel > 0
      ? Math.trunc(liveChannel)
      : undefined;
  const channelsWithSpotlights = new Set(
    spotlights
      .map((s) => readSpotlightChannel(s))
      .filter((c): c is number => c != null && c > 0),
  );

  return faders.faders
    .filter((fader) => {
      const level = readFaderLevel(fader);
      if (level <= 0.02) return false;
      if (spotlights.length === 0) return true;
      if (
        ch != null &&
        getSpotlightsBoundToFader(fader, spotlights, { consoleChannel: ch }).length > 0
      ) {
        return true;
      }
      if (getSpotlightsBoundToFader(fader, spotlights).length > 0) return true;
      return channelsWithSpotlights.has(readFaderBoardChannel(fader));
    })
    .map((fader) => ({
      faderId: fader.id,
      channel: ch ?? readFaderBoardChannel(fader),
      intensity: readFaderLevel(fader),
      enabled: (fader.enabled ?? true) && readFaderLevel(fader) > 0.02,
    }));
}

export function mergeFaderSpotlightLink(
  fader: PlaybookLightFaderV1,
  spotlightId: number,
  channel: number,
): PlaybookLightFaderV1 {
  const prevLinks = Array.isArray(fader.links) ? fader.links : [];
  const withoutSpotlight = prevLinks.filter((link) => link.spotlightId !== spotlightId);
  const { channel: _channel, spotlightId: _spotlightId, ...rest } = fader;
  return {
    ...rest,
    links: [...withoutSpotlight, { channel, spotlightId }],
  };
}

export function detachSpotlightFromOtherFaders(
  faders: PlaybookLightFaderV1[],
  targetFaderId: number,
  spotlightId: number,
): PlaybookLightFaderV1[] {
  return faders.map((fader) => {
    if (fader.id === targetFaderId) return fader;
    const links = (fader.links ?? []).filter((link) => link.spotlightId !== spotlightId);
    const spotlightIdField =
      fader.spotlightId === spotlightId
        ? links.find((link) => link.spotlightId != null)?.spotlightId
        : fader.spotlightId;
    if (links.length === (fader.links ?? []).length && spotlightIdField === fader.spotlightId) {
      return fader;
    }
    return { ...fader, links, spotlightId: spotlightIdField };
  });
}

/** Снять софит со всех фейдеров (когда в UI выбран «—» у F). */
export function detachSpotlightFromFaderBoard(
  faders: PlaybookLightFaderV1[],
  spotlightId: number,
): PlaybookLightFaderV1[] {
  return faders.map((fader) => {
    const links = (fader.links ?? []).filter((link) => link.spotlightId !== spotlightId);
    const spotlightIdField =
      fader.spotlightId === spotlightId
        ? links.find((link) => link.spotlightId != null)?.spotlightId
        : fader.spotlightId;
    if (links.length === (fader.links ?? []).length && spotlightIdField === fader.spotlightId) {
      return fader;
    }
    return { ...fader, links, spotlightId: spotlightIdField };
  });
}

/** Синхронизирует links на доске пульта с spotlight.faderId (источник истины — сцена). */
export function repairLightFaderLinksFromSpotlights(
  scenes: ScriptScene[],
  lightFaders: PlaybookLightFadersDataV1 | null | undefined,
): PlaybookLightFadersDataV1 | null | undefined {
  if (!lightFaders || lightFaders.v !== 1 || !Array.isArray(lightFaders.faders)) {
    return lightFaders;
  }

  let faderRows = lightFaders.faders;
  let changed = false;

  for (const scene of scenes) {
    if (!Array.isArray(scene.theaterSpotlights)) continue;
    for (const spotlight of scene.theaterSpotlights) {
      const faderId = readSpotlightFaderId(spotlight);
      const channel = readSpotlightChannel(spotlight);
      if (faderId == null || channel == null) continue;

      const bound = faderRows.find((item) => item.id === faderId);
      if (bound && spotlightMatchesFader(spotlight, bound)) continue;

      faderRows = bindSpotlightOnFaderBoard(faderRows, faderId, spotlight.id, channel);
      changed = true;
    }
  }

  if (!changed) return lightFaders;

  return buildCompleteLightFaders({
    v: 1,
    count: Math.max(lightFaders.count ?? faderRows.length, faderRows.length),
    faders: faderRows,
  });
}

/** Восстанавливает spotlight.faderId из scene.lightFaders после pull/локальной загрузки. */
export function applySceneFaderBindingsToSpotlights(
  scenes: ScriptScene[],
  lightFaders: PlaybookLightFadersDataV1 | null | undefined,
): ScriptScene[] {
  if (!lightFaders || lightFaders.v !== 1 || !Array.isArray(lightFaders.faders)) {
    return scenes;
  }

  const bindingBySpotlightId = new Map<number, { faderId: number; channel: number }>();
  for (const fader of lightFaders.faders) {
    const assign = (spotlightId: number) => {
      if (!Number.isFinite(spotlightId)) return;
      const channel = readFaderChannelForSpotlight(fader, spotlightId);
      if (channel == null) return;
      bindingBySpotlightId.set(Math.trunc(spotlightId), {
        faderId: fader.id,
        channel: Math.trunc(channel),
      });
    };
    if (typeof fader.spotlightId === "number" && Number.isFinite(fader.spotlightId)) {
      assign(fader.spotlightId);
    }
    for (const link of fader.links ?? []) {
      if (typeof link.spotlightId === "number" && Number.isFinite(link.spotlightId)) {
        assign(link.spotlightId);
      }
    }
  }
  if (bindingBySpotlightId.size === 0) return scenes;

  let changed = false;
  const nextScenes = scenes.map((scene) => {
    if (!Array.isArray(scene.theaterSpotlights) || scene.theaterSpotlights.length === 0) {
      return scene;
    }
    let sceneChanged = false;
    const nextSpotlights = scene.theaterSpotlights.map((spotlight) => {
      const spotChannel = readSpotlightChannel(spotlight);
      if (hasSpotlightFaderId(spotlight)) {
        return spotlight;
      }
      const spotlightId = spotlight.id;
      if (!Number.isFinite(spotlightId)) return spotlight;
      const binding = bindingBySpotlightId.get(Math.trunc(spotlightId));
      if (
        binding == null ||
        spotChannel == null ||
        spotChannel !== binding.channel
      ) {
        return spotlight;
      }
      sceneChanged = true;
      return { ...spotlight, faderId: binding.faderId };
    });
    if (!sceneChanged) return scene;
    changed = true;
    return { ...scene, theaterSpotlights: nextSpotlights };
  });

  return changed ? nextScenes : scenes;
}

/** Согласует сцены и lightFaders после load/save. */
export function prepareSceneLightBindings(
  scenes: ScriptScene[],
  lightFaders: PlaybookLightFadersDataV1 | null | undefined,
): { scenes: ScriptScene[]; lightFaders: PlaybookLightFadersDataV1 | null | undefined } {
  const repairedFaders = repairLightFaderLinksFromSpotlights(scenes, lightFaders);
  const nextScenes = applySceneFaderBindingsToSpotlights(scenes, repairedFaders);
  const syncedFaders = repairLightFaderLinksFromSpotlights(nextScenes, repairedFaders);
  return { scenes: nextScenes, lightFaders: syncedFaders };
}

export function bindSpotlightOnFaderBoard(
  faders: PlaybookLightFaderV1[],
  faderId: number,
  spotlightId: number,
  channel: number,
): PlaybookLightFaderV1[] {
  const exists = faders.some((item) => item.id === faderId);
  const detached = detachSpotlightFromOtherFaders(faders, faderId, spotlightId);
  const base = exists
    ? detached.find((item) => item.id === faderId)!
    : {
        id: faderId,
        label: formatCompactFaderLabel(faderId),
        channel,
        intensity: 1,
        enabled: true,
        links: [] as { channel: number; spotlightId?: number }[],
      };
  const nextFader = mergeFaderSpotlightLink(base, spotlightId, channel);
  return exists
    ? detached.map((item) => (item.id === faderId ? nextFader : item))
    : [...detached, nextFader];
}
