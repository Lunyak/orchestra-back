import { Modal } from "@shared/core/modal/Modal";
import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import "./theater-create-rehearsal-modal.css";

type TheaterCreateRehearsalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  dateLabel: string;
  title: string;
  onTitleChange: (title: string) => void;
  createTime: string;
  timeStepMin: number;
  onCreateTimeChange: (time: string) => void;
  createError: string;
  creating: boolean;
  canSubmit: boolean;
  createTimeTaken: boolean;
  onConfirm: () => void;
};

function parseTimeToMinutes(time: string): number | null {
  const match = String(time ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMin: number): string {
  const dayMinutes = 24 * 60;
  const normalized = ((Math.floor(totalMin) % dayMinutes) + dayMinutes) % dayMinutes;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function shiftCreateTime(time: string, deltaMin: number, stepMin: number): string {
  const current = parseTimeToMinutes(time) ?? 20 * 60;
  const step = Math.max(1, Math.trunc(stepMin) || 1);
  const next = current + deltaMin;
  const snapped = Math.round(next / step) * step;
  return formatMinutesToTime(snapped);
}

function normalizeTimeParts(hoursRaw: string, minutesRaw: string): string {
  let hours = Math.trunc(Number(hoursRaw));
  let minutes = Math.trunc(Number(minutesRaw));
  if (!Number.isFinite(hours)) hours = 0;
  if (!Number.isFinite(minutes)) minutes = 0;
  hours = Math.max(0, Math.min(23, hours));
  minutes = Math.max(0, Math.min(59, minutes));
  return formatMinutesToTime(hours * 60 + minutes);
}

function splitTime(time: string): { hours: string; minutes: string } {
  const parts = String(time).split(":");
  return {
    hours: (parts[0] ?? "20").padStart(2, "0"),
    minutes: (parts[1] ?? "00").padStart(2, "0"),
  };
}

export function TheaterCreateRehearsalModal({
  isOpen,
  onClose,
  mode,
  dateLabel,
  title,
  onTitleChange,
  createTime,
  timeStepMin,
  onCreateTimeChange,
  createError,
  creating,
  canSubmit,
  createTimeTaken,
  onConfirm,
}: TheaterCreateRehearsalModalProps) {
  const isEdit = mode === "edit";
  const hoursInputRef = useRef<HTMLInputElement | null>(null);
  const minutesInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const split = splitTime(createTime);
  const [hoursDraft, setHoursDraft] = useState(split.hours);
  const [minutesDraft, setMinutesDraft] = useState(split.minutes);

  useEffect(() => {
    if (!isOpen) return;
    const next = splitTime(createTime);
    setHoursDraft(next.hours);
    setMinutesDraft(next.minutes);
  }, [createTime, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => {
      if (isEdit) {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
        return;
      }
      hoursInputRef.current?.focus();
      hoursInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isEdit, isOpen]);

  const heading = isEdit ? "Редактировать репетицию" : "Новая репетиция";
  const submitLabel = creating
    ? isEdit
      ? "Сохранение…"
      : "Создание…"
    : isEdit
      ? "Сохранить"
      : "ОК";
  const confirmTitle = createTimeTaken
    ? `Время ${createTime} пересекается с занятым интервалом`
    : isEdit
      ? `Сохранить репетицию на ${dateLabel}, ${createTime}`
      : `Создать репетицию на ${dateLabel}, ${createTime}`;

  const commitDrafts = (hoursValue: string, minutesValue: string) => {
    const next = normalizeTimeParts(hoursValue, minutesValue);
    const normalized = splitTime(next);
    setHoursDraft(normalized.hours);
    setMinutesDraft(normalized.minutes);
    if (next !== createTime) onCreateTimeChange(next);
    return normalized;
  };

  const stepBack = () => {
    onCreateTimeChange(shiftCreateTime(createTime, -timeStepMin, timeStepMin));
  };

  const stepForward = () => {
    onCreateTimeChange(shiftCreateTime(createTime, timeStepMin, timeStepMin));
  };

  const onTimeKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
    field: "hours" | "minutes",
  ) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      stepForward();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      stepBack();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hoursValue = hoursInputRef.current?.value ?? hoursDraft;
      const minutesValue = minutesInputRef.current?.value ?? minutesDraft;
      commitDrafts(hoursValue, minutesValue);
      if (canSubmit) onConfirm();
      return;
    }
    if (event.key === ":" && field === "hours") {
      event.preventDefault();
      commitDrafts(event.currentTarget.value, minutesInputRef.current?.value ?? minutesDraft);
      minutesInputRef.current?.focus();
      minutesInputRef.current?.select();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="theater-create-rehearsal-modal"
      ariaLabelledBy="theater-create-rehearsal-modal-title"
    >
      <div className="theater-create-rehearsal-modal__body">
        <h2
          id="theater-create-rehearsal-modal-title"
          className="theater-create-rehearsal-modal__title"
        >
          {heading}
        </h2>
        <p className="theater-create-rehearsal-modal__date rehearsals-muted">
          {dateLabel}
        </p>

        {isEdit ? (
          <label
            className="theater-create-rehearsal-modal__field"
            htmlFor="theater-edit-rehearsal-title"
          >
            <span className="theater-create-rehearsal-modal__time-label">
              Название
            </span>
            <input
              ref={titleInputRef}
              id="theater-edit-rehearsal-title"
              className={cn(
                "theater-create-rehearsal-modal__title-input",
                "native-text-input",
              )}
              value={title}
              maxLength={120}
              disabled={creating}
              onChange={(event) => onTitleChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (canSubmit) onConfirm();
              }}
            />
          </label>
        ) : null}

        <div className="theater-create-rehearsal-modal__time">
          <span
            className="theater-create-rehearsal-modal__time-label"
            id="theater-create-rehearsal-time-label"
          >
            Время
          </span>
          <div
            className={cn(
              "theater-create-rehearsal-modal__time-control",
              createTimeTaken && "theater-create-rehearsal-modal__time-control--conflict",
            )}
            role="group"
            aria-labelledby="theater-create-rehearsal-time-label"
          >
            <input
              ref={hoursInputRef}
              className="theater-create-rehearsal-modal__time-digits"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={hoursDraft}
              disabled={creating}
              aria-label="Часы"
              onChange={(event) => {
                const next = event.currentTarget.value.replace(/\D/g, "").slice(0, 2);
                setHoursDraft(next);
                if (next.length < 2) return;
                const minutesValue = minutesInputRef.current?.value ?? minutesDraft;
                commitDrafts(next, minutesValue);
                window.requestAnimationFrame(() => {
                  minutesInputRef.current?.focus();
                  minutesInputRef.current?.select();
                });
              }}
              onBlur={(event) => {
                const minutesValue = minutesInputRef.current?.value ?? minutesDraft;
                commitDrafts(event.currentTarget.value, minutesValue);
              }}
              onKeyDown={(event) => onTimeKeyDown(event, "hours")}
              onFocus={(event) => event.currentTarget.select()}
            />
            <span className="theater-create-rehearsal-modal__time-sep" aria-hidden>
              :
            </span>
            <input
              ref={minutesInputRef}
              className="theater-create-rehearsal-modal__time-digits"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={minutesDraft}
              disabled={creating}
              aria-label="Минуты"
              onChange={(event) => {
                const next = event.currentTarget.value.replace(/\D/g, "").slice(0, 2);
                setMinutesDraft(next);
              }}
              onBlur={(event) => {
                const hoursValue = hoursInputRef.current?.value ?? hoursDraft;
                commitDrafts(hoursValue, event.currentTarget.value);
              }}
              onKeyDown={(event) => onTimeKeyDown(event, "minutes")}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
          <span className="theater-create-rehearsal-modal__time-hint rehearsals-muted">
            Tab / ↑↓ · Enter — ОК
          </span>
        </div>

        {createError ? (
          <div className="rehearsals-error" role="alert">
            {createError}
          </div>
        ) : null}
        <div className="theater-create-rehearsal-modal__actions">
          <Button type="button" onClick={onClose} disabled={creating}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!canSubmit}
            title={confirmTitle}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
