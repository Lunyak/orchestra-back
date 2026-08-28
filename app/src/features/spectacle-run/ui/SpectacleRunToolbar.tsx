import cn from "classnames";
import { useState } from "react";
import { useCompactKadrStrip } from "@shared/hooks/useCompactKadrStrip";
import { useAppSelector } from "../../../shared/store/hooks";
import {
  findKadrById,
  readSceneLightKadrs,
} from "../../theater/model/light-kadrs";
import { formatKadrTransitionForDisplay } from "../model/kadr-section-transition";
import { useSpectacleRunContext } from "../model/spectacle-run-context";
import {
  ProgRunStripModesButton,
  ProgRunStripModesModal,
} from "./ProgRunStripModesModal";
import {
  SpectacleRunLightPlotNavButton,
  SpectacleRunLightPlotNavModal,
} from "./SpectacleRunLightPlotNavModal";
import "./prog-run-strip-modes-modal.css";
import "./spectacle-run-light-plot-nav-modal.css";

export function SpectacleRunMeta() {
  const lightPlotMode = useAppSelector((state) => state.scriptUi.lightPlotMode);
  const isProgRun = lightPlotMode === "prog-run";
  const compactStrip = useCompactKadrStrip();
  const run = useSpectacleRunContext();
  const { tape, currentItem, currentScene } = run;

  if (tape.length === 0 || !isProgRun || compactStrip) return null;

  const currentKadr =
    currentItem?.kadrId && currentScene && !currentItem.isPlaceholder
      ? findKadrById(readSceneLightKadrs(currentScene), currentItem.kadrId)
      : undefined;
  const transitionLine = currentKadr?.transitionText
    ? formatKadrTransitionForDisplay(currentKadr.transitionText)
    : "";

  if (!transitionLine) return null;

  return (
    <div className="spectacle-run__meta" aria-live="polite">
      <span className="spectacle-run__meta-transition" title={transitionLine}>
        {transitionLine}
      </span>
    </div>
  );
}

export type SpectacleRunChromeControlsProps = {
  mode: "rehearsal" | "prog-run";
};

/** Общий ряд управления в шапке техчасти — одно место для сборки и прогона. */
export function SpectacleRunChromeControls({ mode }: SpectacleRunChromeControlsProps) {
  const run = useSpectacleRunContext();
  const compactStrip = useCompactKadrStrip();
  const { tape, tapeIndex } = run;
  const [modesOpen, setModesOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const tapeLen = tape.length;
  const isAssembly = mode === "rehearsal";
  const pauseLabel = run.progRunPaused ? "▶" : "⏸";
  const nextIsScene = run.nextLabel !== "Далее";
  const nextTitle = run.nextLabel;
  const addTitle = run.currentItem?.isPlaceholder
    ? "Добавить первую картину в сцену"
    : `Вставить картину ${run.nextKadrNo} после текущей`;
  const stripModes = {
    layout: run.progRunKadrStripLayout,
    notesOverlay: run.progRunKadrStripNotesOverlay,
    plainCover: run.progRunKadrStripPlainCover,
    lightConsoleOpen: run.progRunLightConsoleOpen,
    wideLayout: run.progRunWideLayout,
  };

  if (tapeLen === 0) return null;

  return (
    <div
      className={cn(
        "spectacle-run__toolbar-actions",
        compactStrip && "spectacle-run__toolbar-actions--compact",
      )}
      aria-label={isAssembly ? "Навигация сборки" : "Навигация прогона"}
    >
      {!isAssembly ? (
        <>
          <div
            className="spectacle-run__toolbar-row spectacle-run__toolbar-row--playback"
            role="group"
            aria-label="Управление прогоном"
          >
            <div className="spectacle-run__nav">
              <button
                type="button"
                className="spectacle-run__nav-btn spectacle-run__nav-btn--icon"
                disabled={!run.canGoPrev}
                onClick={run.goPrev}
                title="Предыдущая картина"
                aria-label="Предыдущая картина"
              >
                ◀
              </button>
              <button
                type="button"
                className={cn(
                  "spectacle-run__nav-btn",
                  "spectacle-run__nav-btn--icon",
                  "spectacle-run__nav-btn--primary",
                )}
                disabled={!run.canGoNext}
                onClick={run.goNext}
                title={nextTitle}
                aria-label={nextTitle}
              >
                {nextIsScene ? "≫" : "▶"}
              </button>
            </div>

            <span className="spectacle-run__tape-counter" aria-live="polite">
              {tapeIndex + 1}/{tapeLen}
            </span>

            <button
              type="button"
              className={cn(
                "spectacle-run__add-kadr-btn",
                compactStrip && "spectacle-run__add-kadr-btn--icon",
              )}
              title="Старт прогона"
              aria-label="Старт прогона"
              onClick={run.startProgRun}
            >
              {compactStrip ? "▶" : "Старт"}
            </button>
            <button
              type="button"
              className={cn(
                "spectacle-run__add-kadr-btn",
                compactStrip && "spectacle-run__add-kadr-btn--icon",
              )}
              data-primary={run.progRunPaused ? "true" : undefined}
              aria-pressed={run.progRunPaused}
              title={run.progRunPaused ? "Продолжить" : "Пауза"}
              aria-label={run.progRunPaused ? "Продолжить" : "Пауза"}
              onClick={run.toggleProgRunPause}
            >
              {compactStrip ? pauseLabel : run.progRunPaused ? "Продолжить" : "Пауза"}
            </button>

            {run.canEditKadr ? (
              <button
                type="button"
                className="spectacle-run__add-kadr-btn spectacle-run__add-kadr-btn--icon"
                data-primary="true"
                title="Изменить картину"
                aria-label="Изменить картину"
                onClick={run.editCurrentKadr}
              >
                ✎
              </button>
            ) : null}
          </div>

          {!compactStrip ? (
            <div
              className="spectacle-run__toolbar-modes"
              role="group"
              aria-label="Режимы ленты"
            >
              <ProgRunStripModesButton
                modes={stripModes}
                onClick={() => setModesOpen(true)}
              />
            </div>
          ) : null}

          {!compactStrip ? (
            <ProgRunStripModesModal
              isOpen={modesOpen}
              modes={stripModes}
              onClose={() => setModesOpen(false)}
              onLayoutChange={run.setProgRunKadrStripLayout}
              onToggleNotesOverlay={run.toggleProgRunKadrStripNotesOverlay}
              onTogglePlainCover={run.toggleProgRunKadrStripPlainCover}
              onToggleLightConsoleOpen={run.toggleProgRunLightConsoleOpen}
              onToggleWideLayout={run.toggleProgRunWideLayout}
            />
          ) : null}
        </>
      ) : (
        <>
          <div
            className="spectacle-run__toolbar-row spectacle-run__toolbar-row--playback"
            role="group"
            aria-label="Навигация сборки"
          >
            <div className="spectacle-run__nav">
              <button
                type="button"
                className="spectacle-run__nav-btn spectacle-run__nav-btn--icon"
                disabled={!run.canGoPrev}
                onClick={run.goPrev}
                title="Предыдущая картина"
                aria-label="Предыдущая картина"
              >
                ◀
              </button>
              <button
                type="button"
                className={cn(
                  "spectacle-run__nav-btn",
                  "spectacle-run__nav-btn--icon",
                  "spectacle-run__nav-btn--primary",
                )}
                disabled={!run.canGoNext}
                onClick={run.goNext}
                title={nextTitle}
                aria-label={nextTitle}
              >
                {nextIsScene ? "≫" : "▶"}
              </button>
            </div>

            <span className="spectacle-run__tape-counter" aria-live="polite">
              {tapeIndex + 1}/{tapeLen}
            </span>
          </div>

          <div
            className="spectacle-run__toolbar-row spectacle-run__toolbar-row--cards"
            role="group"
            aria-label="Действия сборки"
          >
            {run.canEditKadr ? (
              <button
                type="button"
                className="spectacle-run__add-kadr-btn spectacle-run__add-kadr-btn--icon"
                data-primary="true"
                title="Изменить картину"
                aria-label="Изменить картину"
                onClick={run.editCurrentKadr}
              >
                ✎
              </button>
            ) : null}

            {run.canCopyTheaterFromPreviousScene ? (
              <button
                type="button"
                className="spectacle-run__add-kadr-btn spectacle-run__add-kadr-btn--icon"
                title="Скопировать расстановку с предыдущей сцены"
                aria-label="Скопировать расстановку с предыдущей сцены"
                onClick={run.copyTheaterFromPreviousScene}
              >
                ↶С
              </button>
            ) : null}

            {run.canCopyKadrToNext ? (
              <button
                type="button"
                className="spectacle-run__add-kadr-btn spectacle-run__add-kadr-btn--icon"
                title="Скопировать свет на следующую картину"
                aria-label="Скопировать свет на следующую картину"
                onClick={run.copyCurrentKadrToNext}
              >
                ↷К
              </button>
            ) : null}

            {run.canAddKadr ? (
              <button
                type="button"
                className="spectacle-run__add-kadr-btn spectacle-run__add-kadr-btn--icon"
                title={addTitle}
                aria-label={addTitle}
                onClick={run.addKadrToCurrentScene}
              >
                +
              </button>
            ) : null}

            {run.canDeleteKadr ? (
              <button
                type="button"
                className={cn(
                  "spectacle-run__add-kadr-btn",
                  "spectacle-run__add-kadr-btn--icon",
                  "spectacle-run__add-kadr-btn--danger",
                )}
                title="Удалить картину"
                aria-label="Удалить картину"
                onClick={run.deleteCurrentKadr}
              >
                ×
              </button>
            ) : null}
          </div>
        </>
      )}

      {compactStrip ? (
        <>
          <SpectacleRunLightPlotNavButton
            showSchemeTabs={isAssembly}
            onOpen={() => setNavOpen(true)}
          />
          <SpectacleRunLightPlotNavModal
            isOpen={navOpen}
            onClose={() => setNavOpen(false)}
            showSchemeTabs={isAssembly}
          />
        </>
      ) : null}
    </div>
  );
}
