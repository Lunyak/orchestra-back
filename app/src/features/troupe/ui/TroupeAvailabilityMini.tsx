import { PageLoader } from "@shared/components/page-loader/PageLoader";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useEffect, useMemo } from "react";
import { sortMineFirst } from "../../profile/model/availability-calendar";
import { useScheduleAvailability } from "../../profile/model/useScheduleAvailability";
import { monthKey } from "../model/troupe-page-utils";
import { useScheduleRowSelection } from "../model/useScheduleRowSelection";
import { useTroupePage } from "../model/useTroupePage";
import { TroupeAvailabilityScheduleGrid } from "./TroupeAvailabilityScheduleGrid";
import "../../../pages/troupe/style.css";

dayjs.locale("ru");

type TroupeAvailabilityMiniProps = {
  monthDate?: Date | null;
  selectedDateIso?: string | null;
  onSelectDate?: (dayIso: string) => void;
};

export function TroupeAvailabilityMini({
  monthDate,
  selectedDateIso,
  onSelectDate,
}: TroupeAvailabilityMiniProps) {
  const {
    accessToken,
    currentMonth,
    days,
    error,
    guestTroupeMembers,
    loading,
    regularTroupeMembers,
    scheduleRefreshing,
    setCurrentMonth,
    todayIso,
  } = useTroupePage();
  const availability = useScheduleAvailability(accessToken);

  useEffect(() => {
    if (!monthDate) return;
    const next = dayjs(monthDate).startOf("month");
    const nextKey = next.format("YYYY-MM");
    setCurrentMonth((prev) =>
      monthKey(prev) === nextKey ? prev : next.toDate(),
    );
  }, [monthDate, setCurrentMonth]);

  const members = useMemo(
    () => [
      ...sortMineFirst(regularTroupeMembers, availability.myEmail),
      ...sortMineFirst(guestTroupeMembers, availability.myEmail),
    ],
    [availability.myEmail, guestTroupeMembers, regularTroupeMembers],
  );
  const { selectedMemberIds, toggleMemberId, clearMemberSelection } =
    useScheduleRowSelection(members);
  const currentMonthKey = monthKey(currentMonth);

  if (!accessToken) return null;

  return (
    <div className="theater-rehearsals-page__availability">
      {loading ? (
        <PageLoader variant="view" label="Загрузка занятости…" />
      ) : (
        <TroupeAvailabilityScheduleGrid
          members={members}
          emptyText="В труппе пока никого нет."
          ariaLabel="График занятости труппы"
          gridDays={days}
          currentMonthKey={currentMonthKey}
          peekStartIso={null}
          todayIso={todayIso}
          selectedMemberIds={selectedMemberIds}
          onToggleMemberId={toggleMemberId}
          onClearMemberSelection={clearMemberSelection}
          availability={availability}
          scheduleRefreshing={scheduleRefreshing}
          compact
          readOnly
          selectedDateIso={selectedDateIso}
          onSelectDate={onSelectDate}
        />
      )}

      {error ? <div className="troupe-error">{error}</div> : null}
    </div>
  );
}
