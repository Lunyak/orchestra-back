import {
  CalendarSection,
  type CalendarSectionState,
} from "@shared/components/calendar/CalendarSection";
import type { MonthCalendarEvent } from "@shared/components/calendar/MonthCalendar";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";

type TheaterRehearsalsCalendarColumnProps = {
  theaterId: string;
  dotsByDate: Record<string, number>;
  eventsByDate: Record<string, MonthCalendarEvent[]>;
  onStateChange: (state: CalendarSectionState) => void;
};

export function TheaterRehearsalsCalendarColumn({
  theaterId,
  dotsByDate,
  eventsByDate,
  onStateChange,
}: TheaterRehearsalsCalendarColumnProps) {
  const storageMonthKey = `theater-${theaterId}-rehearsals-month`;

  return (
    <div className="sessions-flow">
      <RehearsalsCard className="sessions-calendar-card">
        <CalendarSection
          className="sessions-calendar"
          storageMonthKey={storageMonthKey}
          onStateChange={onStateChange}
          dotsByDate={dotsByDate}
          eventsByDate={eventsByDate}
          title=""
          subtitle=""
        />
      </RehearsalsCard>
    </div>
  );
}
