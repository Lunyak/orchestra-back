import cn from "classnames";
import { useNotesRunContext } from "../model/notes-run-context";

export function NotesRunMeta() {
  const run = useNotesRunContext();
  const { cards, cardIndex, currentCard, currentSceneMeta } = run;

  if (cards.length === 0) return null;

  const sceneLabel = currentSceneMeta
    ? currentSceneMeta.sceneOrdinal != null
      ? `С${currentSceneMeta.sceneOrdinal} · ${currentSceneMeta.sceneTitle}`
      : currentSceneMeta.sceneTitle
    : "Без сцены";
  const cardTitle = currentCard?.title.trim() || `Карточка ${currentCard?.cardNo ?? cardIndex + 1}`;
  const transition = currentCard?.transitionText?.trim() || "";

  return (
    <div className="notes-run__meta" aria-live="polite">
      <span className="notes-run__meta-scene">{sceneLabel}</span>
      <span className="notes-run__meta-card">{cardTitle}</span>
      {transition ? (
        <span className="notes-run__meta-transition" title={transition}>
          {transition}
        </span>
      ) : null}
    </div>
  );
}

export function NotesRunChromeControls() {
  const run = useNotesRunContext();
  const cardCount = run.cards.length;
  const counterLabel =
    cardCount === 0 ? "0/0" : `${run.cardIndex + 1}/${cardCount}`;

  return (
    <div className="notes-run__chrome-actions" aria-label="Навигация суфлера">
      <div className="notes-run__chrome-nav">
        <button
          type="button"
          className="notes-run__chrome-nav-btn"
          disabled={!run.canGoPrev}
          onClick={run.goPrev}
          title="Предыдущая карточка"
          aria-label="Предыдущая карточка"
        >
          ◀
        </button>
        <button
          type="button"
          className={cn(
            "notes-run__chrome-nav-btn",
            "notes-run__chrome-nav-btn--primary",
          )}
          disabled={!run.canGoNext}
          onClick={run.goNext}
          title="Следующая карточка"
          aria-label="Следующая карточка"
        >
          ▶
        </button>
      </div>

      <span className="notes-run__chrome-counter" aria-live="polite">
        {counterLabel}
      </span>

      <button
        type="button"
        className="notes-run__chrome-btn"
        title="Старт суфлера"
        aria-label="Старт суфлера"
        onClick={run.startRun}
      >
        Старт
      </button>
      <button
        type="button"
        className="notes-run__chrome-btn"
        data-primary={run.paused ? "true" : undefined}
        aria-pressed={run.paused}
        title={run.paused ? "Продолжить" : "Пауза"}
        aria-label={run.paused ? "Продолжить" : "Пауза"}
        onClick={run.togglePause}
        disabled={!run.runActive}
      >
        {run.paused ? "Продолжить" : "Пауза"}
      </button>

      <button
        type="button"
        className="notes-run__chrome-btn notes-run__chrome-btn--icon"
        title="Добавить карточку"
        aria-label="Добавить карточку"
        onClick={run.openCreateModal}
      >
        +
      </button>
      <button
        type="button"
        className="notes-run__chrome-btn notes-run__chrome-btn--icon"
        data-primary="true"
        title="Редактировать карточку"
        aria-label="Редактировать карточку"
        onClick={run.openEditModal}
        disabled={!run.currentCard}
      >
        ✎
      </button>
      <button
        type="button"
        className={cn(
          "notes-run__chrome-btn",
          "notes-run__chrome-btn--icon",
          "notes-run__chrome-btn--danger",
        )}
        title="Удалить карточку"
        aria-label="Удалить карточку"
        onClick={run.deleteCurrentCard}
        disabled={!run.currentCard}
      >
        ×
      </button>
      <button
        type="button"
        className="notes-run__chrome-btn"
        title="Создать карточки по сценам сценария"
        aria-label="Из сцен сценария"
        onClick={run.initFromScenes}
      >
        Из сцен
      </button>
      {run.isProjectorOpen ? (
        <button
          type="button"
          className="notes-run__chrome-btn"
          onClick={run.closeProjector}
        >
          Проектор ✕
        </button>
      ) : (
        <button
          type="button"
          className="notes-run__chrome-btn"
          onClick={run.openProjector}
        >
          Проектор
        </button>
      )}
    </div>
  );
}
