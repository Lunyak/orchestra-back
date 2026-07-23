import { TheaterControlsDecorTab } from "./TheaterControlsDecorTab";
import { TheaterControlsLayoutTab } from "./TheaterControlsLayoutTab";
import { TheaterControlsModelsTab } from "./TheaterControlsModelsTab";
import { TheaterControlsSpotlightsTab } from "./TheaterControlsSpotlightsTab";
import type { TheaterControlsTabProps } from "./types";

export function TheaterControlsSettings({ vm }: TheaterControlsTabProps) {
  const { activeTab } = vm;
  return (
    <div className="theater-controls-settings theater-controls--stage-brutal">
      {activeTab === "spotlights" ? <TheaterControlsSpotlightsTab vm={vm} /> : null}
      {activeTab === "models" ? <TheaterControlsModelsTab vm={vm} /> : null}
      {activeTab === "decor" ? <TheaterControlsDecorTab vm={vm} /> : null}
      {activeTab === "layout" ? <TheaterControlsLayoutTab vm={vm} /> : null}
    </div>
  );
}
