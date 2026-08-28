import type { CalendarSectionState } from "@shared/components/calendar/CalendarSection";
import { CalendarSection } from "@shared/components/calendar/CalendarSection";
import type { MonthCalendarEvent } from "@shared/components/calendar/MonthCalendar";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";

type DirectorSessionsCalendarStageProps = {
  dotsByDate: Record<string, number>;
  eventsByDate: Record<string, MonthCalendarEvent[]>;
  onStateChange: (state: CalendarSectionState) => void;
  onDayClick: (dateKey: string) => void;
  onDayDoubleClick: (dateKey: string) => void;
};

export function DirectorSessionsCalendarStage({
  dotsByDate,
  eventsByDate,
  onStateChange,
  onDayClick,
  onDayDoubleClick,
}: DirectorSessionsCalendarStageProps) {
  return (
    <RehearsalsCard className="sessions-calendar-card">
      <CalendarSection
        className="sessions-calendar"
        storageMonthKey="director-sessions-calendar-month"
        onStateChange={onStateChange}
        dotsByDate={dotsByDate}
        eventsByDate={eventsByDate}
        onDayClick={onDayClick}
        onDayDoubleClick={onDayDoubleClick}
        title="Календарь сессий"
        subtitle="Клик — день · двойной клик — новая сессия"
      />
    </RehearsalsCard>
  );
}
