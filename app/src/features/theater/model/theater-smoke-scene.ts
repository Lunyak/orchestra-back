import type { ScriptScene } from "../../../shared/types/script";
import {
  normalizeLightKadrs,
  readSceneLightKadrs,
} from "./light-kadrs";

/** Вкл/выкл дым-машины на сцене + флаги на картинах (JSON). */
export function applyTheaterSmokeMachineToScene(
  scene: ScriptScene,
  enabled: boolean,
): Pick<ScriptScene, "theaterSmokeMachine" | "lightKadrs"> {
  const kadrsData = readSceneLightKadrs(scene);
  const nextKadrs = {
    v: 1 as const,
    kadrs: kadrsData.kadrs.map((kadr) => {
      if (enabled) return { ...kadr, smokeMachine: true };
      const { smokeMachine: _removed, ...rest } = kadr;
      return rest;
    }),
  };

  return {
    theaterSmokeMachine: enabled ? true : undefined,
    lightKadrs: normalizeLightKadrs(nextKadrs),
  };
}

export function readSceneSmokeMachineEnabled(
  scene: ScriptScene | undefined | null,
): boolean {
  return scene?.theaterSmokeMachine === true;
}
