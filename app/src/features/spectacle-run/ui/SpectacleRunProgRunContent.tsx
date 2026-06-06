import { useMemo } from "react";
import { useProject } from "../../project/model/project-context";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { useScene } from "../../scene";
import { useSpectacleRunContext } from "../model/spectacle-run-context";
import { SpectacleRunKadrStrip } from "./SpectacleRunKadrStrip";
import { SpectacleRunProgRunNav } from "./SpectacleRunToolbar";

export function SpectacleRunProgRunContent() {
  const { projectName } = useProject();
  const { steps, sceneData } = useScene();
  const { lightChannels } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );
  const run = useSpectacleRunContext();
  const { tape, tapeIndex } = run;

  const playlist = useMemo(
    () =>
      (sceneData?.playlist ?? []).map((track) => ({
        id: track.id,
        title: track.title ?? "",
      })),
    [sceneData?.playlist],
  );
  const sounds = useMemo(
    () =>
      (sceneData?.sounds ?? []).map((sound) => ({
        id: sound.id,
        title: sound.title ?? "",
      })),
    [sceneData?.sounds],
  );

  if (tape.length === 0) {
    return (
      <div className="spectacle-run spectacle-run--empty spectacle-run--prog-run-only">
        <p>Нет шагов в спектакле. Добавьте шаги в сценарии.</p>
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
          steps={steps}
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
