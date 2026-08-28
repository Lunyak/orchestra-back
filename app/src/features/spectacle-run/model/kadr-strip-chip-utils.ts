import type {
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../playbook/model/playbook-slice";
import {
  fadersForKadrDisplay,
  findKadrById,
  readSceneLightKadrs,
} from "../../theater/model/light-kadrs";
import { buildLightConsoleSplitModel } from "../../../shared/components/light-console/light-console-split";
import {
  resolveLightFaders,
  resolveLightPrograms,
} from "../../../shared/components/light-console/light-console-data";
import { resolveLightColor } from "../../../shared/components/show-script/utils/lightTokens";
import type { ScriptScene, SceneLightKadrV1 } from "../../../shared/types/script";
import type { SpectacleTapeItem } from "./spectacle-kadr-tape";
import type { KadrStripTechRow } from "./kadr-strip-tech-summary";
import type { ProgRunChipLiveConsoleProps } from "./spectacle-run-kadr-strip-types";

export const PRIMARY_PROG_RUN_ROW_LABELS = new Set([
  "Свет",
  "Трек",
  "Видео",
  "Переход",
  "Комментарий",
]);

export const LIVE_PROG_RUN_ROW_LABELS = ["Свет", "Трек", "Видео"] as const;

export const COVER_OVERLAY_LIVE_ROW_LABELS = ["Свет", "Трек"] as const;

export const NOTES_PROG_RUN_ROW_LABELS = ["Комментарий", "Переход"] as const;

export const LIVE_PROG_RUN_ROW_LABEL_SET = new Set<string>(LIVE_PROG_RUN_ROW_LABELS);

export const NOTES_PROG_RUN_ROW_LABEL_SET = new Set<string>(NOTES_PROG_RUN_ROW_LABELS);

const PROG_RUN_CAROUSEL_STACK_RADIUS = 2;
const PROG_RUN_FLOW_STACK_RADIUS = 3;
const PROG_RUN_TRIO_STACK_RADIUS = 1;

export function isCarouselStackedOffset(
  offset: number,
  mode: "carousel" | "flow" | "trio" = "carousel",
): boolean {
  const radius =
    mode === "flow"
      ? PROG_RUN_FLOW_STACK_RADIUS
      : mode === "trio"
        ? PROG_RUN_TRIO_STACK_RADIUS
        : PROG_RUN_CAROUSEL_STACK_RADIUS;
  return Math.abs(offset) <= radius;
}

export function isFilledTechRow(row: KadrStripTechRow): boolean {
  return row.value.trim().length > 0;
}

export function orderTechRowsByLabels(
  rows: KadrStripTechRow[],
  labels: readonly string[],
): KadrStripTechRow[] {
  const byLabel = new Map(rows.map((row) => [row.label, row]));
  return labels.flatMap((label) => {
    const row = byLabel.get(label);
    return row ? [row] : [];
  });
}

export function kadrProgramColor(
  item: SpectacleTapeItem,
  scene: ScriptScene | undefined,
  lightChannels: string[],
  baseFaders: ReturnType<typeof resolveLightFaders>,
): string | null {
  if (item.isPlaceholder || !scene) return null;

  const kadrs = readSceneLightKadrs(scene);
  const kadr =
    (item.kadrId ? findKadrById(kadrs, item.kadrId) : undefined) ??
    kadrs.kadrs.find((entry) => entry.kadrNo === item.kadrNo);

  if (!kadr || kadr.blackout || kadr.programId <= 0) return null;

  const display = fadersForKadrDisplay(kadr, baseFaders);
  const split = buildLightConsoleSplitModel({
    programId: kadr.programId,
    lightChannels,
    faders: display,
    kadrFaderStates: kadr.faders,
    sofitChannels: [],
  });

  return split.programColor ? resolveLightColor("", split.programColor) : null;
}

export function resolveTapeItemKadr(
  item: SpectacleTapeItem,
  scene: ScriptScene | undefined,
): SceneLightKadrV1 | undefined {
  if (!scene || item.isPlaceholder) return undefined;
  const kadrs = readSceneLightKadrs(scene);
  return (
    (item.kadrId ? findKadrById(kadrs, item.kadrId) : undefined) ??
    kadrs.kadrs.find((entry) => entry.kadrNo === item.kadrNo)
  );
}

export function buildProgRunChipLightConsole(
  kadr: SceneLightKadrV1 | undefined,
  lightChannels: string[],
  baseFaders: PlaybookLightFadersDataV1,
  lightPrograms: PlaybookLightProgramsDataV1 | null,
): ProgRunChipLiveConsoleProps | null {
  if (!kadr || kadr.blackout || kadr.programId <= 0) return null;

  const channelCount = Math.max(1, lightChannels.length);
  const selectedLightSlot = Math.max(
    1,
    Math.min(channelCount, kadr.recordChannels?.[0] ?? 1),
  );
  const programId = Math.max(1, Math.trunc(kadr.programId) || 1);
  const programs = resolveLightPrograms(
    lightPrograms ?? undefined,
    undefined,
    channelCount,
  );

  return {
    lightChannels,
    selectedLightSlot,
    faders: fadersForKadrDisplay(kadr, baseFaders),
    programs: { ...programs, activeProgramId: programId },
  };
}
