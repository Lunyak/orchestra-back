import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { useProject } from "../../project/model/project-context";
import { usePlaybook } from "../../playbook";
import { SpectacleTechChromePortal } from "../../spectacle/ui/spectacle-tech-chrome-slots";
import { useSpectacleRun } from "../model/useSpectacleRun";
import { SpectacleRunProvider } from "../model/spectacle-run-context";
import {
  SpectacleRunChromeControls,
  SpectacleRunMeta,
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

  const isAssembly = lightPlotMode === "rehearsal";
  const chromeMode = isAssembly ? "rehearsal" : "prog-run";

  return (
    <SpectacleRunProvider value={run}>
      <div className="spectacle-run-page-section">
        <SpectacleTechChromePortal
          left={<SpectacleRunChromeControls mode={chromeMode} />}
          center={<SpectacleRunMeta />}
        />
        {isAssembly ? <SpectacleRunContent /> : <SpectacleRunProgRunContent />}
        {isAssembly || run.canEditKadr ? (
          <CreateKadrModalHost lightChannels={lightChannels} />
        ) : null}
        {isAssembly ? (
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
