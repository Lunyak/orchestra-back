import type { TheaterSpotlight } from "../../../shared/types/script";
import {
  formatChannelShort,
  formatFaderShort,
} from "../../../shared/components/light-console/light-console-labels";
import { readSpotlightFaderId } from "./theater-light-fader-bindings";

const DEFAULT_REGULAR_LABEL_RE = /^софит\s*\d+(\s*\(копия\))?$/iu;
const DEFAULT_RGB_LABEL_RE = /^rgb\s*\d+(\s*\(копия\))?$/iu;

export function isDefaultSpotlightLabel(
  label: string | null | undefined,
  spotlight: Pick<TheaterSpotlight, "id" | "isRgb">,
): boolean {
  const trimmed = String(label ?? "").trim();
  if (!trimmed) return true;
  if (spotlight.isRgb) return DEFAULT_RGB_LABEL_RE.test(trimmed);
  return DEFAULT_REGULAR_LABEL_RE.test(trimmed);
}

export function resolveSpotlightDisplayName(
  spotlight: Pick<TheaterSpotlight, "id" | "label" | "isRgb">,
): string {
  const trimmed = spotlight.label?.trim();
  if (trimmed && !isDefaultSpotlightLabel(trimmed, spotlight)) {
    return trimmed;
  }
  return spotlight.isRgb ? `RGB ${spotlight.id}` : `Софит ${spotlight.id}`;
}

export function formatSpotlightChannelFaderShort(spotlight: TheaterSpotlight): string {
  const channel = spotlight.channel ?? spotlight.id;
  if (spotlight.isRgb) {
    return formatChannelShort(channel);
  }
  const faderId = readSpotlightFaderId(spotlight);
  if (faderId != null) {
    return `${formatChannelShort(channel)} ${formatFaderShort(faderId)}`;
  }
  return formatChannelShort(channel);
}

/** Строка в техкарте: K F · имя софита. */
export function formatSpotlightChannelFaderWithName(
  channel: number,
  faderId: number,
  spotlight?: TheaterSpotlight | null,
): string {
  const base = `${formatChannelShort(channel)} ${formatFaderShort(faderId)}`;
  if (!spotlight) return base;
  const customName = spotlight.label?.trim();
  if (customName && !isDefaultSpotlightLabel(customName, spotlight)) {
    return `${base} · ${customName}`;
  }
  return base;
}
