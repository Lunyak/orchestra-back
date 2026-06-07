import type { TheaterSpotlight } from "../../../shared/types/script";
import { LightConsolePanel } from "../../../shared/components/light-console";
import {
  readSpotlightChannel,
  readSpotlightFaderId,
} from "../model/theater-light-fader-bindings";

type TheaterLightConsolePanelProps = {
  projectName: string;
  spotlights: TheaterSpotlight[];
  updateSpotlights: (next: TheaterSpotlight[]) => void;
  collapsed: boolean;
};

export function TheaterLightConsolePanel({
  projectName,
  spotlights,
  updateSpotlights,
  collapsed,
}: TheaterLightConsolePanelProps) {
  if (collapsed) return null;

  return (
    <section className="theater-light-console" data-collapsed={collapsed} aria-label="Пульт света">
      <LightConsolePanel
        projectName={projectName}
        spotlights={spotlights}
        mode="live"
        className="light-console--theater"
        onPatchFader={(faderId, patch, selectedLightSlot) => {
          const shouldPatchEnabled =
            Object.prototype.hasOwnProperty.call(patch, "enabled") ||
            Object.prototype.hasOwnProperty.call(patch, "intensity");
          if (!shouldPatchEnabled) return;

          const nextEnabled =
            patch.enabled === false ? false : (patch.intensity ?? 0) > 0;
          const channel =
            selectedLightSlot > 0 && Number.isFinite(selectedLightSlot)
              ? Math.trunc(selectedLightSlot)
              : undefined;

          let changed = false;
          const nextSpotlights = spotlights.map((spotlight) => {
            const spotlightFaderId = readSpotlightFaderId(spotlight);
            if (spotlightFaderId !== faderId) return spotlight;
            const spotlightChannel = readSpotlightChannel(spotlight);
            if (channel != null && spotlightChannel !== channel) return spotlight;
            if ((spotlight.enabled ?? true) === nextEnabled) return spotlight;
            changed = true;
            return { ...spotlight, enabled: nextEnabled };
          });
          if (changed) updateSpotlights(nextSpotlights);
        }}
      />
    </section>
  );
}
