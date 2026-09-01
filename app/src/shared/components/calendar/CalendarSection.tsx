import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  MonthCalendar,
  type CalendarViewMode,
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

function parseViewMode(raw: string | null): CalendarViewMode {
  if (raw === "week" || raw === "day" || raw === "month") return raw;
  return "month";
}

export type CalendarSectionState = {
  currentMonth: Date;
  selectedDate: string;
  viewMode: CalendarViewMode;
  monthStartDate: Date;
  monthEndDate: Date;
  fromIso: string;
  toIso: string;
};

export type { CalendarViewMode };

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
  selectedDate: selectedDateProp,
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
  selectedDate?: string;
  onStateChange?: (state: CalendarSectionState) => void;
  weekDayLabels?: string[];
  showStatusMarks?: boolean;
}) {
  const storageViewKey = `${storageMonthKey}:view`;

  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = sessionStorage.getItem(storageMonthKey);
    if (saved) {
      try {
        const date = new Date(saved);
        if (!isNaN(date.getTime())) return startOfMonth(date);
      } catch {
        // ignore
      }
    }
    return startOfMonth(new Date());
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const v = String(selectedDateProp ?? initialSelectedDate ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : isoDate(new Date());
  });

  const [viewMode, setViewMode] = useState<CalendarViewMode>(() =>
    parseViewMode(sessionStorage.getItem(storageViewKey)),
  );

  useEffect(() => {
    const next = String(selectedDateProp ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    setSelectedDate((prev) => (prev === next ? prev : next));
  }, [selectedDateProp]);

  useEffect(() => {
    sessionStorage.setItem(storageMonthKey, currentMonth.toISOString());
  }, [currentMonth, storageMonthKey]);

  useEffect(() => {
    sessionStorage.setItem(storageViewKey, viewMode);
  }, [storageViewKey, viewMode]);

  const monthStartDate = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEndDate = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const fromIso = useMemo(() => monthStartDate.toISOString(), [monthStartDate]);
  const toIso = useMemo(() => monthEndDate.toISOString(), [monthEndDate]);

  useEffect(() => {
    onStateChange?.({
      currentMonth,
      selectedDate,
      viewMode,
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
    viewMode,
  ]);

  const handleChangeViewMode = (nextMode: CalendarViewMode) => {
    setViewMode(nextMode);
    const nextMonth = dayjs(selectedDate).startOf("month").toDate();
    if (!dayjs(nextMonth).isSame(currentMonth, "month")) {
      setCurrentMonth(nextMonth);
    }
  };

  const handleSelectDate = (iso: string) => {
    setSelectedDate(iso);
    const nextMonth = dayjs(iso).startOf("month").toDate();
    if (!dayjs(nextMonth).isSame(currentMonth, "month")) {
      setCurrentMonth(nextMonth);
    }
  };

  return (
    <div className={className}>
      <MonthCalendar
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        viewMode={viewMode}
        onChangeMonth={setCurrentMonth}
        onSelectDate={handleSelectDate}
        onChangeViewMode={handleChangeViewMode}
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
