import { useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import type { AvailabilityStatus, AvailabilityTimeRange } from "./availability-calendar";
import {
  saveMyProfileThunk,
  selectMyProfile,
  selectProfileDataFlags,
  selectProfileForm,
} from "./profileDataSlice";

export function useAvailabilityAutoSave(accessToken: string | null) {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectMyProfile);
  const form = useAppSelector(selectProfileForm);
  const profileFlags = useAppSelector(selectProfileDataFlags);
  const autoSaveBaselineRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  const availabilityCalendar = useMemo(
    () =>
      (form.availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>,
    [form.availabilityCalendar],
  );

  const availabilityTimeRanges = useMemo(
    () =>
      (form.availabilityTimeRanges ?? {}) as Record<
        string,
        AvailabilityTimeRange[]
      >,
    [form.availabilityTimeRanges],
  );

  const availabilitySignature = useMemo(
    () =>
      JSON.stringify({
        availabilityCalendar,
        availabilityTimeRanges,
      }),
    [availabilityCalendar, availabilityTimeRanges],
  );

  useEffect(() => {
    if (!accessToken) {
      autoSaveBaselineRef.current = null;
      if (autoSaveTimerRef.current != null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = null;
      return;
    }

    if (!profile?.email) return;

    if (autoSaveBaselineRef.current == null) {
      autoSaveBaselineRef.current = availabilitySignature;
      return;
    }

    if (availabilitySignature === autoSaveBaselineRef.current) return;

    if (autoSaveTimerRef.current != null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(async () => {
      if (!accessToken) return;
      if (profileFlags.saving) return;
      if (autoSaveBaselineRef.current == null) return;
      if (availabilitySignature === autoSaveBaselineRef.current) return;

      const res = await dispatch(saveMyProfileThunk({ accessToken }));
      if (saveMyProfileThunk.fulfilled.match(res)) {
        autoSaveBaselineRef.current = JSON.stringify({
          availabilityCalendar: res.payload.availabilityCalendar ?? {},
          availabilityTimeRanges: res.payload.availabilityTimeRanges ?? {},
        });
      }
    }, 800);

    return () => {
      if (autoSaveTimerRef.current != null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = null;
    };
  }, [
    accessToken,
    availabilitySignature,
    dispatch,
    profile?.email,
    profileFlags.saving,
  ]);

  return {
    availabilityCalendar,
    availabilityTimeRanges,
    saving: profileFlags.saving,
    error: profileFlags.error,
    ok: profileFlags.ok,
  };
}
