import { useMemo, useState } from "react";
import { countStepLightChannelLinks } from "../../model/theater-light-channel-link";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";
import { useTheaterControlsLightChannels } from "./use-theater-controls-light-channels";

export function useTheaterControlsSpotlightsTab(vm: TheaterSceneViewModel) {
  const { lightChannels, selectedLightSlot } = useTheaterControlsLightChannels();
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

  return {
    lightChannels,
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
  };
}
