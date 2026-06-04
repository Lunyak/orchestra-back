import type { SceneLightFadersDataV1 } from "../../scene/model/scene-slice";
import { buildCompleteLightFaders } from "../../../shared/components/light-console/light-console-data";
import type { TheaterSpotlight } from "../../../shared/types/script";
import {
  readSpotlightFaderId,
  sceneFaderLevelFromSpotlightUiIntensity,
} from "./theater-light-fader-bindings";

export function patchSceneFaderLevel(
  lightFaders: SceneLightFadersDataV1 | null | undefined,
  faderId: number,
  level: number,
): SceneLightFadersDataV1 {
  const base = buildCompleteLightFaders(lightFaders ?? undefined);
  const clamped = Math.min(1, Math.max(0, level));
  return {
    ...base,
    faders: base.faders.map((item) =>
      item.id === faderId
        ? { ...item, intensity: clamped, enabled: clamped > 0 }
        : item,
    ),
  };
}

/** Яркость софита в 3D → уровень привязанного F на общей доске пульта. */
export function patchSceneFaderFromSpotlightIntensity(
  lightFaders: SceneLightFadersDataV1 | null | undefined,
  spotlight: TheaterSpotlight,
  uiIntensity: number,
): SceneLightFadersDataV1 | null {
  const faderId = readSpotlightFaderId(spotlight);
  if (faderId == null) return null;
  const level = sceneFaderLevelFromSpotlightUiIntensity(uiIntensity);
  return patchSceneFaderLevel(lightFaders, faderId, level);
}
