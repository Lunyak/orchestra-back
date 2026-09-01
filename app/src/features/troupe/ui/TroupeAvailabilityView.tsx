import { Button } from "@shared/core/button/Button";
import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo, useState } from "react";
import {
  sortMineFirst,
  type AvailabilityStatus,
} from "../../profile/model/availability-calendar";
import { useScheduleAvailability } from "../../profile/model/useScheduleAvailability";
import { AvailabilityDayModal } from "../../profile/ui/AvailabilityDayModal";
import { AvailabilityRangeTimeModal } from "../../profile/ui/AvailabilityRangeTimeModal";
import {
  countDaysInIsoRange,
  formatIsoDayRangeLabel,
  isoDate,
  monthKey,
  monthLabel,
  ruDayCountLabel,
} from "../model/troupe-page-utils";
import { useTroupePage } from "../model/useTroupePage";
import { useTroupeScheduleRange } from "../model/useTroupeScheduleRange";
import { TroupeAvailabilityScheduleGrid } from "./TroupeAvailabilityScheduleGrid";
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
    selectedMemberId,
    setCurrentMonth,
    setSelectedMemberId,
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
  const toggleMemberId = (id: string) =>
    setSelectedMemberId((prev) => (prev === id ? null : id));

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

        <TroupeAvailabilityScheduleGrid
          members={regularSorted}
          emptyText="В основном составе пока никого нет."
          ariaLabel="Занятость основного состава"
          gridDays={gridDays}
          currentMonthKey={currentMonthKey}
          peekStartIso={peekStartIso}
          todayIso={todayIso}
          selectedMemberId={selectedMemberId}
          onToggleMemberId={toggleMemberId}
          availability={availability}
          scheduleRefreshing={scheduleRefreshing}
          visibleRange={visibleRange}
          onHeaderPointerDown={(dayIso, target, pointerId) =>
            beginDayPointer(dayIso, target, pointerId, "header")
          }
          onDayPointerDown={(dayIso, target, pointerId) =>
            beginDayPointer(dayIso, target, pointerId, "mine")
          }
          onDayPointerMove={moveDayPointer}
          onHeaderActivate={activateHeaderDay}
          onMineDayClick={availability.openDayEditor}
          shouldIgnoreMineClick={shouldIgnoreMineClick}
        />
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
        <TroupeAvailabilityScheduleGrid
          members={guestSorted}
          emptyText="Приглашённых пока нет."
          ariaLabel="Занятость приглашённых"
          gridDays={gridDays}
          currentMonthKey={currentMonthKey}
          peekStartIso={peekStartIso}
          todayIso={todayIso}
          selectedMemberId={selectedMemberId}
          onToggleMemberId={toggleMemberId}
          availability={availability}
          scheduleRefreshing={scheduleRefreshing}
          visibleRange={visibleRange}
          onHeaderPointerDown={(dayIso, target, pointerId) =>
            beginDayPointer(dayIso, target, pointerId, "header")
          }
          onDayPointerDown={(dayIso, target, pointerId) =>
            beginDayPointer(dayIso, target, pointerId, "mine")
          }
          onDayPointerMove={moveDayPointer}
          onHeaderActivate={activateHeaderDay}
          onMineDayClick={availability.openDayEditor}
          shouldIgnoreMineClick={shouldIgnoreMineClick}
        />
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
