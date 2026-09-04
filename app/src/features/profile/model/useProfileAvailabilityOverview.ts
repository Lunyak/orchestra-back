import { useEffect, useMemo, useState } from "react";
import {
  projectAvailabilityPath,
  studioAvailabilityPath,
  theaterAvailabilityPath,
} from "../../../app/router/paths";
import { useGlobalDashboardQuery } from "../../global-dashboard/api/dashboard-api";
import { useListStudiosQuery } from "../../studio";
import { fetchTheaters } from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import type { AvailabilityStatus, AvailabilityTimeRange } from "./availability-calendar";
import {
  countMonthAvailabilityPulse,
  countSessionsForContext,
  type OccupancyContextCard,
} from "./availability-overview";
import {
  loadSessionsForRangeThunk,
  profileAvailabilityActions,
  selectAvailabilityFlags,
  selectAvailabilitySessionsForActiveRange,
  selectProfileCalendarState,
} from "./profileAvailabilitySlice";
import {
  fetchMyProfileThunk,
  selectProfileForm,
} from "./profileDataSlice";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";

export function useProfileAvailabilityOverview() {
  const { accessToken } = useAuth();
  const dispatch = useAppDispatch();
  const form = useAppSelector(selectProfileForm);
  const availabilityCalendar = (form.availabilityCalendar ?? {}) as Record<
    string,
    AvailabilityStatus
  >;
  const availabilityTimeRanges = (form.availabilityTimeRanges ?? {}) as Record<
    string,
    AvailabilityTimeRange[]
  >;
  const calendarState = useAppSelector(selectProfileCalendarState);
  const sessions = useAppSelector(selectAvailabilitySessionsForActiveRange);
  const flags = useAppSelector(selectAvailabilityFlags);
  const dashboardQuery = useGlobalDashboardQuery(undefined, {
    skip: !accessToken,
  });
  const studiosQuery = useListStudiosQuery(undefined, { skip: !accessToken });
  const [theaters, setTheaters] = useState<Array<{ id: string; title: string }>>(
    [],
  );
  const [theatersLoading, setTheatersLoading] = useState(false);
  const [theatersError, setTheatersError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchMyProfileThunk({ accessToken }));
  }, [accessToken, dispatch]);

  useEffect(() => {
    if (!accessToken) return;
    dispatch(profileAvailabilityActions.clearAvailabilityError());
    dispatch(
      loadSessionsForRangeThunk({
        accessToken,
        fromIso: calendarState.fromIso,
        toIso: calendarState.toIso,
      }),
    );
  }, [accessToken, calendarState.fromIso, calendarState.toIso, dispatch]);

  useEffect(() => {
    if (!accessToken) {
      setTheaters([]);
      return;
    }
    let cancelled = false;
    setTheatersLoading(true);
    setTheatersError(null);
    fetchTheaters(accessToken)
      .then((items) => {
        if (cancelled) return;
        setTheaters(
          items.map((item) => ({
            id: item.id,
            title: item.title,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setTheatersError("Не удалось загрузить театры");
      })
      .finally(() => {
        if (!cancelled) setTheatersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const pulse = useMemo(
    () =>
      countMonthAvailabilityPulse(
        availabilityCalendar,
        availabilityTimeRanges,
        calendarState.monthStartIso,
      ),
    [
      availabilityCalendar,
      availabilityTimeRanges,
      calendarState.monthStartIso,
    ],
  );

  const contexts = useMemo<OccupancyContextCard[]>(() => {
    const theaterCards: OccupancyContextCard[] = theaters.map((theater) => ({
      id: theater.id,
      kind: "theater",
      title: theater.title,
      href: theaterAvailabilityPath(theater.id),
      sessionCount: countSessionsForContext(sessions, "theater", theater.id),
    }));
    const projectCards: OccupancyContextCard[] = (
      dashboardQuery.data?.projects ?? []
    ).map((project) => ({
      id: project.slug,
      kind: "project",
      title: project.name,
      href: projectAvailabilityPath(project.slug),
      sessionCount: countSessionsForContext(sessions, "project", project.slug),
    }));
    const studioCards: OccupancyContextCard[] = (
      studiosQuery.data?.studios ?? []
    ).map((studio) => ({
      id: studio.id,
      kind: "studio",
      title: studio.title,
      href: studioAvailabilityPath(studio.id),
      sessionCount: 0,
      studioImageUrl: studio.imageUrl,
    }));
    return [...theaterCards, ...projectCards, ...studioCards].sort((left, right) =>
      left.title.localeCompare(right.title, "ru"),
    );
  }, [
    dashboardQuery.data?.projects,
    sessions,
    studiosQuery.data?.studios,
    theaters,
  ]);

  const contextsLoading =
    theatersLoading || dashboardQuery.isLoading || studiosQuery.isLoading;
  const contextsError =
    theatersError ||
    (dashboardQuery.isError ? "Не удалось загрузить проекты" : null) ||
    (studiosQuery.isError ? "Не удалось загрузить студии" : null);

  return {
    accessToken,
    availabilityCalendar,
    availabilityTimeRanges,
    calendarState,
    contexts,
    contextsError,
    contextsLoading,
    dispatch,
    flags,
    pulse,
    sessions,
  };
}
