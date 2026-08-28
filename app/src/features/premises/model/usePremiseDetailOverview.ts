import { useMemo, useState } from "react";
import type { PremiseSlotItem } from "../../../sync/api/premises";
import {
  computeOccupiedDays,
  computeOccupiedHours,
  computeUnpaidAmountRub,
  filterActiveSlots,
  filterPendingSlots,
  filterTodaySlots,
  groupUpcomingSlots,
} from "./premise-detail-helpers";

export function usePremiseDetailOverview(slots: PremiseSlotItem[]) {
  const [expandedSlotIds, setExpandedSlotIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  function toggleSlotExpanded(slotId: string) {
    setExpandedSlotIds((current) => {
      const next = new Set(current);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }

  const activeSlots = useMemo(() => filterActiveSlots(slots), [slots]);
  const pendingSlots = useMemo(() => filterPendingSlots(slots), [slots]);
  const trackedSlotGroups = useMemo(
    () => groupUpcomingSlots(activeSlots),
    [activeSlots],
  );
  const hasTrackedSlots = trackedSlotGroups.length > 0;
  const todaySlots = useMemo(
    () => filterTodaySlots(activeSlots),
    [activeSlots],
  );
  const occupiedHours = computeOccupiedHours(activeSlots);
  const occupiedDays = computeOccupiedDays(activeSlots);
  const unpaidAmountRub = computeUnpaidAmountRub(activeSlots);

  return {
    expandedSlotIds,
    setExpandedSlotIds,
    toggleSlotExpanded,
    activeSlots,
    pendingSlots,
    trackedSlotGroups,
    hasTrackedSlots,
    todaySlots,
    occupiedHours,
    occupiedDays,
    unpaidAmountRub,
  };
}
