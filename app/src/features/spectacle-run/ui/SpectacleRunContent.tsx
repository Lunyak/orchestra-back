import cn from "classnames";
import { useProject } from "../../project/model/project-context";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { usePlaybook } from "../../playbook";
import { useSpectacleRunContext } from "../model/spectacle-run-context";
import { SpectacleRunSceneText } from "./SpectacleRunSceneText";
import { SpectacleRunSchemePane } from "./SpectacleRunSchemePane";
import { SpectacleRunKadrStrip } from "./SpectacleRunKadrStrip";

export function SpectacleRunContent() {
  const { projectName } = useProject();
  const { scenes } = usePlaybook();
  const { lightChannels, selectedLightSlot } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );
  const run = useSpectacleRunContext();
  const { tape, tapeIndex, currentItem, currentScene } = run;

  if (tape.length === 0) {
    return (
      <div className="spectacle-run spectacle-run--empty">
        <p>Нет сцен в спектакле. Добавьте сцены в сценарии.</p>
      </div>
    );
  }

  return (
    <div className={cn("spectacle-run", run.textHidden && "spectacle-run--text-hidden")}>
      <div className="spectacle-run__split">
        <aside className="spectacle-run__text-pane">
          <SpectacleRunSceneText scene={currentScene} />
        </aside>
        <main className="spectacle-run__scheme-pane">
          <SpectacleRunSchemePane
            scene={currentScene}
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
        scenes={scenes}
        lightChannels={lightChannels}
        lightFaders={run.lightFaders}
        lightPrograms={run.lightPrograms}
        onSelectIndex={run.goToTapeIndex}
      />
    </div>
  );
}

