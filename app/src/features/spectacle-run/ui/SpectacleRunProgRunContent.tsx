import { useMemo } from "react";
import { useProject } from "../../project/model/project-context";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { usePlaybook } from "../../playbook";
import { useSpectacleRunContext } from "../model/spectacle-run-context";
import { SpectacleRunKadrStrip } from "./SpectacleRunKadrStrip";
import { SpectacleRunProgRunNav } from "./SpectacleRunToolbar";

export function SpectacleRunProgRunContent() {
  const { projectName } = useProject();
  const { scenes, playbookData } = usePlaybook();
  const { lightChannels } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );
  const run = useSpectacleRunContext();
  const { tape, tapeIndex } = run;

  const playlist = useMemo(
    () =>
      (playbookData?.playlist ?? []).map((track) => ({
        id: track.id,
        title: track.title ?? "",
      })),
    [playbookData?.playlist],
  );
  const sounds = useMemo(
    () =>
      (playbookData?.sounds ?? []).map((sound) => ({
        id: sound.id,
        title: sound.title ?? "",
      })),
    [playbookData?.sounds],
  );

  if (tape.length === 0) {
    return (
      <div className="spectacle-run spectacle-run--empty spectacle-run--prog-run-only">
        <p>Нет сцен в спектакле. Добавьте сцены в сценарии.</p>
      </div>
    );
  }

  return (
    <div className="spectacle-run spectacle-run--prog-run-only">
      <div className="spectacle-run__prog-run-main">
        <SpectacleRunKadrStrip
          variant="prog-run"
          projectName={projectName ?? ""}
          tape={tape}
          tapeIndex={tapeIndex}
          scenes={scenes}
          lightChannels={lightChannels}
          lightFaders={run.lightFaders}
          lightPrograms={run.lightPrograms}
          playlist={playlist}
          sounds={sounds}
          videos={run.videos}
          holdImages={run.holdImages}
          projectorCtx={run.projectorMediaCtx}
          onSelectIndex={run.goToTapeIndex}
        />
      </div>
      <SpectacleRunProgRunNav />
    </div>
  );
}
