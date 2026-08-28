import cn from "classnames";
import type { ReactNode } from "react";
import { dialogueTrainerIconProps } from "./dialogueTrainerIconProps";

export type DialogueSceneTrainerChromeProps = {
  allDone: boolean;
  hideUnspokenText: boolean;
  onToggleHideUnspokenText: () => void;
  activeExerciseIndex: number;
  exercisesCount: number;
  left: number;
  onGoPrevMyLine: () => void;
  onGoNextMyLine: () => void;
  onGoNextUndone: () => void;
  storageKey?: string;
  onResetProgressAll: () => void;
  emptyMessage?: string | null;
  children?: ReactNode;
  afterScroll?: ReactNode;
};

export function DialogueSceneTrainerChrome({
  allDone,
  hideUnspokenText,
  onToggleHideUnspokenText,
  activeExerciseIndex,
  exercisesCount,
  left,
  onGoPrevMyLine,
  onGoNextMyLine,
  onGoNextUndone,
  storageKey,
  onResetProgressAll,
  emptyMessage,
  children,
  afterScroll,
}: DialogueSceneTrainerChromeProps) {
  const showEmpty = Boolean(emptyMessage);
  const prevDisabled = activeExerciseIndex <= 0;
  const nextDisabled = activeExerciseIndex >= exercisesCount - 1;
  const nextUndoneDisabled = left === 0;
  const hideUnspokenLabel = hideUnspokenText
    ? "Показать непройденный текст"
    : "Скрыть непройденный текст";

  return (
    <div className="dialogue-trainer" data-all-done={allDone ? "true" : "false"}>
      <div className="dialogue-toolbar">
        <div className="dialogue-toolbar-actions">
          <button
            type="button"
            className={cn("dialogue-icon-btn", hideUnspokenText && "dialogue-icon-btn--primary")}
            onClick={onToggleHideUnspokenText}
            aria-label={hideUnspokenLabel}
            title={hideUnspokenLabel}
            aria-pressed={hideUnspokenText}
          >
            {hideUnspokenText ? (
              <svg {...dialogueTrainerIconProps}>
                <path d="M17.9 17.9A10.9 10.9 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.2-5.7" />
                <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.7 3.8" />
                <path d="M14.1 9.9a3 3 0 0 1-4.2 4.2" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg {...dialogueTrainerIconProps}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="dialogue-icon-btn"
            onClick={onGoPrevMyLine}
            disabled={prevDisabled}
            aria-label="Предыдущая моя реплика"
            title="Предыдущая моя реплика"
          >
            <svg {...dialogueTrainerIconProps}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="dialogue-icon-btn"
            onClick={onGoNextMyLine}
            disabled={nextDisabled}
            aria-label="Следующая моя реплика"
            title="Следующая моя реплика"
          >
            <svg {...dialogueTrainerIconProps}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <button
            type="button"
            className="dialogue-icon-btn dialogue-icon-btn--primary"
            onClick={onGoNextUndone}
            disabled={nextUndoneDisabled}
            aria-label="Следующая непройденная"
            title="Следующая непройденная"
          >
            <svg {...dialogueTrainerIconProps}>
              <path d="M5 12h10" />
              <path d="M13 6l6 6-6 6" />
              <path d="M5 6v12" />
            </svg>
          </button>
          {storageKey ? (
            <button
              type="button"
              className="dialogue-icon-btn dialogue-icon-btn--danger"
              onClick={onResetProgressAll}
              aria-label="Сброс прогресса"
              title="Сброс прогресса"
            >
              <svg {...dialogueTrainerIconProps}>
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="dialogue-scroll">
        {allDone ? (
          <div className="dialogue-finished" role="status">
            <div className="dialogue-finished-title">Все реплики пройдены</div>
            <div className="dialogue-finished-meta">
              Вы успешно собрали все фразы выбранных сцен. Можно пройти ещё раз или сбросить
              прогресс.
            </div>
          </div>
        ) : null}

        {showEmpty ? <div className="dialogue-empty">{emptyMessage}</div> : children}
      </div>

      {afterScroll}
    </div>
  );
}
