import cn from "classnames";
import type { DirectorSessionSlotsPanelViewModel } from "../model/useDirectorSessionSlotsPanel";
import { DirectorSessionSlotRow } from "./DirectorSessionSlotRow";

type DirectorSessionSlotsListProps = {
  vm: DirectorSessionSlotsPanelViewModel;
};

export function DirectorSessionSlotsList({ vm }: DirectorSessionSlotsListProps) {
  const {
    sortedSlots,
    selectedSlotId,
    draggedSlotId,
    draggedSlotIndex,
    touchDragOverSlotId,
    timelineDragOver,
    slotToneClassById,
    draggedSlotForTouchPreview,
    draggedSlotDisplay,
    touchDragPreviewRef,
    getSlotDisplay,
    formatSlotTime,
    onSelectSlot,
    removeSlot,
    beginTouchSlotDrag,
    handleTimelineDragEnter,
    handleTimelineDragLeave,
    handleTimelineDragOver,
    handleTimelineDrop,
    handleSlotRowDragOver,
    handleSlotRowDrop,
  } = vm;

  const hasNoSlots = sortedSlots.length === 0;

  return (
    <>
      <div
        className={cn(
          "sessions-slots",
          "director-session-slots-panel__timeline",
          timelineDragOver && "sessions-slots--drop-active",
        )}
        onDragEnter={handleTimelineDragEnter}
        onDragLeave={handleTimelineDragLeave}
        onDragOver={handleTimelineDragOver}
        onDrop={handleTimelineDrop}
        title="Сюда можно перетащить картину или сцену — появится новый слот с материалом"
      >
        {hasNoSlots ? (
          <div className="sessions-slots-empty rehearsals-muted">
            Слотов нет — нажми «+» или перетащи картину/сцену сюда.
          </div>
        ) : null}
        {sortedSlots.map((sl) => {
          const display = getSlotDisplay(sl);
          const slotTime = formatSlotTime(sl.offsetMin);
          const targetSlotIndex = sortedSlots.findIndex(
            (slot) => slot.id === sl.id,
          );
          const isDropTarget = touchDragOverSlotId === sl.id;
          const isDropInsertAfter =
            isDropTarget &&
            draggedSlotIndex !== -1 &&
            draggedSlotIndex < targetSlotIndex;
          const dropHintLabel = isDropTarget
            ? isDropInsertAfter
              ? "Вставить после этого слота"
              : "Вставить перед этим слотом"
            : null;

          return (
            <DirectorSessionSlotRow
              key={sl.id}
              slot={sl}
              display={display}
              slotTime={slotTime}
              isSelected={sl.id === selectedSlotId}
              isDragging={draggedSlotId === sl.id}
              isDropTarget={isDropTarget}
              dropHintLabel={dropHintLabel}
              toneClassName={slotToneClassById?.get(sl.id)}
              onSelect={() => onSelectSlot(sl.id)}
              onRemove={() => void removeSlot(sl.id)}
              onDragHandlePointerDown={(e) => beginTouchSlotDrag(sl.id, e)}
              onDragOver={handleSlotRowDragOver}
              onDrop={(e) => handleSlotRowDrop(sl.id, e)}
            />
          );
        })}
      </div>
      {draggedSlotForTouchPreview ? (
        <div
          ref={touchDragPreviewRef}
          className={cn(
            "director-session-slots-panel__touch-preview",
            slotToneClassById?.get(draggedSlotForTouchPreview.id),
          )}
          aria-hidden="true"
        >
          <span className="director-session-slots-panel__drag">⋮⋮</span>
          <div className="director-session-slots-panel__touch-preview-main">
            <div className="sessions-slot-head">
              <div className="sessions-slot-head__left">
                <div
                  className="sessions-slot-title"
                  title={formatSlotTime(draggedSlotForTouchPreview.offsetMin)}
                >
                  <span className="director-session-slots-panel__status-dot" />
                  <span className="sessions-slot-title__text">
                    {formatSlotTime(draggedSlotForTouchPreview.offsetMin)}
                  </span>
                </div>
                {draggedSlotDisplay?.projectLabel ? (
                  <div
                    className={cn(
                      "sessions-slot-meta",
                      draggedSlotDisplay.isProgRun &&
                        "sessions-slot-meta--prog-run",
                    )}
                    title={draggedSlotDisplay.projectLabel}
                  >
                    {draggedSlotDisplay.projectLabel}
                  </div>
                ) : null}
              </div>
              {draggedSlotDisplay?.materialLabel ? (
                <div className="sessions-slot-head__right">
                  <div
                    className="sessions-slot-project"
                    title={draggedSlotDisplay.materialLabel}
                  >
                    {draggedSlotDisplay.materialLabel}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
