import { useCallback, useMemo, useState } from "react";
import { countStepLightChannelLinks } from "../../model/theater-light-channel-link";
import { mergeFaderSpotlightLink } from "../../model/theater-light-fader-bindings";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";
import { useTheaterControlsLightChannels } from "./use-theater-controls-light-channels";
import { useScene } from "../../../scene";

export function useTheaterControlsSpotlightsTab(vm: TheaterSceneViewModel) {
  const { lightChannels, selectedLightSlot } = useTheaterControlsLightChannels();
  const { sceneData, setSceneData } = useScene();
  const [spotlightBatchCount, setSpotlightBatchCount] = useState(6);
  const [rgbBatchCount, setRgbBatchCount] = useState(4);
  const [spotlightLayoutRows, setSpotlightLayoutRows] = useState(2);

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
      const plot = vm.currentStep?.lightPlot ?? [];
      const stats = countStepLightChannelLinks(plot, vm.displaySpotlights);
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
    }, [vm.currentStep?.lightPlot, vm.displaySpotlights]);

  const bindSpotlightToFader = useCallback(
    (faderId: number, spotlightId: number, channel: number) => {
      setSceneData((prev) => {
        const current = prev?.lightFaders?.v === 1 ? prev.lightFaders.faders : [];
        const exists = current.some((item) => item.id === faderId);
        const baseFader = exists
          ? current.find((item) => item.id === faderId)!
          : {
              id: faderId,
              label: `ф ${faderId}`,
              channel,
              intensity: 1,
              enabled: true,
              links: [] as { channel: number; spotlightId?: number }[],
            };
        const nextFader = mergeFaderSpotlightLink(baseFader, spotlightId, channel);
        return {
          ...(prev ?? {}),
          lightFaders: {
            v: 1,
            faders: exists
              ? current.map((item) => (item.id === faderId ? nextFader : item))
              : [...current, nextFader],
          },
        };
      });
    },
    [setSceneData],
  );

  return {
    lightChannels,
    lightFaders:
      sceneData?.lightFaders && sceneData.lightFaders.v === 1
        ? sceneData.lightFaders.faders
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
  };
}
