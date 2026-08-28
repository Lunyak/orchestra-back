import { Modal } from "@shared/core/modal/Modal";
import cn from "classnames";
import type { ReactNode } from "react";
import type { DirectorSessionSlot } from "../directorSessionsSync";
import { durationPartsFromMin } from "../model/session-page-utils";
import type { SlotDraftEntry } from "../model/useDirectorSessionSlotsPanel";

type DirectorSessionSlotSettingsModalProps = {
  slot: DirectorSessionSlot;
  draft: SlotDraftEntry | undefined;
  startsAtFallbackTime: string;
  busyConflictError: string | null;
  slotSettings: ReactNode;
  onClose: () => void;
  onPatchDraft: (patch: Partial<SlotDraftEntry>) => void;
  onCommitDraft: () => void;
};

export function DirectorSessionSlotSettingsModal({
  slot,
  draft,
  startsAtFallbackTime,
  busyConflictError,
  slotSettings,
  onClose,
  onPatchDraft,
  onCommitDraft,
}: DirectorSessionSlotSettingsModalProps) {
  const fallbackParts = durationPartsFromMin(slot.durationMin ?? 30);
  const timeValue = draft?.time ?? startsAtFallbackTime;
  const hoursValue = draft?.durationHours ?? String(fallbackParts.hours);
  const minutesValue =
    draft?.durationMinutes ?? String(fallbackParts.minutes);

  return (
    <Modal
      isOpen
      onClose={onClose}
      panelClassName="director-session-slot-modal"
      ariaLabel="Параметры слота"
    >
      <div className="director-session-slot-modal__body">
        {busyConflictError ? (
          <div
            className="director-session-slots-panel__busy-error director-session-slots-panel__busy-error--modal"
            role="alert"
          >
            <p className="director-session-slots-panel__busy-error-text">
              {busyConflictError}
            </p>
          </div>
        ) : null}
        <div
          className={cn(
            "sessions-slot-controls",
            "director-session-slots-panel__controls",
            "director-session-slot-modal__time-row",
          )}
        >
          <input
            type="time"
            className="director-session-slot-modal__textlike"
            aria-label="Время начала слота"
            value={timeValue}
            onChange={(e) => onPatchDraft({ time: e.target.value })}
            onBlur={onCommitDraft}
          />
          <span className="director-session-slot-modal__duration-container">
            <input
              type="number"
              min={0}
              max={8}
              className={cn(
                "director-session-slot-modal__textlike",
                "director-session-slot-modal__textlike--duration",
                "director-session-slot-modal__textlike--duration-hours",
              )}
              aria-label="Длительность слота, часы"
              value={hoursValue}
              onChange={(e) => onPatchDraft({ durationHours: e.target.value })}
              onBlur={onCommitDraft}
            />
            <span className="director-session-slot-modal__duration-suffix">
              ч
            </span>
            <input
              type="number"
              min={0}
              max={59}
              className={cn(
                "director-session-slot-modal__textlike",
                "director-session-slot-modal__textlike--duration",
                "director-session-slot-modal__textlike--duration-minutes",
              )}
              aria-label="Длительность слота, минуты"
              value={minutesValue}
              onChange={(e) =>
                onPatchDraft({ durationMinutes: e.target.value })
              }
              onBlur={onCommitDraft}
            />
            <span className="director-session-slot-modal__duration-suffix">
              мин
            </span>
          </span>
          <button
            type="button"
            className="director-session-slot-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        {slotSettings ? (
          <div className="director-session-slots-panel__slot-settings">
            {slotSettings}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
