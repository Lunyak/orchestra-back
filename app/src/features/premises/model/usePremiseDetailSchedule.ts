import dayjs from "dayjs";
import { useMemo } from "react";
import type { PremiseSlotItem, PremiseSummary } from "../../../sync/api/premises";
import { calculateFreeIntervals } from "./premise-detail-helpers";
import { slotDotsByDate, slotsForDay } from "./premise-utils";

export function usePremiseDetailSchedule(input: {
  premise: PremiseSummary | undefined;
  slots: PremiseSlotItem[];
  selectedDate: string;
}) {
  const { premise, slots, selectedDate } = input;
  const calendarSelectedDateLabel = dayjs(selectedDate).format("D MMMM YYYY");

  const daySlots = useMemo(
    () => slotsForDay(slots, selectedDate),
    [slots, selectedDate],
  );
  const selectedWorkingDay = premise?.weeklyAvailability?.find(
    (day) => day.weekday === dayjs(selectedDate).day(),
  );
  const freeIntervals = useMemo(
    () => calculateFreeIntervals(selectedDate, selectedWorkingDay, daySlots),
    [daySlots, selectedDate, selectedWorkingDay],
  );
  const dots = useMemo(() => slotDotsByDate(slots), [slots]);

  return {
    calendarSelectedDateLabel,
    daySlots,
    selectedWorkingDay,
    freeIntervals,
    dots,
  };
}
