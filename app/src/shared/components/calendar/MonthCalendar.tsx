import { useEffect, useMemo, useRef, useState } from "react";
import cn from "classnames";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/ru";
import "./month-calendar.css";

dayjs.extend(isoWeek);
dayjs.locale("ru");

export type MonthCalendarStatus = "present" | "absent";

export type MonthCalendarEvent = {
  id: string;
  time: string;
  title: string;
  published?: boolean;
};

export type CalendarViewMode = "month" | "week" | "day";

const VIEW_MODE_OPTIONS: { id: CalendarViewMode; label: string }[] = [
  { id: "month", label: "Месяц" },
  { id: "week", label: "Неделя" },
  { id: "day", label: "День" },
];

const MONTH_SHORT_LABELS = Array.from({ length: 12 }, (_, monthIndex) =>
  dayjs().month(monthIndex).format("MMM"),
);

function isoYmd(d: Date | string): string {
  return dayjs(d).format("YYYY-MM-DD");
}

function addMonths(base: Date, months: number): Date {
  return dayjs(base).add(months, "month").toDate();
}

function startOfMonthDate(year: number, monthIndex: number): Date {
  return dayjs().year(year).month(monthIndex).startOf("month").toDate();
}

function getMonthCalendarDays(date: Date): Date[] {
  const start = dayjs(date).startOf("month");
  const end = dayjs(date).endOf("month");
  const startDay = start.startOf("isoWeek");
  const endDay = end.endOf("isoWeek");

  const days: Date[] = [];
  let current = startDay;

  while (current.isBefore(endDay) || current.isSame(endDay, "day")) {
    days.push(current.toDate());
    current = current.add(1, "day");
  }

  return days;
}

function getWeekCalendarDays(selectedDate: string): Date[] {
  const startDay = dayjs(selectedDate).startOf("isoWeek");
  return Array.from({ length: 7 }, (_, index) =>
    startDay.add(index, "day").toDate(),
  );
}

function getDayCalendarDays(selectedDate: string): Date[] {
  return [dayjs(selectedDate).toDate()];
}

function formatWeekRangeLabel(selectedDate: string): string {
  const start = dayjs(selectedDate).startOf("isoWeek");
  const end = start.add(6, "day");
  if (start.month() === end.month() && start.year() === end.year()) {
    return `${start.format("D")}–${end.format("D MMMM YYYY")}`;
  }
  if (start.year() === end.year()) {
    return `${start.format("D MMM")} – ${end.format("D MMM YYYY")}`;
  }
  return `${start.format("D MMM YYYY")} – ${end.format("D MMM YYYY")}`;
}

function eventLimitForView(viewMode: CalendarViewMode): number {
  if (viewMode === "day") return 24;
  if (viewMode === "week") return 5;
  return 2;
}

export function MonthCalendar({
  currentMonth,
  selectedDate,
  viewMode = "month",
  onChangeMonth,
  onSelectDate,
  onChangeViewMode,
  onDayClick,
  statusByDate,
  dotsByDate,
  eventsByDate,
  title,
  subtitle,
  weekDayLabels,
  onDayDoubleClick,
  showStatusMarks = true,
}: {
  currentMonth: Date;
  selectedDate: string;
  viewMode?: CalendarViewMode;
  onChangeMonth: (next: Date) => void;
  onSelectDate: (isoYmd: string) => void;
  onChangeViewMode?: (mode: CalendarViewMode) => void;
  onDayClick?: (isoYmd: string) => void;
  onDayDoubleClick?: (isoYmd: string) => void;
  statusByDate?: Record<string, MonthCalendarStatus | undefined>;
  dotsByDate?: Record<string, number | undefined>;
  eventsByDate?: Record<string, MonthCalendarEvent[] | undefined>;
  title?: string;
  subtitle?: string;
  weekDayLabels?: string[];
  showStatusMarks?: boolean;
}) {
  const labels = weekDayLabels ?? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const todayIso = useMemo(() => isoYmd(new Date()), []);
  const calendarDays = useMemo(() => {
    if (viewMode === "week") return getWeekCalendarDays(selectedDate);
    if (viewMode === "day") return getDayCalendarDays(selectedDate);
    return getMonthCalendarDays(currentMonth);
  }, [currentMonth, selectedDate, viewMode]);

  const currentMonthDayjs = dayjs(currentMonth);
  const currentYear = currentMonthDayjs.year();
  const currentMonthIndex = currentMonthDayjs.month();
  const eventLimit = eventLimitForView(viewMode);

  const periodLabel = useMemo(() => {
    if (viewMode === "week") return formatWeekRangeLabel(selectedDate);
    if (viewMode === "day") {
      return dayjs(selectedDate).format("D MMMM YYYY");
    }
    return currentMonthDayjs.format("MMMM YYYY");
  }, [currentMonthDayjs, selectedDate, viewMode]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    setPickerYear(currentYear);
  }, [pickerOpen, currentYear]);

  useEffect(() => {
    if (!pickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const clickedInside = Boolean(
        target && monthPickerRef.current?.contains(target),
      );
      if (!clickedInside) setPickerOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [pickerOpen]);

  const syncMonthForDate = (iso: string) => {
    const nextMonth = dayjs(iso).startOf("month").toDate();
    if (!dayjs(nextMonth).isSame(currentMonth, "month")) {
      onChangeMonth(nextMonth);
    }
  };

  const handleSelectMonth = (monthIndex: number) => {
    const nextMonth = startOfMonthDate(pickerYear, monthIndex);
    onChangeMonth(nextMonth);
    const dayOfMonth = dayjs(selectedDate).date();
    const clamped = dayjs(nextMonth)
      .date(Math.min(dayOfMonth, dayjs(nextMonth).daysInMonth()))
      .format("YYYY-MM-DD");
    onSelectDate(clamped);
    setPickerOpen(false);
  };

  const handleNavigate = (direction: -1 | 1) => {
    if (viewMode === "week") {
      const next = dayjs(selectedDate).add(direction * 7, "day").format("YYYY-MM-DD");
      onSelectDate(next);
      syncMonthForDate(next);
      return;
    }
    if (viewMode === "day") {
      const next = dayjs(selectedDate).add(direction, "day").format("YYYY-MM-DD");
      onSelectDate(next);
      syncMonthForDate(next);
      return;
    }
    onChangeMonth(addMonths(currentMonth, direction));
  };

  const showWeekdayHeader = viewMode !== "day";

  return (
    <div
      className={cn("month-cal", {
        "month-cal--week": viewMode === "week",
        "month-cal--day": viewMode === "day",
      })}
    >
      {(title || subtitle) && (
        <div className="month-cal__heading">
          {title && <div className="month-cal__title">{title}</div>}
          {subtitle && <p className="month-cal__subtitle">{subtitle}</p>}
        </div>
      )}

      {onChangeViewMode ? (
        <div
          className="month-cal__view-switch"
          role="group"
          aria-label="Вид календаря"
        >
          {VIEW_MODE_OPTIONS.map((option) => {
            const isActive = viewMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "month-cal__view-btn",
                  isActive && "month-cal__view-btn--active",
                )}
                aria-pressed={isActive}
                onClick={() => onChangeViewMode(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="month-cal__nav">
        <button
          type="button"
          className="month-cal__nav-btn"
          onClick={() => handleNavigate(-1)}
        >
          ←
        </button>
        <div className="month-cal__month-wrap" ref={monthPickerRef}>
          <button
            type="button"
            className={cn(
              "month-cal__month-label",
              pickerOpen && "month-cal__month-label--open",
            )}
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            title="Выбрать месяц и год"
            onClick={() => setPickerOpen((open) => !open)}
          >
            {periodLabel}
          </button>
          {pickerOpen ? (
            <div
              className="month-cal__month-picker"
              role="dialog"
              aria-label="Выбор месяца и года"
            >
              <div className="month-cal__year-nav">
                <button
                  type="button"
                  className="month-cal__year-btn"
                  aria-label="Предыдущий год"
                  onClick={() => setPickerYear((year) => year - 1)}
                >
                  ←
                </button>
                <div className="month-cal__year-label">{pickerYear}</div>
                <button
                  type="button"
                  className="month-cal__year-btn"
                  aria-label="Следующий год"
                  onClick={() => setPickerYear((year) => year + 1)}
                >
                  →
                </button>
              </div>
              <div className="month-cal__months-grid">
                {MONTH_SHORT_LABELS.map((label, monthIndex) => {
                  const isActive =
                    pickerYear === currentYear &&
                    monthIndex === currentMonthIndex;

                  return (
                    <button
                      key={monthIndex}
                      type="button"
                      className={cn(
                        "month-cal__month-option",
                        isActive && "month-cal__month-option--active",
                      )}
                      aria-pressed={isActive}
                      onClick={() => handleSelectMonth(monthIndex)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="month-cal__nav-btn"
          onClick={() => handleNavigate(1)}
        >
          →
        </button>
      </div>

      {showWeekdayHeader ? (
        <div className="month-cal__weekdays">
          {labels.map((day) => (
            <div key={day} className="month-cal__weekday">
              {day}
            </div>
          ))}
        </div>
      ) : null}

      <div
        className={cn("month-cal__grid", {
          "month-cal__grid--week": viewMode === "week",
          "month-cal__grid--day": viewMode === "day",
        })}
      >
        {calendarDays.map((dateObj) => {
          const date = isoYmd(dateObj);
          const status = statusByDate?.[date];
          const dayEvents = eventsByDate?.[date] ?? [];
          const dots = Math.max(
            0,
            Number(dotsByDate?.[date] ?? 0) || dayEvents.length || 0,
          );
          const active = date === selectedDate;
          const isCurrentMonth =
            dayjs(dateObj).month() === dayjs(currentMonth).month();
          const isToday = date === todayIso;
          const visibleEvents = dayEvents.slice(0, eventLimit);
          const hiddenEventsCount = Math.max(0, dayEvents.length - eventLimit);

          return (
            <button
              key={date}
              type="button"
              aria-pressed={active}
              aria-label={`${date}${status === "present" ? ", свободен" : status === "absent" ? ", занят" : ""}`}
              onClick={() => {
                onSelectDate(date);
                onDayClick?.(date);
              }}
              onDoubleClick={() => {
                onSelectDate(date);
                onDayDoubleClick?.(date);
              }}
              title={date}
              className={cn("month-cal__cell", {
                "month-cal__cell--other-month":
                  viewMode === "month" && !isCurrentMonth,
                "month-cal__cell--selected": active,
                "month-cal__cell--today": isToday,
                "month-cal__cell--present": status === "present",
                "month-cal__cell--absent": status === "absent",
              })}
            >
              <span className="month-cal__cell-num">
                {viewMode === "day"
                  ? dayjs(dateObj).format("dddd, D MMMM")
                  : dayjs(dateObj).date()}
              </span>
              {dayEvents.length > 0 ? (
                <span className="month-cal__events" aria-hidden>
                  {visibleEvents.map((ev) => (
                    <span
                      key={ev.id}
                      className={cn("month-cal__event", {
                        "month-cal__event--published": ev.published,
                      })}
                      title={`${ev.time} · ${ev.title}`}
                    >
                      <span className="month-cal__event-time">{ev.time}</span>
                      <span className="month-cal__event-title">{ev.title}</span>
                    </span>
                  ))}
                  {hiddenEventsCount > 0 ? (
                    <span className="month-cal__event-more">
                      +{hiddenEventsCount}
                    </span>
                  ) : null}
                </span>
              ) : dots > 0 ? (
                <span className="month-cal__dots">
                  {Array.from({ length: Math.min(dots, 3) }).map((_, i) => (
                    <span key={i} className="month-cal__dot" />
                  ))}
                </span>
              ) : null}
              {showStatusMarks && status ? (
                <span className="month-cal__status-mark">
                  {status === "present" ? "✓" : "✗"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
