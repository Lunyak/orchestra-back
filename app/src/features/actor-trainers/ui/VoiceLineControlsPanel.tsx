import cn from "classnames";
import React, { useCallback, useRef, useState } from "react";
import type { DialogueLine } from "../model/dialogue";
import type { SpeakErrorInfo } from "../model/voice-trainer-speech";
import type { VoiceExercise } from "../model/voice-trainer-types";
const voiceIconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function VoiceIconButton({
  label,
  title,
  disabled,
  active,
  className,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn("voice-icon-btn", active && "voice-icon-btn--active", className)}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
    >
      {children}
    </button>
  );
}

export type VoiceLineControlsPanelProps = {
  className?: string;
  current: VoiceExercise;
  sentenceTokens: string[][];
  sentenceIndex: number;
  showText: boolean;
  revealedLineIds: Set<string>;
  onToggleRevealLine: () => void;
  currentTarget: string;
  lastAccepted: string;
  supported: { tts: boolean; stt: boolean };
  listening: boolean;
  left: number;
  total: number;
  pttStart: () => void;
  pttStop: () => void;
  beginListeningSession: (opts: { resetTranscript: boolean }) => void;
  autoFlow: boolean;
  autoCycleBusy: boolean;
  runAuto: () => void;
  lastTake: null | { blob: Blob; url: string; durationMs: number };
  playUrl: (url: string, opts?: { label?: string }) => void;
  voiceUpload: { uploading: boolean; error?: string | null };
  projectName: string | null | undefined;
  performerId: string;
  saveLastTakeAsPreferred: () => void | Promise<void>;
  index: number;
  exercisesCount: number;
  onPrev: () => void;
  onNext: () => void;
  myTextNoRemarks: string;
};

export function renderVoiceLineBody(
  line: DialogueLine,
  opts: {
    isActive: boolean;
    isMine: boolean;
    showText: boolean;
    revealedLineIds: Set<string>;
    listening: boolean;
    transcript: string;
    interim: string;
    result: null | { ratio: number; ok: boolean };
    passRatioPercent: number;
  },
) {
  const {
    isActive,
    isMine,
    showText,
    revealedLineIds,
    listening,
    transcript,
    interim,
    result,
    passRatioPercent,
  } = opts;

  if (isActive && isMine && (listening || transcript || interim || result)) {
    return (
      <>
        <div className="voice-text voice-text--live">
          {transcript ? <span>{transcript}</span> : null}
          {interim ? (
            <span className="voice-interim">
              {transcript ? " " : ""}
              {interim}
            </span>
          ) : null}
          {!transcript && !interim && listening ? (
            <span className="voice-interim voice-interim--placeholder">…</span>
          ) : null}
        </div>
        {result ? (
          <div
            className={cn(
              "voice-line-result",
              result.ok ? "voice-line-result--ok" : "voice-line-result--bad",
            )}
          >
            {result.ok ? "Похоже, верно." : `Не совпадает достаточно (нужно ≥${passRatioPercent}%).`} Точность:{" "}
            <b>{Math.round(result.ratio * 100)}%</b>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="voice-text">
      {isMine && !(showText || revealedLineIds.has(line.id)) ? "— текст скрыт —" : line.text}
    </div>
  );
}

const VOICE_LINE_SHEET_DISMISS_PX = 72;
const VOICE_LINE_SHEET_TAP_PX = 6;

export function VoiceLineSheet({
  expanded,
  onExpandedChange,
  children,
}: {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: React.ReactNode;
}) {
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const finishDrag = useCallback(() => {
    const offset = dragOffsetRef.current;
    if (expanded) {
      if (offset >= VOICE_LINE_SHEET_DISMISS_PX) {
        onExpandedChange(false);
      }
    } else if (offset <= -VOICE_LINE_SHEET_DISMISS_PX || Math.abs(offset) < VOICE_LINE_SHEET_TAP_PX) {
      onExpandedChange(true);
    }
    dragStartYRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffsetY(0);
    setDragging(false);
  }, [expanded, onExpandedChange]);

  const onHeadPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = event.clientY;
    dragOffsetRef.current = 0;
    setDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onHeadPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current == null) return;
    const deltaY = event.clientY - dragStartYRef.current;
    const nextOffset = expanded ? Math.max(0, deltaY) : Math.min(0, deltaY);
    dragOffsetRef.current = nextOffset;
    setDragOffsetY(nextOffset);
  };

  const panelStyle = (() => {
    if (dragging && expanded && dragOffsetY > 0) {
      return {
        maxHeight: `max(var(--voice-line-sheet-peek), calc(var(--voice-line-sheet-max) - ${dragOffsetY}px))`,
      } as React.CSSProperties;
    }
    if (dragging && !expanded && dragOffsetY < 0) {
      return {
        maxHeight: `min(var(--voice-line-sheet-max), calc(var(--voice-line-sheet-peek) + ${-dragOffsetY}px))`,
      } as React.CSSProperties;
    }
    return undefined;
  })();

  return (
    <div
      className={cn("voice-line-sheet", !expanded && "voice-line-sheet--collapsed")}
      role="dialog"
      aria-label="Управление репликой"
    >
      <div
        className={cn(
          "voice-line-sheet__panel",
          !expanded && !dragging && dragOffsetY === 0 && "voice-line-sheet__panel--collapsed",
          dragging && "voice-line-sheet__panel--dragging",
        )}
        style={panelStyle}
      >
        <div
          className="voice-line-sheet__header"
          aria-expanded={expanded}
          aria-label={expanded ? "Свернуть панель — потяните вниз" : "Развернуть панель — потяните вверх"}
          onPointerDown={onHeadPointerDown}
          onPointerMove={onHeadPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        />
        <div className="voice-line-sheet__scroll">{children}</div>
      </div>
    </div>
  );
}

export function VoiceLineControlsPanel({
  className,
  current,
  sentenceTokens,
  sentenceIndex,
  showText,
  revealedLineIds,
  onToggleRevealLine,
  currentTarget,
  lastAccepted,
  supported,
  listening,
  left,
  total,
  pttStart,
  pttStop,
  beginListeningSession,
  autoFlow,
  autoCycleBusy,
  runAuto,
  lastTake,
  playUrl,
  voiceUpload,
  projectName,
  performerId,
  saveLastTakeAsPreferred,
  index,
  exercisesCount,
  onPrev,
  onNext,
  myTextNoRemarks,
}: VoiceLineControlsPanelProps) {
  const lineRevealed = Boolean(current.lineId && revealedLineIds.has(current.lineId));
  const showTarget = (showText || lineRevealed) && currentTarget;
  const isSheet = Boolean(className?.includes("voice-panel--sheet"));
  const sttBlocked = !supported.stt || (left === 0 && total > 0);

  const pttButton = (
    <button
      type="button"
      className={cn("voice-btn voice-ptt", isSheet && "voice-ptt--sheet")}
      data-active={listening ? "true" : "false"}
      disabled={sttBlocked}
      onPointerDown={(e) => {
        try {
          (e.currentTarget as HTMLElement & { setPointerCapture?: (id: number) => void })?.setPointerCapture?.(
            e.pointerId,
          );
        } catch {
          /* ignore */
        }
        e.preventDefault();
        pttStart();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        pttStop();
      }}
      onPointerCancel={() => pttStop()}
      title="Нажми и держи — идёт запись. Отпусти — проверим."
    >
      {listening ? "Запись…" : isSheet ? "Удерживайте" : "Нажми и держи"}
    </button>
  );

  const secondaryTools = (
    <>
      <VoiceIconButton
        label="Продолжить запись"
        title="Продолжить без сброса"
        disabled={sttBlocked}
        onClick={() => beginListeningSession({ resetTranscript: false })}
      >
        <svg {...voiceIconProps}>
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
          <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
          <path d="M12 18v3" />
        </svg>
      </VoiceIconButton>
      {autoFlow ? (
        <VoiceIconButton
          label={autoCycleBusy ? "Остановить автоцикл" : "Автоцикл"}
          title={
            autoCycleBusy
              ? "Прервать озвучку и запись"
              : "Озвучить предыдущую и начать запись"
          }
          active={autoCycleBusy}
          disabled={sttBlocked && !autoCycleBusy}
          onClick={runAuto}
        >
          <svg {...voiceIconProps}>
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </VoiceIconButton>
      ) : null}
      {!showText ? (
        <VoiceIconButton
          label={lineRevealed ? "Скрыть реплику" : "Показать реплику"}
          active={lineRevealed}
          onClick={onToggleRevealLine}
        >
          {lineRevealed ? (
            <svg {...voiceIconProps}>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M1 1l22 22" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            </svg>
          ) : (
            <svg {...voiceIconProps}>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </VoiceIconButton>
      ) : null}
      {lastTake ? (
        <>
          <VoiceIconButton
            label="Прослушать дубль"
            onClick={() => playUrl(lastTake.url, { label: "last-take" })}
          >
            <svg {...voiceIconProps}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </VoiceIconButton>
          <VoiceIconButton
            label="Сохранить как удачный дубль"
            disabled={voiceUpload.uploading || !projectName || !performerId}
            onClick={() => void saveLastTakeAsPreferred()}
          >
            <svg {...voiceIconProps}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <path d="M17 21v-8H7v8" />
              <path d="M7 3v5h8" />
            </svg>
          </VoiceIconButton>
        </>
      ) : null}
    </>
  );

  return (
    <div className={cn("voice-panel", className)}>
      {sentenceTokens.length > 1 ? (
        <div className="voice-progress">
          Фраза: <b>{sentenceIndex + 1}</b> / {sentenceTokens.length}
        </div>
      ) : null}
      {showTarget ? (
        <div className="voice-target">
          “{String(currentTarget).slice(0, 160)}
          {String(currentTarget).length > 160 ? "…" : ""}”
        </div>
      ) : null}
      {(showText || lineRevealed) && lastAccepted ? (
        <div className="voice-muted">
          Засчитано: “{String(lastAccepted).slice(0, 120)}
          {String(lastAccepted).length > 120 ? "…" : ""}”
        </div>
      ) : null}

      {isSheet ? (
        <div className="voice-toolbar">
          {pttButton}
          <div className="voice-toolbar__row">
            <VoiceIconButton
              className="voice-icon-btn--nav"
              label="Предыдущая реплика"
              disabled={index <= 0}
              onClick={onPrev}
            >
              <svg {...voiceIconProps} width={16} height={16}>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </VoiceIconButton>
            <div className="voice-toolbar__tools">{secondaryTools}</div>
            <VoiceIconButton
              className="voice-icon-btn--nav"
              label="Следующая реплика"
              disabled={index >= exercisesCount - 1}
              onClick={onNext}
            >
              <svg {...voiceIconProps} width={16} height={16}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </VoiceIconButton>
          </div>
          {voiceUpload.uploading ? (
            <div className="voice-toolbar__status">Сохраняю дубль…</div>
          ) : null}
        </div>
      ) : (
        <div className="voice-actions">
          {pttButton}
          <button
            type="button"
            className="voice-btn"
            disabled={sttBlocked}
            onClick={() => beginListeningSession({ resetTranscript: false })}
            title="Продолжить запись без сброса"
          >
            Продолжить
          </button>
          <button
            type="button"
            className={cn("voice-btn", autoCycleBusy && "voice-btn--primary")}
            disabled={sttBlocked && !autoCycleBusy}
            onClick={runAuto}
            title={
              autoCycleBusy
                ? "Прервать озвучку и запись"
                : "Озвучить предыдущую и начать запись"
            }
          >
            {autoCycleBusy ? "■ цикл" : "▶ цикл"}
          </button>
          {!showText ? (
            <button type="button" className="voice-btn" onClick={onToggleRevealLine}>
              {lineRevealed ? "Скрыть эту реплику" : "Показать эту реплику"}
            </button>
          ) : null}
          {lastTake ? (
            <>
              <button
                type="button"
                className="voice-btn"
                onClick={() => playUrl(lastTake.url, { label: "last-take" })}
                title="Прослушать последнюю запись"
              >
                ▶ дубль
              </button>
              <button
                type="button"
                className="voice-btn"
                disabled={voiceUpload.uploading || !projectName || !performerId}
                onClick={() => void saveLastTakeAsPreferred()}
                title="Сохранить последнюю запись как удачный дубль"
              >
                {voiceUpload.uploading ? "Сохраняю…" : "Сохранить как удачный"}
              </button>
            </>
          ) : null}
          <div className="voice-spacer" />
          <button type="button" className="voice-btn" disabled={index <= 0} onClick={onPrev}>
            ←
          </button>
          <button type="button" className="voice-btn" disabled={index >= exercisesCount - 1} onClick={onNext}>
            →
          </button>
        </div>
      )}

      {showText ? (
        <div className="voice-textbox">
          <div className="voice-text">{myTextNoRemarks || "—"}</div>
        </div>
      ) : null}

      {voiceUpload.error ? (
        <div className="voice-recognition">
          <div className="voice-result bad">{voiceUpload.error}</div>
        </div>
      ) : null}
    </div>
  );
}

