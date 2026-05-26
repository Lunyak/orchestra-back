import type { SceneLightFaderV1, SceneLightFadersDataV1 } from "../../scene/model/scene-slice";
import type { ScriptStep, TheaterSpotlight } from "../../../shared/types/script";
import { THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY } from "./theater-scene-lighting";

export function formatCompactChannelSlot(slot: number): string {
  return `к ${Math.max(1, Math.trunc(slot))}`;
}

export function formatCompactFaderLabel(faderId: number): string {
  return `ф ${Math.max(1, Math.trunc(faderId))}`;
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
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

/** Канал фейдера для конкретного софита (из link или поля channel). */
export function readFaderChannelForSpotlight(
  fader: SceneLightFaderV1,
  spotlightId?: number,
): number | undefined {
  if (spotlightId != null) {
    const link = (fader.links ?? []).find(
      (item) =>
        item.spotlightId === spotlightId && Number.isFinite(item.channel),
    );
    if (link) return Math.max(1, Math.trunc(link.channel));
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
  fader: SceneLightFaderV1,
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

/** Привязка софита к фейдеру (без учёта выбранного канала на пульте). */
export function spotlightAssignedToFader(
  spotlight: TheaterSpotlight,
  fader: SceneLightFaderV1,
): boolean {
  return spotlightMatchesFader(spotlight, fader);
}

/** Уровень фейдера 0…1 (не яркость софита). Выключен или ≤0 → 0. */
export function readFaderLevel(
  fader: Pick<SceneLightFaderV1, "intensity" | "enabled"> | null | undefined,
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
  lightFaders: SceneLightFadersDataV1 | null | undefined,
  options?: FaderMatchOptions,
): SceneLightFaderV1 | undefined {
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
  fader?: Pick<SceneLightFaderV1, "intensity" | "enabled"> | null,
): number {
  const level = fader != null ? readFaderLevel(fader) : 1;
  if (level <= 0) return 0;
  const base = readSpotlightBaseUiIntensity(spotlight);
  return base * level;
}

/** Копия софита с учётом фейдера только для 3D/превью (не меняет сохранённые данные шага). */
export function applyFaderToSpotlightForDisplay(
  spotlight: TheaterSpotlight,
  lightFaders: SceneLightFadersDataV1 | null | undefined,
  options?: FaderMatchOptions,
): TheaterSpotlight {
  const faderId = readSpotlightFaderId(spotlight);
  if (faderId == null || !lightFaders || lightFaders.v !== 1) return spotlight;
  const fader = lightFaders.faders.find((item) => item.id === faderId);
  if (!fader || !spotlightAssignedToFader(spotlight, fader)) return spotlight;

  const level = readFaderLevel(fader);
  if (level <= 0) {
    return {
      ...spotlight,
      intensity: 0,
      enabled: false,
    };
  }

  if (!spotlightMatchesFader(spotlight, fader, options)) return spotlight;

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
  lightFaders: SceneLightFadersDataV1 | null | undefined,
  options?: FaderMatchOptions,
): TheaterSpotlight[] {
  if (!lightFaders || lightFaders.v !== 1) return spotlights;
  return spotlights.map((spotlight) =>
    applyFaderToSpotlightForDisplay(spotlight, lightFaders, options),
  );
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
    hidden: spotlight.hidden,
    gridCol: spotlight.gridCol,
    gridRow: spotlight.gridRow,
    faderId: faderId ?? null,
  };
}

export function spotlightBelongsToFader(
  spotlight: TheaterSpotlight,
  fader: SceneLightFaderV1,
  options?: FaderMatchOptions,
): boolean {
  return spotlightMatchesFader(spotlight, fader, options);
}

export function getSpotlightsBoundToFader(
  fader: SceneLightFaderV1,
  spotlights: TheaterSpotlight[],
  options?: FaderMatchOptions,
): TheaterSpotlight[] {
  return spotlights.filter((spotlight) =>
    spotlightMatchesFader(spotlight, fader, options),
  );
}

export function mergeFaderSpotlightLink(
  fader: SceneLightFaderV1,
  spotlightId: number,
  channel: number,
): SceneLightFaderV1 {
  const prevLinks = Array.isArray(fader.links) ? fader.links : [];
  const withoutSpotlight = prevLinks.filter((link) => link.spotlightId !== spotlightId);
  return {
    ...fader,
    channel,
    spotlightId,
    links: [...withoutSpotlight, { channel, spotlightId }],
  };
}

export function detachSpotlightFromOtherFaders(
  faders: SceneLightFaderV1[],
  targetFaderId: number,
  spotlightId: number,
): SceneLightFaderV1[] {
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

/** Восстанавливает spotlight.faderId из scene.lightFaders после pull/локальной загрузки. */
export function applySceneFaderBindingsToSpotlights(
  steps: ScriptStep[],
  lightFaders: SceneLightFadersDataV1 | null | undefined,
): ScriptStep[] {
  if (!lightFaders || lightFaders.v !== 1 || !Array.isArray(lightFaders.faders)) {
    return steps;
  }

  const bindingBySpotlightId = new Map<number, { faderId: number; channel: number }>();
  for (const fader of lightFaders.faders) {
    const assign = (spotlightId: number) => {
      const channel = readFaderChannelForSpotlight(fader, spotlightId);
      if (channel == null) return;
      bindingBySpotlightId.set(Math.trunc(spotlightId), { faderId: fader.id, channel });
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
  if (bindingBySpotlightId.size === 0) return steps;

  let changed = false;
  const nextSteps = steps.map((step) => {
    if (!Array.isArray(step.theaterSpotlights) || step.theaterSpotlights.length === 0) {
      return step;
    }
    let stepChanged = false;
    const nextSpotlights = step.theaterSpotlights.map((spotlight) => {
      const spotChannel = readSpotlightChannel(spotlight);
      if (hasSpotlightFaderId(spotlight) && lightFaders.faders.length > 0) {
        const faderId = readSpotlightFaderId(spotlight)!;
        const fader = lightFaders.faders.find((item) => item.id === faderId);
        if (fader && !spotlightMatchesFader(spotlight, fader)) {
          stepChanged = true;
          const next = { ...spotlight };
          delete next.faderId;
          return next;
        }
        return spotlight;
      }
      const binding = bindingBySpotlightId.get(spotlight.id);
      if (
        binding == null ||
        spotChannel == null ||
        spotChannel !== binding.channel
      ) {
        return spotlight;
      }
      stepChanged = true;
      return { ...spotlight, faderId: binding.faderId };
    });
    if (!stepChanged) return step;
    changed = true;
    return { ...step, theaterSpotlights: nextSpotlights };
  });

  return changed ? nextSteps : steps;
}

export function bindSpotlightOnFaderBoard(
  faders: SceneLightFaderV1[],
  faderId: number,
  spotlightId: number,
  channel: number,
): SceneLightFaderV1[] {
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
