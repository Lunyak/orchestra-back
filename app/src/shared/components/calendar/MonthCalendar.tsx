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

const MONTH_SHORT_LABELS = Array.from({ length: 12 }, (_, monthIndex) =>
  dayjs().month(monthIndex).format("MMM"),
);

function isoYmd(d: Date): string {
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

  // Начинаем с понедельника недели, в которой начинается месяц
  const startDay = start.startOf("isoWeek");
  // Заканчиваем воскресеньем недели, в которой заканчивается месяц
  const endDay = end.endOf("isoWeek");

  const days: Date[] = [];
  let current = startDay;

  while (current.isBefore(endDay) || current.isSame(endDay, "day")) {
    days.push(current.toDate());
    current = current.add(1, "day");
  }

  return days;
}

export function MonthCalendar({
  currentMonth,
  selectedDate,
  onChangeMonth,
  onSelectDate,
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
  onChangeMonth: (next: Date) => void;
  onSelectDate: (isoYmd: string) => void;
  onDayClick?: (isoYmd: string) => void;
  onDayDoubleClick?: (isoYmd: string) => void;
  statusByDate?: Record<string, MonthCalendarStatus | undefined>;
  dotsByDate?: Record<string, number | undefined>;
  eventsByDate?: Record<string, MonthCalendarEvent[] | undefined>;
  title?: string;
  subtitle?: string;
  weekDayLabels?: string[];
  /** ✓/✗ в ячейке; для профиля занятости лучше выключить — фон ячейки уже показывает статус */
  showStatusMarks?: boolean;
}) {
  const labels = weekDayLabels ?? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const todayIso = useMemo(() => isoYmd(new Date()), []);
  const calendarDays = useMemo(
    () => getMonthCalendarDays(currentMonth),
    [currentMonth],
  );

  const currentMonthDayjs = dayjs(currentMonth);
  const currentYear = currentMonthDayjs.year();
  const currentMonthIndex = currentMonthDayjs.month();
  const monthLabel = currentMonthDayjs.format("MMMM YYYY");

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

  const handleSelectMonth = (monthIndex: number) => {
    onChangeMonth(startOfMonthDate(pickerYear, monthIndex));
    setPickerOpen(false);
  };

  return (
    <div className="month-cal">
      {(title || subtitle) && (
        <div className="month-cal__heading">
          {title && <div className="month-cal__title">{title}</div>}
          {subtitle && <p className="month-cal__subtitle">{subtitle}</p>}
        </div>
      )}

      <div className="month-cal__nav">
        <button
          type="button"
          className="month-cal__nav-btn"
          onClick={() => onChangeMonth(addMonths(currentMonth, -1))}
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
            {monthLabel}
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
          onClick={() => onChangeMonth(addMonths(currentMonth, 1))}
        >
          →
        </button>
      </div>

      <div className="month-cal__weekdays">
        {labels.map((day) => (
          <div key={day} className="month-cal__weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="month-cal__grid">
        {calendarDays.map((dateObj) => {
          const date = isoYmd(dateObj);
          const status = statusByDate?.[date];
          const dayEvents = eventsByDate?.[date] ?? [];
          const dots = Math.max(
            0,
            Number(dotsByDate?.[date] ?? 0) || dayEvents.length || 0,
          );
          const active = date === selectedDate;
          const isCurrentMonth = dayjs(dateObj).month() === dayjs(currentMonth).month();
          const isToday = date === todayIso;

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
                "month-cal__cell--other-month": !isCurrentMonth,
                "month-cal__cell--selected": active,
                "month-cal__cell--today": isToday,
                "month-cal__cell--present": status === "present",
                "month-cal__cell--absent": status === "absent",
              })}
            >
              <span className="month-cal__cell-num">{dayjs(dateObj).date()}</span>
              {dayEvents.length > 0 ? (
                <span className="month-cal__events" aria-hidden>
                  {dayEvents.slice(0, 2).map((ev) => (
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
                  {dayEvents.length > 2 ? (
                    <span className="month-cal__event-more">
                      +{dayEvents.length - 2}
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
                <span className="month-cal__status-mark">{status === "present" ? "✓" : "✗"}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

