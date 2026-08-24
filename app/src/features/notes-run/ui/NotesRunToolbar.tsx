import cn from "classnames";
import { useCompactKadrStrip } from "@shared/hooks/useCompactKadrStrip";
import { useNotesRunContext } from "../model/notes-run-context";

export function NotesRunMeta() {
  const run = useNotesRunContext();
  const compactStrip = useCompactKadrStrip();
  const { cards, currentCard } = run;

  if (cards.length === 0 || compactStrip) return null;

  const transition = currentCard?.transitionText?.trim() || "";
  if (!transition) return null;

  return (
    <div className="notes-run__meta" aria-live="polite">
      <span className="notes-run__meta-transition" title={transition}>
        {transition}
      </span>
    </div>
  );
}

export function NotesRunChromeControls() {
  const run = useNotesRunContext();
  const compactStrip = useCompactKadrStrip();
  const cardCount = run.cards.length;
  const counterLabel =
    cardCount === 0 ? "0/0" : `${run.cardIndex + 1}/${cardCount}`;
  const pauseLabel = run.paused ? "▶" : "⏸";

  if (cardCount === 0) return null;

  return (
    <div
      className={cn(
        "spectacle-run__toolbar-actions",
        compactStrip && "spectacle-run__toolbar-actions--compact",
      )}
      aria-label="Навигация суфлера"
    >
      <div
        className="spectacle-run__toolbar-row spectacle-run__toolbar-row--playback"
        role="group"
        aria-label="Управление суфлёром"
      >
        <div className="spectacle-run__nav">
          <button
            type="button"
            className="spectacle-run__nav-btn spectacle-run__nav-btn--icon"
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
              "spectacle-run__nav-btn",
              "spectacle-run__nav-btn--icon",
              "spectacle-run__nav-btn--primary",
            )}
            disabled={!run.canGoNext}
            onClick={run.goNext}
            title="Следующая карточка"
            aria-label="Следующая карточка"
          >
            ▶
          </button>
        </div>

        <span className="spectacle-run__tape-counter" aria-live="polite">
          {counterLabel}
        </span>

        <button
          type="button"
          className={cn(
            "spectacle-run__add-kadr-btn",
            compactStrip && "spectacle-run__add-kadr-btn--icon",
          )}
          title="Старт суфлера"
          aria-label="Старт суфлера"
          onClick={run.startRun}
        >
          {compactStrip ? "▶" : "Старт"}
        </button>
        <button
          type="button"
          className={cn(
            "spectacle-run__add-kadr-btn",
            compactStrip && "spectacle-run__add-kadr-btn--icon",
          )}
          data-primary={run.paused ? "true" : undefined}
          aria-pressed={run.paused}
          title={run.paused ? "Продолжить" : "Пауза"}
          aria-label={run.paused ? "Продолжить" : "Пауза"}
          onClick={run.togglePause}
          disabled={!run.runActive}
        >
          {compactStrip ? pauseLabel : run.paused ? "Продолжить" : "Пауза"}
        </button>
      </div>

      <div
        className="spectacle-run__toolbar-row spectacle-run__toolbar-row--cards"
        role="group"
        aria-label="Карточки и проектор"
      >
        <button
          type="button"
          className="spectacle-run__add-kadr-btn spectacle-run__add-kadr-btn--icon"
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
          className="spectacle-run__add-kadr-btn spectacle-run__add-kadr-btn--icon"
          title="Добавить карточку"
          aria-label="Добавить карточку"
          onClick={run.openCreateModal}
        >
          +
        </button>
        <button
          type="button"
          className={cn(
            "spectacle-run__add-kadr-btn",
            "spectacle-run__add-kadr-btn--icon",
            "spectacle-run__add-kadr-btn--danger",
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
          className={cn(
            "spectacle-run__add-kadr-btn",
            compactStrip && "spectacle-run__add-kadr-btn--icon",
          )}
          title="Создать карточки по сценам сценария"
          aria-label="Из сцен сценария"
          onClick={run.initFromScenes}
        >
          {compactStrip ? "⊞" : "Из сцен"}
        </button>
        {run.isProjectorOpen ? (
          <button
            type="button"
            className={cn(
              "spectacle-run__add-kadr-btn",
              compactStrip && "spectacle-run__add-kadr-btn--icon",
            )}
            data-primary="true"
            title="Закрыть проектор"
            aria-label="Закрыть проектор"
            aria-pressed={true}
            onClick={run.closeProjector}
          >
            ⛶
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "spectacle-run__add-kadr-btn",
              compactStrip && "spectacle-run__add-kadr-btn--icon",
            )}
            title="Открыть проектор"
            aria-label="Открыть проектор"
            onClick={run.openProjector}
          >
            ⛶
          </button>
        )}
      </div>
    </div>
  );
}
