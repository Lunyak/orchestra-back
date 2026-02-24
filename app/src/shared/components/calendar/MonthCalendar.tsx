import { useMemo } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/ru";

dayjs.extend(isoWeek);
dayjs.locale("ru");

export type MonthCalendarStatus = "present" | "absent";

function isoYmd(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

function addMonths(base: Date, months: number): Date {
  return dayjs(base).add(months, "month").toDate();
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
  title,
  subtitle,
  weekDayLabels,
}: {
  currentMonth: Date;
  selectedDate: string;
  onChangeMonth: (next: Date) => void;
  onSelectDate: (isoYmd: string) => void;
  onDayClick?: (isoYmd: string) => void;
  statusByDate?: Record<string, MonthCalendarStatus | undefined>;
  dotsByDate?: Record<string, number | undefined>;
  title?: string;
  subtitle?: string;
  weekDayLabels?: string[];
}) {
  const labels = weekDayLabels ?? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const todayIso = useMemo(() => isoYmd(new Date()), []);
  const calendarDays = useMemo(
    () => getMonthCalendarDays(currentMonth),
    [currentMonth],
  );

  return (
    <div>
      {(title || subtitle) && (
        <div style={{ marginBottom: 10 }}>
          {title && (
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{ margin: 0, opacity: 0.75, fontSize: 12 }}>
              {subtitle}
            </div>
          )}
        </div>
      )}

      {/* Навигация по месяцам */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={() => onChangeMonth(addMonths(currentMonth, -1))}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.14)",
            background: "rgba(255, 255, 255, 0.04)",
            color: "inherit",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          ← Назад
        </button>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {dayjs(currentMonth).format("MMMM YYYY")}
        </div>
        <button
          type="button"
          onClick={() => onChangeMonth(addMonths(currentMonth, 1))}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.14)",
            background: "rgba(255, 255, 255, 0.04)",
            color: "inherit",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Вперед →
        </button>
      </div>

      {/* Заголовки дней недели */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 6,
          marginBottom: 6,
        }}
      >
        {labels.map((day) => (
          <div
            key={day}
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 600,
              opacity: 0.6,
              padding: "4px 0",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Сетка календаря */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 6,
        }}
      >
        {calendarDays.map((dateObj) => {
          const date = isoYmd(dateObj);
          const status = statusByDate?.[date];
          const dots = Math.max(0, Number(dotsByDate?.[date] ?? 0) || 0);
          const active = date === selectedDate;
          const isCurrentMonth =
            dayjs(dateObj).month() === dayjs(currentMonth).month();
          const isToday = date === todayIso;

          const baseBg =
            status === "present"
              ? "rgba(96, 255, 140, 0.15)"
              : status === "absent"
                ? "rgba(255, 120, 120, 0.16)"
                : "rgba(255, 255, 255, 0.04)";

          return (
            <button
              key={date}
              type="button"
              onClick={() => {
                onSelectDate(date);
                onDayClick?.(date);
              }}
              title={date}
              style={{
                borderRadius: 8,
                border: active
                  ? "2px solid rgba(120, 180, 255, 0.8)"
                  : isToday
                    ? "2px solid rgba(120, 180, 255, 0.4)"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                padding: "6px 4px",
                background: baseBg,
                color: isCurrentMonth
                  ? "inherit"
                  : "rgba(255, 255, 255, 0.3)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                minHeight: 50,
                position: "relative",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 600 }}>
                {dayjs(dateObj).date()}
              </div>
              {dots > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 2,
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  {Array.from({ length: Math.min(dots, 3) }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "rgba(120, 180, 255, 0.8)",
                      }}
                    />
                  ))}
                </div>
              )}
              {status && (
                <div
                  style={{
                    fontSize: 9,
                    opacity: 0.7,
                    position: "absolute",
                    bottom: 2,
                  }}
                >
                  {status === "present" ? "✓" : "✗"}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

