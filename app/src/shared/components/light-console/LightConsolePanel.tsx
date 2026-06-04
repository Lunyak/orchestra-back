import type { SceneLightFadersDataV1 } from "../../../features/scene/model/scene-slice";
import type { TheaterSpotlight } from "../../types/script";
import { LightConsoleView } from "./LightConsoleView";
import { useLightConsoleState } from "./useLightConsoleState";

export type LightConsolePanelProps = {
  projectName: string;
  spotlights?: TheaterSpotlight[];
  mode?: "live" | "kadr" | "compact";
  readOnly?: boolean;
  fadersOverride?: SceneLightFadersDataV1 | null;
  activeProgramIdOverride?: number | null;
  className?: string;
  onFadersChange?: (next: SceneLightFadersDataV1) => void;
};

export function LightConsolePanel({
  projectName,
  spotlights = [],
  mode = "live",
  readOnly = false,
  fadersOverride,
  activeProgramIdOverride,
  className,
  onFadersChange,
}: LightConsolePanelProps) {
  const vm = useLightConsoleState({
    projectName,
    spotlights,
    fadersOverride,
    activeProgramIdOverride,
    readOnly,
    onFadersChange,
  });

  return (
    <LightConsoleView
      mode={mode}
      readOnly={readOnly}
      className={className}
      lightChannels={vm.lightChannels}
      selectedLightSlot={vm.selectedLightSlot}
      faders={vm.faders}
      programs={vm.programs}
      spotlights={spotlights}
      consoleChannel={vm.selectedLightSlot > 0 ? vm.selectedLightSlot : undefined}
      onSelectChannel={vm.selectChannel}
      onSelectProgram={vm.selectProgram}
      onFaderCountChange={mode === "live" && !readOnly ? vm.setFaderCount : undefined}
      onPatchFader={readOnly ? undefined : vm.patchFader}
    />
  );
}
