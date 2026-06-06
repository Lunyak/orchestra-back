import { useProject } from "../../project/model/project-context";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { useScene } from "../../scene";
import { useSpectacleRunContext } from "../model/spectacle-run-context";
import { SpectacleRunStepText } from "./SpectacleRunStepText";
import { SpectacleRunSchemePane } from "./SpectacleRunSchemePane";
import { SpectacleRunKadrStrip } from "./SpectacleRunKadrStrip";

export function SpectacleRunContent() {
  const { projectName } = useProject();
  const { steps } = useScene();
  const { lightChannels, selectedLightSlot } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );
  const run = useSpectacleRunContext();
  const { tape, tapeIndex, currentItem, currentStep } = run;

  if (tape.length === 0) {
    return (
      <div className="spectacle-run spectacle-run--empty">
        <p>Нет шагов в спектакле. Добавьте шаги в сценарии.</p>
      </div>
    );
  }

  return (
    <div
      className={[
        "spectacle-run",
        run.textHidden ? "spectacle-run--text-hidden" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="spectacle-run__split">
        <aside className="spectacle-run__text-pane">
          <SpectacleRunStepText step={currentStep} />
        </aside>
        <main className="spectacle-run__scheme-pane">
          <SpectacleRunSchemePane
            step={currentStep}
            tapeItem={currentItem}
            lightChannels={lightChannels}
            lightFaders={run.lightFaders}
            lightPrograms={run.lightPrograms}
            lightChannelRoles={run.lightChannelRoles}
            onLightChannelRolesChange={run.setLightChannelRoles}
            selectedLightSlot={selectedLightSlot}
            liveConsole={run.liveConsole}
            liveStatus={run.liveStatus}
            onLiveStatus={run.setLiveStatus}
            onOpenConsoleSettings={run.consoleLayoutSettings.openSettings}
          />
        </main>
      </div>

      <SpectacleRunKadrStrip
        variant="rehearsal"
        projectName={projectName ?? ""}
        tape={tape}
        tapeIndex={tapeIndex}
        steps={steps}
        lightChannels={lightChannels}
        lightFaders={run.lightFaders}
        lightPrograms={run.lightPrograms}
        onSelectIndex={run.goToTapeIndex}
      />
    </div>
  );
}
