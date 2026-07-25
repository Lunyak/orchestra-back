import cn from "classnames";
import { TheaterControlsDecorTab } from "./TheaterControlsDecorTab";
import { TheaterControlsLayoutTab } from "./TheaterControlsLayoutTab";
import { TheaterControlsModelsTab } from "./TheaterControlsModelsTab";
import { TheaterControlsSpotlightsTab } from "./TheaterControlsSpotlightsTab";
import type { TheaterControlsTabProps } from "./types";

export function TheaterControlsSettings({ vm }: TheaterControlsTabProps) {
  const { activeTab } = vm;
  const isModelsTab = activeTab === "models";

  return (
    <div
      className={cn(
        "theater-controls-settings",
        "theater-controls--stage-brutal",
        isModelsTab && "theater-controls-settings--fill",
      )}
    >
      {activeTab === "spotlights" ? <TheaterControlsSpotlightsTab vm={vm} /> : null}
      {isModelsTab ? <TheaterControlsModelsTab vm={vm} /> : null}
      {activeTab === "decor" ? <TheaterControlsDecorTab vm={vm} /> : null}
      {activeTab === "layout" ? <TheaterControlsLayoutTab vm={vm} /> : null}
    </div>
  );
}
