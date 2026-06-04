import { useProject } from "../../project/model/project-context";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { useScene } from "../../scene";
import { LightPlotModeTabs } from "../../../shared/components/light-plot/LightPlotModeTabs";
import { useSpectacleRun } from "../model/useSpectacleRun";
import { SpectacleRunProvider } from "../model/spectacle-run-context";
import { SpectacleRunMeta, SpectacleRunToolbarActions } from "./SpectacleRunToolbar";
import { SpectacleRunContent } from "./SpectacleRunContent";
import "../../../shared/components/light-console/light-console.css";
import "./style.css";

export type SpectacleRunPageSectionProps = {
  onOpenTechCard?: (stepIndex?: number) => void;
  onSyncPlotFrom3d?: () => void;
};

export function SpectacleRunPageSection({
  onOpenTechCard,
  onSyncPlotFrom3d,
}: SpectacleRunPageSectionProps) {
  const { projectName } = useProject();
  const { steps } = useScene();
  const { lightChannels } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );

  const run = useSpectacleRun({
    projectName: projectName ?? "",
    steps,
    lightChannels,
  });

  return (
    <SpectacleRunProvider value={run}>
      <div className="spectacle-run-page-section">
        <LightPlotModeTabs
          onOpenTechCard={onOpenTechCard}
          center={<SpectacleRunMeta />}
          trailing={<SpectacleRunToolbarActions />}
        />
        <SpectacleRunContent
          onOpenTechCard={onOpenTechCard}
          onSyncPlotFrom3d={onSyncPlotFrom3d}
        />
      </div>
    </SpectacleRunProvider>
  );
}
