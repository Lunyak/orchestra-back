import { useProject } from "../../project/model/project-context";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { usePlaybook } from "../../playbook";
import { useSpectacleRun } from "../model/useSpectacleRun";
import { SpectacleRunProvider } from "../model/spectacle-run-context";
import { SpectacleRunContent } from "./SpectacleRunContent";
import "../../../shared/components/light-console/light-console.css";
import "./style.css";

/** Обёртка с провайдером состояния спектакля (контент без шапки — шапка в light-plot-mode-tabs). */
export function SpectacleRunView() {
  const { projectName } = useProject();
  const { scenes } = usePlaybook();
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
      <SpectacleRunContent />
    </SpectacleRunProvider>
  );
}
