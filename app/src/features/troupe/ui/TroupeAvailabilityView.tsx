import { Button } from "@shared/core/button/Button";
import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Fragment, useMemo, useState, type CSSProperties } from "react";
import {
  getAvailabilityDayVisual,
  sortMineFirst,
  type AvailabilityStatus,
} from "../../profile/model/availability-calendar";
import { useScheduleAvailability } from "../../profile/model/useScheduleAvailability";
import { AvailabilityDayModal } from "../../profile/ui/AvailabilityDayModal";
import { AvailabilityRangeTimeModal } from "../../profile/ui/AvailabilityRangeTimeModal";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { profileListAvatarSrc } from "../../../sync/api/profile";
import type { TroupeMemberItem } from "../api/troupe-api";
import {
  countDaysInIsoRange,
  formatIsoDayRangeLabel,
  isoDate,
  isIsoInDayRange,
  memberLabel,
  monthKey,
  monthLabel,
  ruDayCountLabel,
} from "../model/troupe-page-utils";
import { useTroupePage } from "../model/useTroupePage";
import { useTroupeScheduleRange } from "../model/useTroupeScheduleRange";
import "../../../features/director-sessions/ui/director-sessions.css";
import "../../../pages/troupe/style.css";

dayjs.locale("ru");

export function TroupeAvailabilityView() {
  const {
    accessToken,
    currentMonth,
    days,
    error,
    guestTroupeMembers,
    loading,
    members,
    regularTroupeMembers,
    scheduleRefreshing,
    setCurrentMonth,
    todayIso,
  } = useTroupePage();
  const availability = useScheduleAvailability(accessToken);
  const {
    activateHeaderDay,
    beginDayPointer,
    committedRange,
    moveDayPointer,
    shouldIgnoreMineClick,
    visibleRange,
  } = useTroupeScheduleRange(monthKey(currentMonth));
  const [rangeTimeModalOpen, setRangeTimeModalOpen] = useState(false);
  const iAmInSchedule = members.some((member) =>
    availability.isMine(member.email),
  );
  const selectedRangeLabel = committedRange
    ? `${formatIsoDayRangeLabel(committedRange)} · ${ruDayCountLabel(countDaysInIsoRange(committedRange))}`
    : null;
  const applySelectedRange = (status: AvailabilityStatus | null) => {
    if (!committedRange) return;
    availability.applyRangeStatus(
      committedRange.from,
      committedRange.to,
      status,
    );
  };
  const regularSorted = useMemo(
    () => sortMineFirst(regularTroupeMembers, availability.myEmail),
    [availability.myEmail, regularTroupeMembers],
  );
  const guestSorted = useMemo(
    () => sortMineFirst(guestTroupeMembers, availability.myEmail),
    [availability.myEmail, guestTroupeMembers],
  );
  const currentMonthKey = monthKey(currentMonth);
  const nextMonthStart = dayjs(currentMonth).add(1, "month").startOf("month");
  const peekDays = Array.from(
    { length: nextMonthStart.daysInMonth() },
    (_v, i) => nextMonthStart.add(i, "day").toDate(),
  );
  const gridDays = [...days, ...peekDays];
  const peekStartIso = peekDays[0] ? isoDate(peekDays[0]) : null;

  const renderScheduleGrid = (
    scheduleMembers: TroupeMemberItem[],
    emptyText: string,
    ariaLabel: string,
  ) => (
    <div
      className={cn(
        "troupe-schedule",
        scheduleRefreshing && "troupe-schedule--refreshing",
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
          const isHeaderDayInRange = isIsoInDayRange(dayIso, visibleRange);
          return (
            <div
              key={dayIso}
              data-troupe-day={dayIso}
              role="button"
              tabIndex={0}
              aria-pressed={isHeaderDayInRange}
              className={cn(
                "troupe-cell troupe-header-cell troupe-header-cell--day-head",
                isTodayCol && "troupe-header-cell--today",
                isPeek && "troupe-header-cell--peek",
                isPeekStart && "troupe-header-cell--peek-start",
              )}
              title={dayIso}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                beginDayPointer(dayIso, e.currentTarget, e.pointerId, "header");
              }}
              onPointerMove={(e) => moveDayPointer(e.clientX, e.clientY)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  activateHeaderDay(dayIso);
                }
              }}
            >
              <div className="troupe-header-day-num">{n}</div>
              <div className="troupe-header-day-wd">{wd}</div>
            </div>
          );
        })}

        {scheduleMembers.length === 0 ? (
          <div className="troupe-cell troupe-empty">{emptyText}</div>
        ) : (
          scheduleMembers.map((m) => {
            const label = memberLabel(m);
            const mine = availability.isMine(m.email);
            const dayAvailability = availability.resolveDayAvailability(
              m.email,
              m.profile?.availabilityCalendar,
              m.profile?.availabilityTimeRanges,
            );
            return (
              <Fragment key={m.id}>
                <div
                  className={cn(
                    "troupe-cell troupe-sticky troupe-actor-cell",
                    mine && "troupe-actor-cell--mine",
                    "troupe-actor-cell--readonly",
                  )}
                  title={`${label} • ${m.email}`}
                >
                  <div className="troupe-actor-row">
                    <MiniAvatar
                      src={profileListAvatarSrc(m.profile)}
                      label={label || m.email}
                      size={22}
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
                    mine && isIsoInDayRange(day, visibleRange);
                  const isMineRangeStart =
                    isMineRangeCell && visibleRange?.from === day;
                  const isMineRangeEnd =
                    isMineRangeCell && visibleRange?.to === day;
                  const cellTitle = `${day} • ${visual.tooltip}`;

                  return (
                    <div
                      key={`${m.id}:${day}`}
                      data-troupe-day={day}
                      role={mine ? "button" : undefined}
                      tabIndex={mine ? 0 : undefined}
                      className={cn(
                        "troupe-cell troupe-day-cell",
                        visual.cls,
                        isMineRangeCell && "day-col-selected",
                        isMineRangeCell && "selected",
                        isMineRangeStart && "troupe-day-cell--range-start",
                        isMineRangeEnd && "troupe-day-cell--range-end",
                        isTodayCol && "troupe-day-cell--today",
                        mine && "troupe-day-cell--mine",
                        isPeek && "troupe-day-cell--peek",
                        isPeekStart && "troupe-day-cell--peek-start",
                      )}
                      title={
                        mine
                          ? `${cellTitle}. Протяните, чтобы выбрать дни. Клик — интервалы времени`
                          : cellTitle
                      }
                      onPointerDown={
                        mine
                          ? (e) => {
                              if (e.button !== 0) return;
                              beginDayPointer(
                                day,
                                e.currentTarget,
                                e.pointerId,
                                "mine",
                              );
                            }
                          : undefined
                      }
                      onPointerMove={
                        mine
                          ? (e) => moveDayPointer(e.clientX, e.clientY)
                          : undefined
                      }
                      onClick={
                        mine
                          ? () => {
                              if (shouldIgnoreMineClick()) return;
                              availability.openDayEditor(day);
                            }
                          : undefined
                      }
                      onKeyDown={
                        mine
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                availability.openDayEditor(day);
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

  if (!accessToken) {
    return <div>Нужно войти, чтобы открыть занятость.</div>;
  }
  if (loading) return <PageBootLoader label="Загрузка занятости…" />;

  return (
    <>
      <div className="troupe-card troupe-schedule-card">
        <div className="troupe-scale-head">
          <div className="troupe-scale-head__titleblock">
            <div className="troupe-scale-head__title">Основной состав</div>
            <div className="troupe-scale-head__subtitle">
              Месяц: <b>{monthLabel(currentMonth)}</b>
              {iAmInSchedule
                ? " — выберите дни на графике, затем отметьте занятость."
                : null}
            </div>
          </div>
          <div className="troupe-scale-toolbar">
            <div className="troupe-month-nav">
              <button
                type="button"
                aria-label="Предыдущий месяц"
                onClick={() =>
                  setCurrentMonth(
                    dayjs(currentMonth).subtract(1, "month").toDate(),
                  )
                }
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Следующий месяц"
                onClick={() =>
                  setCurrentMonth(dayjs(currentMonth).add(1, "month").toDate())
                }
              >
                →
              </button>
            </div>
            <div className="troupe-legend">
              <span className="troupe-legend-item">
                <span className="troupe-dot free" /> свободен
              </span>
              <span className="troupe-legend-item">
                <span className="troupe-dot partial" />
                <span className="troupe-legend-desktop">свободен (время)</span>
                <span className="troupe-legend-mobile">по времени</span>
              </span>
              <span className="troupe-legend-item">
                <span className="troupe-dot busy" /> занят
              </span>
              <span className="troupe-legend-item">
                <span className="troupe-dot unknown" /> не отмечено
              </span>
            </div>
          </div>
        </div>

        {iAmInSchedule ? (
          <div className="troupe-my-availability">
            <div className="troupe-my-availability__label">
              {selectedRangeLabel
                ? `Выбрано: ${selectedRangeLabel}`
                : "Выберите диапазон на графике"}
            </div>
            <div className="troupe-my-availability__actions">
              <Button
                type="button"
                disabled={!committedRange}
                onClick={() => applySelectedRange("present")}
              >
                Свободен
              </Button>
              <Button
                className="danger"
                type="button"
                disabled={!committedRange}
                onClick={() => applySelectedRange("absent")}
              >
                Занят
              </Button>
              <Button
                className="secondary"
                type="button"
                disabled={!committedRange}
                onClick={() => applySelectedRange(null)}
              >
                Сбросить
              </Button>
              <Button
                className="secondary"
                type="button"
                disabled={!committedRange}
                onClick={() => setRangeTimeModalOpen(true)}
              >
                Диапазон
              </Button>
            </div>
            {availability.saving ? (
              <div className="troupe-my-availability__status">
                Автосохранение…
              </div>
            ) : availability.error ? (
              <div className="troupe-error">{availability.error}</div>
            ) : availability.ok ? (
              <div className="troupe-my-availability__status troupe-my-availability__status--ok">
                {availability.ok}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="troupe-schedule-scroll-hint">
          Листайте таблицу вправо, чтобы увидеть все дни месяца.
        </p>

        {renderScheduleGrid(
          regularSorted,
          "В основном составе пока никого нет.",
          "Занятость основного состава",
        )}
      </div>

      <div className="troupe-card troupe-schedule-card troupe-schedule-card--guest">
        <div className="troupe-scale-head">
          <div className="troupe-scale-head__titleblock">
            <div className="troupe-scale-head__title">Приглашённые</div>
            <div className="troupe-scale-head__subtitle">
              Занятость участников вне основного состава.
            </div>
          </div>
        </div>
        {renderScheduleGrid(
          guestSorted,
          "Приглашённых пока нет.",
          "Занятость приглашённых",
        )}
      </div>

      {error ? <div className="troupe-error">{error}</div> : null}

      <AvailabilityDayModal
        isOpen={Boolean(availability.editingDateIso)}
        dateIso={availability.editingDateIso}
        onClose={availability.closeDayEditor}
      />
      <AvailabilityRangeTimeModal
        isOpen={rangeTimeModalOpen && Boolean(committedRange)}
        rangeLabel={selectedRangeLabel}
        onClose={() => setRangeTimeModalOpen(false)}
        onApply={(range) => {
          if (!committedRange) return;
          availability.applyRangeTimeWindow(
            committedRange.from,
            committedRange.to,
            range,
          );
        }}
      />
    </>
  );
}
