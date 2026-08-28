import cn from "classnames";
import React from "react";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { calledStatusToGatherMark } from "../model/session-page-utils";
import type {
  SessionsSideCalledStatusTone,
  SlotGatherStatus,
} from "../model/session-page-types";

export type SessionsBrowseStage = "calendar" | "day" | "session";

export type CalledRow = {
  key: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  avatarLabel: string;
  statusLabel: string;
  statusTone: SessionsSideCalledStatusTone;
};

const SLOT_GATHER_LABELS: Record<SlotGatherStatus, string> = {
  ok: "Все явки",
  warn: "Не все явки",
  bad: "Не собирается",
  none: "Нет материала",
};

export function SlotGatherMark({ status }: { status: SlotGatherStatus }) {
  const label = SLOT_GATHER_LABELS[status];
  return (
    <span
      className={cn(
        "sessions-slot-gather-mark",
        `sessions-slot-gather-mark--${status}`,
      )}
      title={label}
      aria-label={label}
    />
  );
}

export function SessionsNavBack({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="sessions-nav-back" onClick={onClick}>
      {children}
    </button>
  );
}

export function SessionsSlotPreviewRow({
  time,
  projectLabel,
  sceneLabel,
  durationMin,
  gatherStatus,
}: {
  time: string;
  projectLabel: string;
  sceneLabel: string;
  durationMin?: number;
  gatherStatus: SlotGatherStatus;
}) {
  const durationSuffix =
    durationMin != null && durationMin > 0 ? `${durationMin}′` : null;
  const materialParts: string[] = [];
  if (projectLabel) materialParts.push(projectLabel);
  materialParts.push(sceneLabel);
  if (durationSuffix) materialParts.push(durationSuffix);
  const materialLine = materialParts.join(" · ");

  return (
    <div className="sessions-slot-row">
      <span className="sessions-slot-row__time">{time}</span>
      <span className="sessions-slot-row__label" title={materialLine}>
        {materialLine}
      </span>
      <SlotGatherMark status={gatherStatus} />
    </div>
  );
}

export function SlotCalledActors({
  rows,
  emptyMessage,
  compact = false,
}: {
  rows: CalledRow[];
  emptyMessage: string;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rehearsals-muted sessions-slot-called__empty">
        {emptyMessage}
      </div>
    );
  }

  const avatarSize = compact ? 18 : 22;

  return (
    <div
      className={cn(
        "sessions-slot-called",
        compact && "sessions-slot-called--compact",
      )}
    >
      {!compact ? (
        <div className="rehearsals-section-title sessions-slot-called__title">
          Актёры
        </div>
      ) : null}
      <ul className="director-session-page__called-list sessions-slot-called__list">
        {rows.map((row) => {
          const statusHint = row.statusLabel.trim();
          const markStatus = calledStatusToGatherMark(row.statusTone);

          return (
            <li
              key={row.key}
              className="director-session-page__called-item"
              title={statusHint || undefined}
            >
              <MiniAvatar
                src={row.avatarUrl}
                label={row.avatarLabel}
                title={row.email}
                size={avatarSize}
              />
              <span
                className={cn(
                  "sessions-slot-gather-mark",
                  `sessions-slot-gather-mark--${markStatus}`,
                )}
                title={statusHint || undefined}
                aria-label={statusHint || undefined}
              />
              <span
                className="director-session-page__called-name"
                title={row.email}
              >
                {row.name}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
