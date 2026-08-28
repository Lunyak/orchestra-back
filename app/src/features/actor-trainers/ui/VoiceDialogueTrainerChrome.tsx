import cn from "classnames";
import type { ReactNode } from "react";
import { voiceTrainerIconProps } from "./voiceTrainerIconProps";

export type VoiceDialogueTrainerChromeProps = {
  allDone: boolean;
  hideUnspokenText: boolean;
  onToggleHideUnspokenText: () => void;
  index: number;
  exercisesCount: number;
  left: number;
  onGoPrevMyLine: () => void;
  onGoNextMyLine: () => void;
  onGoNextUndone: () => void;
  storageKey?: string;
  onResetProgressAll: () => void;
  sttSupported: boolean;
  micError: string | null;
  settingsOpen: boolean;
  allDoneDialog: boolean;
  total: number;
  onFinishAllDone: () => void;
  onRestartAllDone: () => void;
  /** When set, renders dialogue-empty instead of children inside dialogue-scroll */
  emptyMessage?: string | null;
  children?: ReactNode;
  /** Dock / script strip / footer — siblings after dialogue-scroll */
  afterScroll?: ReactNode;
};

export function VoiceDialogueTrainerChrome({
  allDone,
  hideUnspokenText,
  onToggleHideUnspokenText,
  index,
  exercisesCount,
  left,
  onGoPrevMyLine,
  onGoNextMyLine,
  onGoNextUndone,
  storageKey,
  onResetProgressAll,
  sttSupported,
  micError,
  settingsOpen,
  allDoneDialog,
  total,
  onFinishAllDone,
  onRestartAllDone,
  emptyMessage,
  children,
  afterScroll,
}: VoiceDialogueTrainerChromeProps) {
  const showFinished = allDoneDialog && total > 0;
  const showEmpty = Boolean(emptyMessage);
  const prevDisabled = index <= 0;
  const nextDisabled = index >= exercisesCount - 1;
  const nextUndoneDisabled = left === 0;
  const hideUnspokenLabel = hideUnspokenText
    ? "Показать непройденный текст"
    : "Скрыть непройденный текст";
  const showMicWarn = sttSupported && Boolean(micError) && !settingsOpen;

  return (
    <div
      className={cn("dialogue-trainer", "voice-trainer")}
      data-all-done={allDone ? "true" : "false"}
    >
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
              <svg {...voiceTrainerIconProps}>
                <path d="M17.9 17.9A10.9 10.9 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.2-5.7" />
                <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.7 3.8" />
                <path d="M14.1 9.9a3 3 0 0 1-4.2 4.2" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg {...voiceTrainerIconProps}>
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
            <svg {...voiceTrainerIconProps}>
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
            <svg {...voiceTrainerIconProps}>
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
            <svg {...voiceTrainerIconProps}>
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
              <svg {...voiceTrainerIconProps}>
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {!sttSupported ? (
        <div className="voice-warn">
          На этой платформе нет поддержки распознавания речи (SpeechRecognition). Попробуйте Chrome
          или Edge.
        </div>
      ) : null}
      {showMicWarn ? <div className="voice-warn">{micError}</div> : null}

      <div className="dialogue-scroll">
        {showFinished ? (
          <div className="dialogue-finished" role="status">
            <div className="dialogue-finished-title">Вы повторили весь текст.</div>
            <div className="dialogue-finished-meta">
              Можно закончить или пройти блок ещё раз.
            </div>
            <div className="voice-actions">
              <button type="button" className="voice-btn" onClick={onFinishAllDone}>
                Закончить
              </button>
              <button
                type="button"
                className="voice-btn voice-btn--primary"
                onClick={onRestartAllDone}
              >
                Начать заново
              </button>
            </div>
          </div>
        ) : null}

        {showEmpty ? (
          <div className="dialogue-empty">{emptyMessage}</div>
        ) : (
          children
        )}
      </div>

      {afterScroll}
    </div>
  );
}
