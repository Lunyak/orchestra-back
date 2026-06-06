import cn from "classnames";
import { parseKadrTitleFromHeading } from "../model/create-kadr-from-draft";
import { formatKadrTransitionForDisplay, parseKadrTransitionRawInSection } from "../model/kadr-section-transition";
import { useSpectacleRunContext } from "../model/spectacle-run-context";

export function SpectacleRunMeta() {
  const run = useSpectacleRunContext();
  const { tape, currentItem } = run;

  if (tape.length === 0) return null;

  return (
    <div className="spectacle-run__meta" aria-live="polite">
      <span className="spectacle-run__meta-step">
        Шаг {currentItem?.stepOrdinal ?? "—"}
        {currentItem?.stepTitle ? ` · ${currentItem.stepTitle}` : ""}
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
  const { tape, tapeIndex, currentItem, currentStep, canGoPrev, canGoNext, nextLabel } = run;
  const tapeLen = tape.length;

  if (tapeLen === 0) return null;

  const stepOrdinal = currentItem?.stepOrdinal ?? "—";
  const stepTitle = currentItem?.stepTitle?.trim() ?? "";
  const stepLine = stepTitle ? `Шаг ${stepOrdinal} · ${stepTitle}` : `Шаг ${stepOrdinal}`;
  const kadrNo = currentItem?.kadrNo;
  const kadrTitle =
    currentItem && !currentItem.isPlaceholder && kadrNo != null
      ? parseKadrTitleFromHeading(currentItem.headingTitle ?? "", kadrNo)
      : "";
  const kadrLine = currentItem?.isPlaceholder
    ? "Нет картин"
    : kadrTitle
      ? `К${kadrNo} · ${kadrTitle}`
      : `К${kadrNo ?? "—"}`;
  const transitionLine =
    currentItem?.section && currentStep && !currentItem.isPlaceholder
      ? formatKadrTransitionForDisplay(
          parseKadrTransitionRawInSection(String(currentStep.markdown ?? ""), currentItem.section),
        )
      : "";

  return (
    <div className="spectacle-run__prog-run-nav" aria-label="Навигация по шагам">
      <button
        type="button"
        className="spectacle-run__prog-run-nav-btn"
        disabled={!canGoPrev}
        onClick={run.goPrev}
      >
        ◀ Назад
      </button>
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
  );
}

export function SpectacleRunProgRunToolbar() {
  const run = useSpectacleRunContext();
  const { tape, tapeIndex, progRunPaused } = run;
  const tapeLen = tape.length;

  if (tapeLen === 0) return null;

  return (
    <div className="spectacle-run__toolbar-actions" aria-label="Управление прогоном">
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
      <span className="spectacle-run__tape-counter" aria-live="polite">
        {tapeIndex + 1} / {tapeLen}
      </span>
    </div>
  );
}

export function SpectacleRunToolbarActions() {
  const run = useSpectacleRunContext();
  const { tape, tapeIndex } = run;
  const tapeLen = tape.length;

  if (tapeLen === 0) return null;

  return (
    <div className="spectacle-run__toolbar-actions" aria-label="Навигация репетиции">
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

      {run.canAddKadr ? (
        <button
          type="button"
          className="spectacle-run__add-kadr-btn"
          title={
            run.currentItem?.isPlaceholder
              ? "Добавить первую картину в шаг"
              : `Вставить картину ${run.nextKadrNo} после текущей`
          }
          onClick={run.addKadrToCurrentStep}
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
          title="Удалить текущую картину и перенумеровать остальные в шаге"
          onClick={run.deleteCurrentKadr}
        >
          Удалить картину
        </button>
      ) : null}
    </div>
  );
}
