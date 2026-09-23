import type { ScriptScene } from "../../../shared/types/script";

export type UseSpectacleRunArgs = {
  projectName: string;
  scenes: ScriptScene[];
  lightChannels: string[];
  /** Прогон включает звук и проектор картины. В 3D-редакторе это не нужно. */
  kadrPlayback?: boolean;
};
