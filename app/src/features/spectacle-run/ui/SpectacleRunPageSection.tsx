import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { useProject } from "../../project/model/project-context";
import { usePlaybook } from "../../playbook";
import { LightPlotModeTabs } from "../../../shared/components/light-plot/LightPlotModeTabs";
import { useSpectacleRun } from "../model/useSpectacleRun";
import { SpectacleRunProvider } from "../model/spectacle-run-context";
import {
  SpectacleRunMeta,
  SpectacleRunProgRunToolbar,
  SpectacleRunToolbarActions,
} from "./SpectacleRunToolbar";
import { SpectacleRunContent } from "./SpectacleRunContent";
import { SpectacleRunProgRunContent } from "./SpectacleRunProgRunContent";
import { CreateKadrModalHost } from "./CreateKadrModalHost";
import { LightConsoleSettingsModal } from "../../../shared/components/light-console/LightConsoleSettingsModal";
import "../../../shared/components/light-console/light-console.css";
import "./style.css";

export function SpectacleRunPageSection() {
  const { projectName } = useProject();
  const { scenes } = usePlaybook();
  const lightPlotMode = useAppSelector((state) => state.scriptUi.lightPlotMode);
  const { lightChannels } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );

  const run = useSpectacleRun({
    projectName: projectName ?? "",
    scenes,
    lightChannels,
  });

  return (
    <SpectacleRunProvider value={run}>
      <div className="spectacle-run-page-section">
        <LightPlotModeTabs
          center={lightPlotMode === "rehearsal" ? <SpectacleRunMeta /> : null}
          trailing={
            lightPlotMode === "rehearsal" ? (
              <SpectacleRunToolbarActions />
            ) : (
              <SpectacleRunProgRunToolbar />
            )
          }
        />
        {lightPlotMode === "rehearsal" ? (
          <SpectacleRunContent />
        ) : (
          <SpectacleRunProgRunContent />
        )}
        {lightPlotMode === "rehearsal" || run.canEditKadr ? (
          <CreateKadrModalHost lightChannels={lightChannels} />
        ) : null}
        {lightPlotMode === "rehearsal" ? (
          <LightConsoleSettingsModal
            isOpen={run.consoleLayoutSettings.settingsOpen}
            layout={run.consoleLayoutSettings.layout}
            onClose={run.consoleLayoutSettings.closeSettings}
            onApply={run.consoleLayoutSettings.applyLayout}
          />
        ) : null}
      </div>
    </SpectacleRunProvider>
  );
}
