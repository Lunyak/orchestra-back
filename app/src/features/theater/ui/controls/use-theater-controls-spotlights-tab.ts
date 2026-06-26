import { useCallback, useMemo, useRef, useState } from "react";
import { countSceneLightChannelLinks } from "../../model/theater-light-channel-link";
import { bindSpotlightOnFaderBoard, detachSpotlightFromFaderBoard } from "../../model/theater-light-fader-bindings";
import {
  buildCompleteLightFaders,
  resolveLightProgramMinCount,
  resolveLightPrograms,
  upsertProgramChannelSnapshot,
} from "../../../../shared/components/light-console/light-console-data";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";
import { useTheaterControlsLightChannels } from "./use-theater-controls-light-channels";
import { usePlaybook } from "../../../playbook";

export function useTheaterControlsSpotlightsTab(vm: TheaterSceneViewModel) {
  const { lightChannels, selectedLightSlot } = useTheaterControlsLightChannels();
  const { playbookData, setPlaybookData, saveScenesForLightPlot } = usePlaybook();
  const [spotlightBatchCount, setSpotlightBatchCount] = useState(6);
  const [rgbBatchCount, setRgbBatchCount] = useState(4);
  const [spotlightLayoutRows, setSpotlightLayoutRows] = useState(2);
  const bindingSaveTimerRef = useRef<number | null>(null);

  const {
    regularSpotlights,
    rgbSpotlights,
    totalSpotlights,
    linkStats,
    spotlightLinkBadge,
    spotlightCountBadge,
    spotlightSourceHeightLabel,
  } =
    useMemo(() => {
      const regular = vm.displaySpotlights.filter((item) => !item.isRgb);
      const rgb = vm.displaySpotlights.filter((item) => item.isRgb);
      const total = regular.length + rgb.length;
      const plot = vm.currentScene?.lightPlot ?? [];
      const stats = countSceneLightChannelLinks(plot, vm.displaySpotlights);
      const linkBadge = `схема ${stats.fixtures} · 3D ${stats.spotlights}`;
      const countBadge =
        total > 0 ? `${total} (${regular.length} + ${rgb.length} RGB)` : "нет";
      const averageSourceHeight =
        total > 0
          ? vm.displaySpotlights.reduce((sum, item) => sum + item.position[1], 0) / total
          : 0;
      return {
        regularSpotlights: regular,
        rgbSpotlights: rgb,
        totalSpotlights: total,
        linkStats: stats,
        spotlightLinkBadge: linkBadge,
        spotlightCountBadge: countBadge,
        spotlightSourceHeightLabel:
          total > 0 ? `${averageSourceHeight.toFixed(1)} м` : "нет",
      };
    }, [vm.currentScene?.lightPlot, vm.displaySpotlights]);

  const saveSpotlightFaderBinding = useCallback(() => {
    if (bindingSaveTimerRef.current != null) {
      window.clearTimeout(bindingSaveTimerRef.current);
    }
    bindingSaveTimerRef.current = window.setTimeout(() => {
      void saveScenesForLightPlot({ force: true });
      bindingSaveTimerRef.current = null;
    }, 900);
  }, [saveScenesForLightPlot]);

  const bindSpotlightToFader = useCallback(
    (faderId: number, spotlightId: number, channel: number) => {
      setPlaybookData((prev) => {
        const current = prev?.lightFaders?.v === 1 ? prev.lightFaders.faders : [];
        const ch = Math.max(1, Math.trunc(channel) || 1);
        const nextFaderRows = bindSpotlightOnFaderBoard(current, faderId, spotlightId, ch);
        const nextFaders = buildCompleteLightFaders({
          v: 1,
          count: nextFaderRows.length,
          faders: nextFaderRows,
        });
        const programs = resolveLightPrograms(
          prev?.lightPrograms,
          resolveLightProgramMinCount(lightChannels.length, prev?.lightPrograms, ch),
        );
        return {
          ...(prev ?? {}),
          lightFaders: nextFaders,
          lightPrograms: upsertProgramChannelSnapshot(programs, ch, nextFaders),
        };
      });
      saveSpotlightFaderBinding();
    },
    [lightChannels.length, saveSpotlightFaderBinding, setPlaybookData],
  );

  const unbindSpotlightFromFader = useCallback(
    (spotlightId: number) => {
      setPlaybookData((prev) => {
        const current = prev?.lightFaders?.v === 1 ? prev.lightFaders.faders : [];
        return {
          ...(prev ?? {}),
          lightFaders: {
            v: 1,
            faders: detachSpotlightFromFaderBoard(current, spotlightId),
          },
        };
      });
      saveSpotlightFaderBinding();
    },
    [saveSpotlightFaderBinding, setPlaybookData],
  );

  return {
    lightChannels,
    lightFaders:
      playbookData?.lightFaders && playbookData.lightFaders.v === 1
        ? playbookData.lightFaders.faders
        : [],
    selectedLightSlot,
    spotlightBatchCount,
    setSpotlightBatchCount,
    rgbBatchCount,
    setRgbBatchCount,
    spotlightLayoutRows,
    setSpotlightLayoutRows,
    regularSpotlights,
    rgbSpotlights,
    totalSpotlights,
    linkStats,
    spotlightLinkBadge,
    spotlightCountBadge,
    spotlightSourceHeightLabel,
    bindSpotlightToFader,
    unbindSpotlightFromFader,
  };
}
