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

      {run.canRecordLight ? (
        <button
          type="button"
          className="spectacle-run__add-kadr-btn"
          data-primary="true"
          title="Записать в картину программу (P) и уровни фейдеров (F) с пульта ниже"
          onClick={run.recordLightToCurrentKadr}
        >
          Записать свет
        </button>
      ) : null}

      {run.canRecordSound ? (
        <button
          type="button"
          className="spectacle-run__add-kadr-btn"
          title="Записать в картину текущий трек плейлиста (включите трек в плеере)"
          onClick={run.recordSoundToCurrentKadr}
        >
          Записать звук
        </button>
      ) : null}

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
    </div>
  );
}
