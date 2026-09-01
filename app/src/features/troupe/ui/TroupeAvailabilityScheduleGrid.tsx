import cn from "classnames";
import dayjs from "dayjs";
import { Fragment, type CSSProperties } from "react";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { profileListAvatarSrc } from "../../../sync/api/profile";
import { getAvailabilityDayVisual } from "../../profile/model/availability-calendar";
import { useScheduleAvailability } from "../../profile/model/useScheduleAvailability";
import type { TroupeMemberItem } from "../api/troupe-api";
import {
  isoDate,
  isIsoInDayRange,
  memberLabel,
  monthKey,
  type IsoDayRange,
} from "../model/troupe-page-utils";

type TroupeAvailabilityScheduleGridProps = {
  members: TroupeMemberItem[];
  emptyText: string;
  ariaLabel: string;
  gridDays: Date[];
  currentMonthKey: string;
  peekStartIso: string | null;
  todayIso: string;
  selectedMemberId: string | null;
  onToggleMemberId: (id: string) => void;
  availability: ReturnType<typeof useScheduleAvailability>;
  scheduleRefreshing?: boolean;
  compact?: boolean;
  readOnly?: boolean;
  selectedDateIso?: string | null;
  visibleRange?: IsoDayRange | null;
  onHeaderPointerDown?: (
    dayIso: string,
    target: HTMLElement,
    pointerId: number,
  ) => void;
  onDayPointerDown?: (
    dayIso: string,
    target: HTMLElement,
    pointerId: number,
  ) => void;
  onDayPointerMove?: (clientX: number, clientY: number) => void;
  onHeaderActivate?: (dayIso: string) => void;
  onMineDayClick?: (dayIso: string) => void;
  onSelectDate?: (dayIso: string) => void;
  shouldIgnoreMineClick?: () => boolean;
};

export function TroupeAvailabilityScheduleGrid({
  members,
  emptyText,
  ariaLabel,
  gridDays,
  currentMonthKey,
  peekStartIso,
  todayIso,
  selectedMemberId,
  onToggleMemberId,
  availability,
  scheduleRefreshing,
  compact,
  readOnly,
  selectedDateIso,
  visibleRange,
  onHeaderPointerDown,
  onDayPointerDown,
  onDayPointerMove,
  onHeaderActivate,
  onMineDayClick,
  onSelectDate,
  shouldIgnoreMineClick,
}: TroupeAvailabilityScheduleGridProps) {
  const avatarSize = compact ? 16 : 22;
  const canPickDate = Boolean(onSelectDate);

  return (
    <div
      className={cn(
        "troupe-schedule",
        scheduleRefreshing && "troupe-schedule--refreshing",
        selectedMemberId && "troupe-schedule--has-row-selection",
        compact && "troupe-schedule--compact",
        readOnly && "troupe-schedule--readonly",
      )}
      role="region"
      aria-label={ariaLabel}
      aria-busy={scheduleRefreshing}
    >
      <div
        className="troupe-grid"
        style={
          {
            ["--troupe-day-count" as string]: String(gridDays.length),
            ["--troupe-grid-span" as string]: String(gridDays.length + 1),
          } as CSSProperties
        }
      >
        <div className="troupe-cell troupe-sticky troupe-header-cell" />
        {gridDays.map((d) => {
          const n = dayjs(d).date();
          const wd = dayjs(d).format("dd");
          const dayIso = isoDate(d);
          const isTodayCol = dayIso === todayIso;
          const isPeek = monthKey(d) !== currentMonthKey;
          const isPeekStart = isPeek && dayIso === peekStartIso;
          const isHeaderDayInRange = isIsoInDayRange(dayIso, visibleRange ?? null);
          const isFocusDate = dayIso === selectedDateIso;
          return (
            <div
              key={dayIso}
              data-troupe-day={dayIso}
              role={readOnly && !canPickDate ? undefined : "button"}
              tabIndex={readOnly && !canPickDate ? undefined : 0}
              aria-pressed={
                canPickDate
                  ? isFocusDate
                  : readOnly
                    ? undefined
                    : isHeaderDayInRange
              }
              className={cn(
                "troupe-cell troupe-header-cell",
                (!readOnly || canPickDate) && "troupe-header-cell--day-head",
                isTodayCol && "troupe-header-cell--today",
                isPeek && "troupe-header-cell--peek",
                isPeekStart && "troupe-header-cell--peek-start",
                isFocusDate && "focus",
                isFocusDate && "troupe-header-cell--col-selected",
              )}
              title={dayIso}
              onClick={
                canPickDate ? () => onSelectDate?.(dayIso) : undefined
              }
              onPointerDown={
                readOnly || !onHeaderPointerDown
                  ? undefined
                  : (e) => {
                      if (e.button !== 0) return;
                      onHeaderPointerDown(
                        dayIso,
                        e.currentTarget,
                        e.pointerId,
                      );
                    }
              }
              onPointerMove={
                readOnly || !onDayPointerMove
                  ? undefined
                  : (e) => onDayPointerMove(e.clientX, e.clientY)
              }
              onKeyDown={
                canPickDate
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectDate?.(dayIso);
                      }
                    }
                  : readOnly || !onHeaderActivate
                    ? undefined
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onHeaderActivate(dayIso);
                        }
                      }
              }
            >
              <div className="troupe-header-day-num">{n}</div>
              <div className="troupe-header-day-wd">{wd}</div>
            </div>
          );
        })}

        {members.length === 0 ? (
          <div className="troupe-cell troupe-empty">{emptyText}</div>
        ) : (
          members.map((m) => {
            const label = memberLabel(m);
            const mine = availability.isMine(m.email);
            const isPersonSelected = m.id === selectedMemberId;
            const dayAvailability = availability.resolveDayAvailability(
              m.email,
              m.profile?.availabilityCalendar,
              m.profile?.availabilityTimeRanges,
            );
            const togglePersonSelected = () => onToggleMemberId(m.id);
            return (
              <Fragment key={m.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={isPersonSelected}
                  className={cn(
                    "troupe-cell troupe-sticky troupe-actor-cell",
                    mine && "troupe-actor-cell--mine",
                    isPersonSelected && "selected",
                  )}
                  title={`${label} • ${m.email}. Нажмите, чтобы подсветить занятость`}
                  onClick={togglePersonSelected}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      togglePersonSelected();
                    }
                  }}
                >
                  <div className="troupe-actor-row">
                    <MiniAvatar
                      src={profileListAvatarSrc(m.profile)}
                      label={label || m.email}
                      size={avatarSize}
                    />
                    <div className="troupe-actor-meta">
                      <div className="troupe-actor-name" title={label}>
                        {label}
                      </div>
                    </div>
                  </div>
                </div>
                {gridDays.map((d) => {
                  const day = isoDate(d);
                  const visual = getAvailabilityDayVisual(
                    dayAvailability.calendar,
                    dayAvailability.ranges,
                    day,
                  );
                  const isTodayCol = day === todayIso;
                  const isPeek = monthKey(d) !== currentMonthKey;
                  const isPeekStart = isPeek && day === peekStartIso;
                  const isMineRangeCell =
                    !readOnly &&
                    mine &&
                    isIsoInDayRange(day, visibleRange ?? null);
                  const isMineRangeStart =
                    isMineRangeCell && visibleRange?.from === day;
                  const isMineRangeEnd =
                    isMineRangeCell && visibleRange?.to === day;
                  const isFocusDate = day === selectedDateIso;
                  const cellTitle = `${day} • ${visual.tooltip}`;
                  const canEditDay = !readOnly && mine;
                  const canPickDay = canPickDate && !canEditDay;

                  return (
                    <div
                      key={`${m.id}:${day}`}
                      data-troupe-day={day}
                      role={canEditDay || canPickDay ? "button" : undefined}
                      tabIndex={canEditDay || canPickDay ? 0 : undefined}
                      className={cn(
                        "troupe-cell troupe-day-cell",
                        visual.cls,
                        isMineRangeCell && "day-col-selected",
                        (isMineRangeCell || isPersonSelected) && "selected",
                        isMineRangeStart && "troupe-day-cell--range-start",
                        isMineRangeEnd && "troupe-day-cell--range-end",
                        isTodayCol && "troupe-day-cell--today",
                        canEditDay && "troupe-day-cell--mine",
                        canPickDay && "troupe-day-cell--pick",
                        isPeek && "troupe-day-cell--peek",
                        isPeekStart && "troupe-day-cell--peek-start",
                        isFocusDate && "focus",
                      )}
                      title={
                        canEditDay
                          ? `${cellTitle}. Протяните, чтобы выбрать дни. Клик — интервалы времени`
                          : canPickDay
                            ? `${cellTitle}. Нажмите, чтобы открыть день`
                            : cellTitle
                      }
                      onPointerDown={
                        canEditDay && onDayPointerDown
                          ? (e) => {
                              if (e.button !== 0) return;
                              onDayPointerDown(
                                day,
                                e.currentTarget,
                                e.pointerId,
                              );
                            }
                          : undefined
                      }
                      onPointerMove={
                        canEditDay && onDayPointerMove
                          ? (e) => onDayPointerMove(e.clientX, e.clientY)
                          : undefined
                      }
                      onClick={
                        canEditDay && onMineDayClick
                          ? () => {
                              if (shouldIgnoreMineClick?.()) return;
                              onMineDayClick(day);
                            }
                          : canPickDay
                            ? () => onSelectDate?.(day)
                            : undefined
                      }
                      onKeyDown={
                        canEditDay && onMineDayClick
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onMineDayClick(day);
                              }
                            }
                          : canPickDay
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onSelectDate?.(day);
                                }
                              }
                            : undefined
                      }
                    />
                  );
                })}
              </Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
