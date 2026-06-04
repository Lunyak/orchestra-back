import type { TheaterSpotlight } from "../../../shared/types/script";
import { LightConsolePanel } from "../../../shared/components/light-console";

type TheaterLightConsolePanelProps = {
  projectName: string;
  spotlights: TheaterSpotlight[];
  updateSpotlights: (next: TheaterSpotlight[]) => void;
  collapsed: boolean;
};

export function TheaterLightConsolePanel({
  projectName,
  spotlights,
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
      />
    </section>
  );
}
