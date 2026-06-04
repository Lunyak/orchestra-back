import type { CSSProperties } from "react";
import { useProject } from "../../project/model/project-context";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { useScene } from "../../scene";
import { useSpectacleRun } from "../model/useSpectacleRun";
import { SpectacleRunStepText } from "./SpectacleRunStepText";
import { SpectacleRunSchemePane } from "./SpectacleRunSchemePane";
import "../../../shared/components/light-console/light-console.css";
import "./style.css";

export type SpectacleRunViewProps = {
  onOpenPlotSetup?: () => void;
  onSyncPlotFrom3d?: () => void;
};

export function SpectacleRunView({
  onOpenPlotSetup,
  onSyncPlotFrom3d,
}: SpectacleRunViewProps) {
  const { projectName } = useProject();
  const { steps } = useScene();
  const { lightChannels, selectedLightSlot } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );

  const run = useSpectacleRun({
    projectName: projectName ?? "",
    steps,
    lightChannels,
  });

  const { tape, tapeIndex, currentItem, currentStep } = run;
  const tapeLen = tape.length;
  const sliderPct = tapeLen <= 1 ? 0 : Math.round((tapeIndex / (tapeLen - 1)) * 100);

  if (tapeLen === 0) {
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
      <header className="spectacle-run__header">
        <div className="spectacle-run__meta">
          <span className="spectacle-run__meta-step">
            Шаг {currentItem?.stepOrdinal ?? "—"}
            {currentItem?.stepTitle ? ` · ${currentItem.stepTitle}` : ""}
          </span>
          <span className="spectacle-run__meta-kadr">
            {currentItem?.isPlaceholder
              ? "Нет картин"
              : `Картина ${currentItem?.kadrNo ?? "—"} · ${currentItem?.headingTitle ?? ""}`}
          </span>
        </div>

        <div className="spectacle-run__nav">
          <button
            type="button"
            className="spectacle-run__nav-btn"
            disabled={!run.canGoPrev}
            onClick={run.goPrev}
            title="Предыдущая картина"
          >
            ◀
          </button>
          <button
            type="button"
            className="spectacle-run__nav-btn spectacle-run__nav-btn--primary"
            disabled={!run.canGoNext}
            onClick={run.goNext}
            title={run.nextLabel}
          >
            {run.nextLabel} ▶
          </button>
        </div>

        <div className="spectacle-run__slider-wrap">
          <input
            type="range"
            className="spectacle-run__slider"
            min={0}
            max={Math.max(0, tapeLen - 1)}
            value={tapeIndex}
            onChange={(e) => run.goToTapeIndex(Number(e.target.value))}
            style={{ "--spectacle-run-slider-pct": `${sliderPct}%` } as CSSProperties}
            aria-label="Лента картин спектакля"
          />
          <span className="spectacle-run__slider-label">
            {tapeIndex + 1} / {tapeLen}
          </span>
        </div>

        {run.canAddKadr ? (
          <button
            type="button"
            className="spectacle-run__add-kadr-btn"
            title="Добавить картину в текст текущего шага"
            onClick={run.addKadrToCurrentStep}
          >
            + Картина {run.nextKadrNo}
          </button>
        ) : null}

        <button
          type="button"
          className="spectacle-run__text-toggle"
          onClick={run.toggleTextHidden}
        >
          {run.textHidden ? "Показать текст" : "Скрыть текст"}
        </button>
      </header>

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
            onAddKadr={run.addKadrToCurrentStep}
            nextKadrNo={run.nextKadrNo}
            onOpenPlotSetup={onOpenPlotSetup}
            onSyncPlotFrom3d={onSyncPlotFrom3d}
            canSyncPlotFrom3d={(currentStep?.theaterSpotlights?.length ?? 0) > 0}
          />
        </main>
      </div>
    </div>
  );
}
