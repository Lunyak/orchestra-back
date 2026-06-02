import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  MonthCalendar,
  type MonthCalendarEvent,
  type MonthCalendarStatus,
} from "./MonthCalendar";

function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

function startOfMonth(date: Date): Date {
  return dayjs(date).startOf("month").toDate();
}

function endOfMonth(date: Date): Date {
  return dayjs(date).endOf("month").toDate();
}

export type CalendarSectionState = {
  currentMonth: Date;
  selectedDate: string;
  monthStartDate: Date;
  monthEndDate: Date;
  fromIso: string;
  toIso: string;
};

export function CalendarSection({
  storageMonthKey,
  title,
  subtitle,
  statusByDate,
  dotsByDate,
  eventsByDate,
  onDayClick,
  onDayDoubleClick,
  initialSelectedDate,
  onStateChange,
  weekDayLabels,
  className,
  showStatusMarks,
}: {
  storageMonthKey: string;
  title?: string;
  subtitle?: string;
  className?: string;
  statusByDate?: Record<string, MonthCalendarStatus | undefined>;
  dotsByDate?: Record<string, number | undefined>;
  eventsByDate?: Record<string, MonthCalendarEvent[] | undefined>;
  onDayClick?: (isoYmd: string) => void;
  onDayDoubleClick?: (isoYmd: string) => void;
  initialSelectedDate?: string;
  onStateChange?: (state: CalendarSectionState) => void;
  weekDayLabels?: string[];
  showStatusMarks?: boolean;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = localStorage.getItem(storageMonthKey);
    if (saved) {
      try {
        const date = new Date(saved);
        if (!isNaN(date.getTime())) return date;
      } catch {
        // ignore
      }
    }
    return new Date();
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const v = String(initialSelectedDate ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : isoDate(new Date());
  });

  useEffect(() => {
    localStorage.setItem(storageMonthKey, currentMonth.toISOString());
  }, [currentMonth, storageMonthKey]);

  const monthStartDate = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEndDate = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const fromIso = useMemo(() => monthStartDate.toISOString(), [monthStartDate]);
  const toIso = useMemo(() => monthEndDate.toISOString(), [monthEndDate]);

  useEffect(() => {
    onStateChange?.({
      currentMonth,
      selectedDate,
      monthStartDate,
      monthEndDate,
      fromIso,
      toIso,
    });
  }, [
    currentMonth,
    fromIso,
    monthEndDate,
    monthStartDate,
    onStateChange,
    selectedDate,
    toIso,
  ]);

  return (
    <div className={className}>
      <MonthCalendar
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        onChangeMonth={setCurrentMonth}
        onSelectDate={setSelectedDate}
        onDayClick={onDayClick}
        onDayDoubleClick={onDayDoubleClick}
        statusByDate={statusByDate}
        dotsByDate={dotsByDate}
        eventsByDate={eventsByDate}
        title={title}
        subtitle={subtitle}
        weekDayLabels={weekDayLabels}
        showStatusMarks={showStatusMarks}
      />
    </div>
  );
}

