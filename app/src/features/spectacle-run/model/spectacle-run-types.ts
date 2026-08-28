import type { ScriptScene } from "../../../shared/types/script";

export type UseSpectacleRunArgs = {
  projectName: string;
  scenes: ScriptScene[];
  lightChannels: string[];
};
