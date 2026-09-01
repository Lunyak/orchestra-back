import { useCallback, useEffect, useMemo, useState } from "react";
import type { TeamProfile } from "../../../sync/api/profile";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  normalizeAvailabilityEmail,
  type AvailabilityStatus,
  type AvailabilityTimeRange,
} from "./availability-calendar";
import { useAvailabilityAutoSave } from "./useAvailabilityAutoSave";
import {
  fetchMyProfileThunk,
  profileDataActions,
  selectMyProfile,
} from "./profileDataSlice";

export function useScheduleAvailability(accessToken: string | null) {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectMyProfile);
  const [editingDateIso, setEditingDateIso] = useState<string | null>(null);
  const {
    availabilityCalendar,
    availabilityTimeRanges,
    saving,
    error,
    ok,
  } = useAvailabilityAutoSave(accessToken);

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchMyProfileThunk({ accessToken }));
  }, [accessToken, dispatch]);

  const myEmail = useMemo(
    () => normalizeAvailabilityEmail(profile?.email) || null,
    [profile?.email],
  );

  const isMine = useCallback(
    (email: string | null | undefined) => {
      if (!myEmail) return false;
      return normalizeAvailabilityEmail(email) === myEmail;
    },
    [myEmail],
  );

  const resolveDayAvailability = useCallback(
    (
      email: string | null | undefined,
      calendar: TeamProfile["availabilityCalendar"],
      ranges: TeamProfile["availabilityTimeRanges"],
    ): {
      calendar: Record<string, AvailabilityStatus>;
      ranges: Record<string, AvailabilityTimeRange[]>;
    } => {
      if (isMine(email)) {
        return {
          calendar: availabilityCalendar,
          ranges: availabilityTimeRanges,
        };
      }
      return {
        calendar: (calendar ?? {}) as Record<string, AvailabilityStatus>,
        ranges: (ranges ?? {}) as Record<string, AvailabilityTimeRange[]>,
      };
    },
    [availabilityCalendar, availabilityTimeRanges, isMine],
  );

  const applyRangeStatus = useCallback(
    (fromDate: string, toDate: string, status: AvailabilityStatus | null) => {
      dispatch(
        profileDataActions.setAvailabilityRangeStatus({
          fromDate,
          toDate,
          status,
        }),
      );
    },
    [dispatch],
  );

  const applyRangeTimeWindow = useCallback(
    (
      fromDate: string,
      toDate: string,
      range: AvailabilityTimeRange,
    ) => {
      dispatch(
        profileDataActions.setTimeRangesForDateRange({
          fromDate,
          toDate,
          range,
        }),
      );
    },
    [dispatch],
  );

  const openDayEditor = useCallback((dateIso: string) => {
    setEditingDateIso(dateIso);
  }, []);

  const closeDayEditor = useCallback(() => {
    setEditingDateIso(null);
  }, []);

  return {
    myEmail,
    isMine,
    resolveDayAvailability,
    applyRangeStatus,
    applyRangeTimeWindow,
    openDayEditor,
    closeDayEditor,
    editingDateIso,
    saving,
    error,
    ok,
  };
}
