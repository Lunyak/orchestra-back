import type { SceneLightFadersDataV1, SceneLightProgramsDataV1 } from "../../../features/scene/model/scene-slice";
import { LIGHT_CHANNEL_SLOT_COUNT } from "../../../features/theater/model/theater-light-channel-link";
import type { TheaterSpotlight } from "../../types/script";

/** Минимум кнопок П… на пульте (как K1–K8). */
export const DEFAULT_LIGHT_PROGRAM_COUNT = LIGHT_CHANNEL_SLOT_COUNT;

/** ID программы из сцены/JSON (иногда приходит строкой). */
export function coerceProgramId(value: unknown): number | null {
  const id = Math.trunc(Number(value));
  if (!Number.isFinite(id) || id < 1) return null;
  return id;
}

export function createDefaultLightFaders(): SceneLightFadersDataV1 {
  return {
    v: 1,
    count: 8,
    faders: Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      label: `Фейдер ${index + 1}`,
      channel: index + 1,
      intensity: 1,
      enabled: true,
      links: [{ channel: index + 1 }],
    })),
  };
}

export function createDefaultLightPrograms(
  count = DEFAULT_LIGHT_PROGRAM_COUNT,
): SceneLightProgramsDataV1 {
  const n = Math.max(1, Math.trunc(count) || DEFAULT_LIGHT_PROGRAM_COUNT);
  return {
    v: 1,
    activeProgramId: 1,
    programs: Array.from({ length: n }, (_, index) => {
      const id = index + 1;
      return { id, label: `Программа ${id}`, faders: [] };
    }),
  };
}

export function buildCompleteLightFaders(
  persisted: SceneLightFadersDataV1 | undefined,
): SceneLightFadersDataV1 {
  const maxFaderId = Math.max(1, Math.trunc(Number(persisted?.count) || 8));
  const byId = new Map<number, SceneLightFadersDataV1["faders"][number]>();
  for (let id = 1; id <= maxFaderId; id += 1) {
    byId.set(id, {
      id,
      label: `Фейдер ${id}`,
      channel: id,
      intensity: 1,
      enabled: true,
      links: [{ channel: id }],
    });
  }
  for (const fader of persisted?.faders ?? []) {
    byId.set(fader.id, {
      ...byId.get(fader.id),
      ...fader,
      label: fader.label || `Фейдер ${fader.id}`,
      channel: fader.channel ?? fader.links?.[0]?.channel ?? fader.id,
      links: fader.links?.length
        ? fader.links
        : [{ channel: fader.channel ?? fader.id, spotlightId: fader.spotlightId }],
    });
  }
  return {
    v: 1,
    count: maxFaderId,
    faders: Array.from(byId.values()).sort((a, b) => a.id - b.id),
  };
}

export function resolveLightPrograms(
  raw: SceneLightProgramsDataV1 | null | undefined,
  minCount = DEFAULT_LIGHT_PROGRAM_COUNT,
): SceneLightProgramsDataV1 {
  if (!raw || raw.v !== 1 || !Array.isArray(raw.programs) || raw.programs.length === 0) {
    return createDefaultLightPrograms(minCount);
  }

  const byId = new Map<number, SceneLightProgramsDataV1["programs"][number]>();
  for (const program of raw.programs) {
    const id = coerceProgramId(program.id);
    if (id == null) continue;
    byId.set(id, {
      ...program,
      id,
      label: program.label?.trim() || `Программа ${id}`,
      faders: Array.isArray(program.faders) ? program.faders : [],
    });
  }
  const maxId = Math.max(
    minCount,
    ...Array.from(byId.keys()),
    ...raw.programs.map((program) => coerceProgramId(program.id) ?? 0),
  );

  const programs = Array.from({ length: maxId }, (_, index) => {
    const id = index + 1;
    return byId.get(id) ?? { id, label: `Программа ${id}`, faders: [] };
  });

  const activeId = coerceProgramId(raw.activeProgramId);
  const activeProgramId =
    activeId != null && programs.some((program) => program.id === activeId)
      ? activeId
      : (programs[0]?.id ?? 1);

  return { v: 1, activeProgramId, programs };
}

export function lightProgramsNeedNormalization(
  raw: SceneLightProgramsDataV1 | null | undefined,
  minCount = DEFAULT_LIGHT_PROGRAM_COUNT,
): boolean {
  if (!raw || raw.v !== 1 || !Array.isArray(raw.programs)) return true;
  if (raw.programs.length < minCount) return true;
  for (let id = 1; id <= minCount; id += 1) {
    if (!raw.programs.some((program) => coerceProgramId(program.id) === id)) return true;
  }
  return false;
}

export function resolveLightFaders(
  raw: SceneLightFadersDataV1 | null | undefined,
): SceneLightFadersDataV1 {
  if (raw && raw.v === 1) return buildCompleteLightFaders(raw);
  return createDefaultLightFaders();
}

export type LightConsoleMode = "live" | "kadr" | "compact";

export type LightConsoleViewProps = {
  mode?: LightConsoleMode;
  readOnly?: boolean;
  lightChannels: string[];
  selectedLightSlot: number;
  faders: SceneLightFadersDataV1;
  programs: SceneLightProgramsDataV1;
  spotlights?: TheaterSpotlight[];
  consoleChannel?: number;
  onSelectChannel?: (slot: number) => void;
  onSelectProgram?: (programId: number) => void;
  onFaderCountChange?: (count: number) => void;
  onPatchFader?: (
    faderId: number,
    patch: Partial<SceneLightFadersDataV1["faders"][number]>,
  ) => void;
  onSaveActiveProgram?: () => void;
  className?: string;
};
