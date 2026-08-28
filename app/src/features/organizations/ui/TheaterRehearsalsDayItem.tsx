import cn from "classnames";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { TheaterRehearsal } from "../../../sync/api/workspaces";
import {
  formatTimeHHMM,
  getSessionStartLocalMinutes,
  type DirectorRehearsalSession,
} from "../../director-sessions";
import {
  formatDurationLabel,
  formatMinutesToTime,
  rehearsalProjectsLabel,
  rehearsalSlotPreviews,
  rehearsalSpanMin,
} from "../model/theater-rehearsals-helpers";

type TheaterRehearsalsDayItemProps = {
  rehearsal: TheaterRehearsal;
  bundleSessions: DirectorRehearsalSession[];
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
};

export function TheaterRehearsalsDayItem({
  rehearsal,
  bundleSessions,
  isSelected,
  onSelect,
  onOpen,
}: TheaterRehearsalsDayItemProps) {
  const startMin = getSessionStartLocalMinutes(rehearsal.startsAt);
  const spanMin = rehearsalSpanMin(rehearsal, bundleSessions);
  const timeLabel = `${formatTimeHHMM(startMin)}–${formatMinutesToTime(startMin + spanMin)}`;
  const durationLabel = formatDurationLabel(spanMin);
  const published = Boolean(String(rehearsal.publishedAt ?? "").trim());
  const projectsLabel = rehearsalProjectsLabel(rehearsal);
  const placeLabel = rehearsal.place?.trim() ?? "";
  const slotPreviews = rehearsalSlotPreviews(rehearsal, bundleSessions);
  const commentParts = [projectsLabel, placeLabel].filter(Boolean);
  const commentLabel = commentParts.join(" · ");
  const showEmptySlotsHint =
    slotPreviews.length === 0 && rehearsal.source === "director-session";

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen();
      return;
    }
    if (event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };

  return (
    <div
      className={cn(
        "sessions-day-item",
        isSelected && "sessions-day-item--active",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        className="sessions-day-item__main"
        title="Клик — выбрать · двойной клик — открыть"
        onClick={onSelect}
        onDoubleClick={onOpen}
        onKeyDown={handleKeyDown}
      >
        <span className="sessions-day-item__header">
          <span className="sessions-day-item__time" title={durationLabel}>
            {timeLabel}
          </span>
          <span className="sessions-day-item__header-body">
            <span className="sessions-day-item__title">{rehearsal.title}</span>
            <span className="sessions-day-item__meta">{durationLabel}</span>
          </span>
          <span
            className={cn(
              "sessions-day-item__badge",
              published && "sessions-day-item__badge--published",
            )}
          >
            {published ? "опубликована" : "черновик"}
          </span>
        </span>
        {slotPreviews.length > 0 ? (
          <ul className="sessions-day-item__slots">
            {slotPreviews.map((slot) => (
              <li key={slot.id}>
                <div className="sessions-slot-row">
                  <span className="sessions-slot-row__time">{slot.time}</span>
                  <span
                    className={cn(
                      "sessions-slot-row__label",
                      slot.isProgRun && "sessions-slot-row__label--prog-run",
                    )}
                    title={slot.label}
                  >
                    {slot.label}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {showEmptySlotsHint ? (
          <p className="sessions-day-item__comment rehearsals-muted">
            Слотов пока нет
          </p>
        ) : null}
        {commentLabel ? (
          <div className="sessions-day-item__comment">{commentLabel}</div>
        ) : null}
      </div>
    </div>
  );
}
