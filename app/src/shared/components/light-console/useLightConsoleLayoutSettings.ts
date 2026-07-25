import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlaybook } from "../../../features/playbook";
import {
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
} from "../../../features/show-script-markdown/model/show-script-markdown-slice";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  applyLightConsoleLayoutToPlaybookData,
  buildLightConsoleLayoutCounts,
  type LightConsoleLayoutCounts,
} from "./light-channels-mutate";

export function useLightConsoleLayoutSettings(projectName: string) {
  const dispatch = useAppDispatch();
  const { playbookData, setPlaybookData, saveScenesForLightPlot } = usePlaybook();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { lightChannels, selectedLightSlot } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName || "fools", "script"),
  );

  const layout = useMemo(
    () =>
      buildLightConsoleLayoutCounts({
        lightChannels,
        lightFaders: playbookData?.lightFaders,
        lightPrograms: playbookData?.lightPrograms,
        lightConsoleUi: playbookData?.lightConsoleUi,
      }),
    [lightChannels, playbookData?.lightFaders, playbookData?.lightPrograms, playbookData?.lightConsoleUi],
  );

  const applyLayout = useCallback(
    (next: LightConsoleLayoutCounts) => {
      const patched = applyLightConsoleLayoutToPlaybookData(playbookData, {
        lightChannels,
        layout: next,
      });
      dispatch(
        showScriptMarkdownActions.setLightChannels({
          projectSlug: projectName,
          sceneName: "script",
          lightChannels: patched.lightChannels ?? lightChannels,
        }),
      );
      const slotMax = patched.lightChannels?.length ?? lightChannels.length;
      const nextSlot = Math.min(Math.max(1, selectedLightSlot || 1), Math.max(1, slotMax));
      if (nextSlot !== selectedLightSlot) {
        dispatch(
          showScriptMarkdownActions.setSelectedLightSlot({
            projectSlug: projectName,
            sceneName: "script",
            slot: nextSlot,
          }),
        );
      }
      setPlaybookData((prev) => ({
        ...(prev ?? {}),
        ...patched,
      }));
      void saveScenesForLightPlot({ force: true });
      setSettingsOpen(false);
    },
    [
      dispatch,
      lightChannels,
      projectName,
      playbookData,
      selectedLightSlot,
      saveScenesForLightPlot,
      setPlaybookData,
    ],
  );

  return {
    layout,
    applyLayout,
    settingsOpen,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
  };
}
