import { Buttons } from "@shared/components/buttons/Buttons";
import { ListItem } from "@shared/components/list-item/ListItem";
import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import type { DragEvent, PointerEvent } from "react";
import type { DirectorSessionSlot } from "../directorSessionsSync";
import type { DirectorSessionSlotDisplay } from "../model/useDirectorSessionSlotsPanel";

type DirectorSessionSlotRowProps = {
  slot: DirectorSessionSlot;
  display: DirectorSessionSlotDisplay;
  slotTime: string;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  dropHintLabel: string | null;
  toneClassName?: string;
  onSelect: () => void;
  onRemove: () => void;
  onDragHandlePointerDown: (e: PointerEvent<HTMLElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
};

export function DirectorSessionSlotRow({
  slot,
  display,
  slotTime,
  isSelected,
  isDragging,
  isDropTarget,
  dropHintLabel,
  toneClassName,
  onSelect,
  onRemove,
  onDragHandlePointerDown,
  onDragOver,
  onDrop,
}: DirectorSessionSlotRowProps) {
  const notes = String(slot.notes ?? "").trim();

  return (
    <div
      data-session-slot-id={slot.id}
      className={cn(
        "director-session-slots-panel__row",
        isSelected && "director-session-slots-panel__row--active",
        isDropTarget && "director-session-slots-panel__row--drop-target",
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ListItem
        className={cn(
          "session-slot",
          isSelected && "session-slot--active",
          isDragging && "session-slot--dragging",
          toneClassName,
        )}
      >
        <span
          className="director-session-slots-panel__drag"
          title="Перетащи, чтобы изменить порядок"
          role="presentation"
          onPointerDown={onDragHandlePointerDown}
        >
          ⋮⋮
        </span>
        <Button
          type="button"
          className="rehearsals-item director-session-slots-panel__slot-main"
          onClick={onSelect}
        >
          <div className="sessions-slot-head">
            <div className="sessions-slot-head__left">
              <div className="sessions-slot-title" title={slotTime}>
                <span
                  className="director-session-slots-panel__status-dot"
                  aria-hidden="true"
                />
                <span className="sessions-slot-title__text">{slotTime}</span>
              </div>
              {display.projectLabel ? (
                <div
                  className={cn(
                    "sessions-slot-meta",
                    display.isProgRun && "sessions-slot-meta--prog-run",
                  )}
                  title={display.projectLabel}
                >
                  {display.projectLabel}
                </div>
              ) : null}
            </div>
            <div className="sessions-slot-head__right">
              {display.materialLabel ? (
                <div
                  className="sessions-slot-project"
                  title={display.materialLabel}
                >
                  {display.materialLabel}
                </div>
              ) : null}
              <Buttons.DeleteButton
                type="button"
                className="sessions-slot-title__btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              />
            </div>
          </div>
          {notes ? (
            <div className="sessions-slot-notes" title={notes}>
              {notes}
            </div>
          ) : null}
        </Button>
      </ListItem>
      {dropHintLabel ? (
        <div className="director-session-slots-panel__drop-hint">
          {dropHintLabel}
        </div>
      ) : null}
    </div>
  );
}
