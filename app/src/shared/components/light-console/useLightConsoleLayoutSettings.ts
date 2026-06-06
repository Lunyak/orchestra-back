import { useCallback, useEffect, useMemo, useState } from "react";
import { useScene } from "../../../features/scene";
import {
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
} from "../../../features/show-script-markdown/model/show-script-markdown-slice";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  applyLightConsoleLayoutToSceneData,
  buildLightConsoleLayoutCounts,
  type LightConsoleLayoutCounts,
} from "./light-channels-mutate";

export function useLightConsoleLayoutSettings(projectName: string) {
  const dispatch = useAppDispatch();
  const { sceneData, setSceneData, saveStepsForLightPlot } = useScene();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { lightChannels, selectedLightSlot } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName || "fools", "script"),
  );

  const layout = useMemo(
    () =>
      buildLightConsoleLayoutCounts({
        lightChannels,
        lightFaders: sceneData?.lightFaders,
        lightPrograms: sceneData?.lightPrograms,
      }),
    [lightChannels, sceneData?.lightFaders, sceneData?.lightPrograms],
  );

  const applyLayout = useCallback(
    (next: LightConsoleLayoutCounts) => {
      const patched = applyLightConsoleLayoutToSceneData(sceneData, {
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
      setSceneData((prev) => ({
        ...(prev ?? {}),
        ...patched,
      }));
      void saveStepsForLightPlot({ force: true });
      setSettingsOpen(false);
    },
    [
      dispatch,
      lightChannels,
      projectName,
      sceneData,
      selectedLightSlot,
      saveStepsForLightPlot,
      setSceneData,
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
