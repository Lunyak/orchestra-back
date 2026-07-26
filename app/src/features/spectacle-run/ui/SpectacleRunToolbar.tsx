import cn from "classnames";
import {
  formatKadrTransitionForDisplay,
  parseKadrTransitionRawInSection,
} from "../model/kadr-section-transition";
import { useSpectacleRunContext } from "../model/spectacle-run-context";

function kadrMetaLabel(item: {
  isPlaceholder?: boolean;
  kadrNo?: number;
  headingTitle?: string;
}): string {
  if (item.isPlaceholder) return "Нет картин";
  const kadrNo = item.kadrNo ?? "—";
  const heading = String(item.headingTitle ?? "").trim();
  const defaultTitle = `Картина ${kadrNo}`;
  const headingIsDefault =
    !heading ||
    heading === defaultTitle ||
    /^картина\s+\d+$/i.test(heading);
  if (headingIsDefault) return `К${kadrNo}`;
  return `К${kadrNo} · ${heading}`;
}

export function SpectacleRunMeta() {
  const run = useSpectacleRunContext();
  const { tape, currentItem, currentScene } = run;

  if (tape.length === 0) return null;

  const sceneOrdinal = currentItem?.sceneOrdinal ?? "—";
  const sceneTitle = String(currentItem?.sceneTitle ?? "").trim();
  const transitionLine =
    currentItem?.section && currentScene && !currentItem.isPlaceholder
      ? formatKadrTransitionForDisplay(
          parseKadrTransitionRawInSection(
            String(currentScene.markdown ?? ""),
            currentItem.section,
          ),
        )
      : "";

  return (
    <div className="spectacle-run__meta" aria-live="polite">
      <span className="spectacle-run__meta-scene">
        {sceneTitle ? `С${sceneOrdinal} · ${sceneTitle}` : `С${sceneOrdinal}`}
      </span>
      <span className="spectacle-run__meta-kadr">
        {kadrMetaLabel(currentItem ?? { isPlaceholder: true })}
      </span>
      {transitionLine ? (
        <span className="spectacle-run__meta-transition" title={transitionLine}>
          {transitionLine}
        </span>
      ) : null}
    </div>
  );
}

export type SpectacleRunChromeControlsProps = {
  mode: "rehearsal" | "prog-run";
};

/** Общий ряд управления в шапке техчасти — одно место для сборки и прогона. */
export function SpectacleRunChromeControls({ mode }: SpectacleRunChromeControlsProps) {
  const run = useSpectacleRunContext();
  const { tape, tapeIndex } = run;
  const tapeLen = tape.length;
  const isAssembly = mode === "rehearsal";
  const nextIsScene = run.nextLabel !== "Далее";
  const nextTitle = run.nextLabel;
  const addTitle = run.currentItem?.isPlaceholder
    ? "Добавить первую картину в сцену"
    : `Вставить картину ${run.nextKadrNo} после текущей`;

  if (tapeLen === 0) return null;

  return (
    <div
      className="spectacle-run__toolbar-actions"
      aria-label={isAssembly ? "Навигация сборки" : "Навигация прогона"}
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

      {!isAssembly ? (
        <>
          <button
            type="button"
            className="spectacle-run__add-kadr-btn"
            title="Старт прогона"
            aria-label="Старт прогона"
            onClick={run.startProgRun}
          >
            Старт
          </button>
          <button
            type="button"
            className="spectacle-run__add-kadr-btn"
            data-primary={run.progRunPaused ? "true" : undefined}
            aria-pressed={run.progRunPaused}
            title={run.progRunPaused ? "Продолжить" : "Пауза"}
            aria-label={run.progRunPaused ? "Продолжить" : "Пауза"}
            onClick={run.toggleProgRunPause}
          >
            {run.progRunPaused ? "Продолжить" : "Пауза"}
          </button>
        </>
      ) : null}

      {isAssembly && run.canCopyTheaterFromPreviousScene ? (
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

      {isAssembly && run.canCopyKadrToNext ? (
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

      {isAssembly && run.canAddKadr ? (
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

      {isAssembly && run.canDeleteKadr ? (
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
  );
}
