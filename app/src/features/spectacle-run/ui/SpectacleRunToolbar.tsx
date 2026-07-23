import cn from "classnames";
import { formatKadrTransitionForDisplay, parseKadrTransitionRawInSection } from "../model/kadr-section-transition";
import { useSpectacleRunContext } from "../model/spectacle-run-context";

export function SpectacleRunMeta() {
  const run = useSpectacleRunContext();
  const { tape, currentItem } = run;

  if (tape.length === 0) return null;

  return (
    <div className="spectacle-run__meta" aria-live="polite">
      <span className="spectacle-run__meta-scene">
        Сцена {currentItem?.sceneOrdinal ?? "—"}
        {currentItem?.sceneTitle ? ` · ${currentItem.sceneTitle}` : ""}
      </span>
      <span className="spectacle-run__meta-kadr">
        {currentItem?.isPlaceholder
          ? "Нет картин"
          : `Картина ${currentItem?.kadrNo ?? "—"}${currentItem?.headingTitle ? ` · ${currentItem.headingTitle}` : ""}`}
      </span>
    </div>
  );
}

export function SpectacleRunProgRunNav() {
  const run = useSpectacleRunContext();
  const {
    tape,
    tapeIndex,
    currentItem,
    currentScene,
    canGoPrev,
    canGoNext,
    nextLabel,
    progRunPaused,
  } = run;
  const tapeLen = tape.length;

  if (tapeLen === 0) return null;

  const transitionLine =
    currentItem?.section && currentScene && !currentItem.isPlaceholder
      ? formatKadrTransitionForDisplay(
          parseKadrTransitionRawInSection(String(currentScene.markdown ?? ""), currentItem.section),
        )
      : "";

  return (
    <div className="spectacle-run__prog-run-nav" aria-label="Навигация по сценам">
      <div className="spectacle-run__prog-run-nav-transport">
        <button
          type="button"
          className="spectacle-run__prog-run-start-btn"
          onClick={run.startProgRun}
        >
          Старт
        </button>
        <button
          type="button"
          className="spectacle-run__prog-run-pause-btn"
          data-paused={progRunPaused ? "true" : undefined}
          aria-pressed={progRunPaused}
          onClick={run.toggleProgRunPause}
        >
          {progRunPaused ? "Продолжить" : "Пауза"}
        </button>
      </div>
      <div className="spectacle-run__prog-run-nav-center" aria-live="polite">
        {transitionLine ? (
          <span className="spectacle-run__prog-run-nav-kadr" title={transitionLine}>
            {transitionLine}
          </span>
        ) : null}
        <div className="spectacle-run__prog-run-nav-meta">
          <span className="spectacle-run__prog-run-nav-counter">
            {tapeIndex + 1} / {tapeLen}
          </span>
        </div>
      </div>
      <div className="spectacle-run__prog-run-nav-scene">
        <button
          type="button"
          className="spectacle-run__prog-run-nav-btn"
          disabled={!canGoPrev}
          onClick={run.goPrev}
        >
          ◀ Назад
        </button>
        <button
          type="button"
          className={cn(
            "spectacle-run__prog-run-nav-btn",
            "spectacle-run__prog-run-nav-btn--forward",
            canGoNext && "spectacle-run__prog-run-nav-btn--primary",
          )}
          disabled={!canGoNext}
          onClick={run.goNext}
        >
          {nextLabel} ▶
        </button>
      </div>
    </div>
  );
}

export function SpectacleRunProgRunToolbar() {
  const run = useSpectacleRunContext();
  const { tape } = run;

  if (tape.length === 0 || !run.canEditKadr) return null;

  return (
    <div className="spectacle-run__toolbar-actions" aria-label="Управление прогоном">
      <button
        type="button"
        className="spectacle-run__add-kadr-btn"
        data-primary="true"
        title="Редактировать выбранную картину"
        onClick={run.editCurrentKadr}
      >
        Редактировать
      </button>
    </div>
  );
}

export function SpectacleRunToolbarActions() {
  const run = useSpectacleRunContext();
  const { tape, tapeIndex } = run;
  const tapeLen = tape.length;

  if (tapeLen === 0) return null;

  return (
    <div className="spectacle-run__toolbar-actions" aria-label="Навигация спектакля">
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

      <span className="spectacle-run__tape-counter" aria-live="polite">
        {tapeIndex + 1} / {tapeLen}
      </span>

      {run.canCopyTheaterFromPreviousScene ? (
        <button
          type="button"
          className="spectacle-run__add-kadr-btn spectacle-run__add-kadr-btn--copy-scene"
          title="Скопировать мебель, декор, софиты и реквизит с предыдущей сцены"
          onClick={run.copyTheaterFromPreviousScene}
        >
          ← пред. сцена
        </button>
      ) : null}

      {run.canAddKadr ? (
        <button
          type="button"
          className="spectacle-run__add-kadr-btn"
          title={
            run.currentItem?.isPlaceholder
              ? "Добавить первую картину в сцену"
              : `Вставить картину ${run.nextKadrNo} после текущей`
          }
          onClick={run.addKadrToCurrentScene}
        >
          + Картина {run.nextKadrNo}
        </button>
      ) : null}

      {run.canEditKadr ? (
        <button
          type="button"
          className="spectacle-run__add-kadr-btn"
          data-primary="true"
          title="Редактировать выбранную картину"
          onClick={run.editCurrentKadr}
        >
          Редактировать
        </button>
      ) : null}

      {run.canDeleteKadr ? (
        <button
          type="button"
          className="spectacle-run__add-kadr-btn spectacle-run__add-kadr-btn--danger"
          title="Удалить текущую картину и перенумеровать остальные в сцене"
          onClick={run.deleteCurrentKadr}
        >
          Удалить картину
        </button>
      ) : null}
    </div>
  );
}
