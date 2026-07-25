import type { PlaybookLightFadersDataV1 } from "../../../features/playbook/model/playbook-slice";
import type { TheaterSpotlight } from "../../types/script";
import { LightConsoleSettingsModal } from "./LightConsoleSettingsModal";
import { LightConsoleView } from "./LightConsoleView";
import { useLightConsoleLayoutSettings } from "./useLightConsoleLayoutSettings";
import { useLightConsoleState } from "./useLightConsoleState";

export type LightConsolePanelProps = {
  projectName: string;
  spotlights?: TheaterSpotlight[];
  mode?: "live" | "kadr" | "compact";
  readOnly?: boolean;
  fadersOverride?: PlaybookLightFadersDataV1 | null;
  activeProgramIdOverride?: number | null;
  className?: string;
  onFadersChange?: (next: PlaybookLightFadersDataV1) => void;
  onPatchFader?: (
    faderId: number,
    patch: Partial<PlaybookLightFadersDataV1["faders"][number]>,
    selectedLightSlot: number,
  ) => void;
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
  onPatchFader,
}: LightConsolePanelProps) {
  const vm = useLightConsoleState({
    projectName,
    spotlights,
    fadersOverride,
    activeProgramIdOverride,
    readOnly,
    onFadersChange,
  });
  const layoutSettings = useLightConsoleLayoutSettings(projectName);
  const canEditLayout = mode === "live" && !readOnly;

  return (
    <>
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
        channelColumns={layoutSettings.layout.channelColumns}
        onSelectChannel={vm.selectChannel}
        onSelectProgram={vm.selectProgram}
        onOpenSettings={canEditLayout ? layoutSettings.openSettings : undefined}
        onSaveActiveProgram={
          canEditLayout
            ? () => {
                vm.saveProgramSnapshot();
              }
            : undefined
        }
        onPatchFader={
          readOnly
            ? undefined
            : (faderId, patch) => {
                vm.patchFader(faderId, patch);
                onPatchFader?.(faderId, patch, vm.selectedLightSlot);
              }
        }
      />
      {canEditLayout ? (
        <LightConsoleSettingsModal
          isOpen={layoutSettings.settingsOpen}
          layout={layoutSettings.layout}
          onClose={layoutSettings.closeSettings}
          onApply={layoutSettings.applyLayout}
        />
      ) : null}
    </>
  );
}
