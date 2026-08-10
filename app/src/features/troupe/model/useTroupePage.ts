import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useInviteProjectMemberMutation } from "../../project/api/project-api";
import { useProject } from "../../project";
import { useTeam } from "../../team";
import { useAuth } from "../../auth/model/auth-context";
import type { OrchestraQueryError } from "../../../shared/api/rtk/axios-base-query";
import {
  useAddTeamMemberMutation,
  useAddTroupeMemberMutation,
  useMyTroupeQuery,
  useTheaterHomeTroupeQuery,
  useProjectParticipantsQuery,
  useRemoveTeamMemberMutation,
  usePatchTroupeTitleMutation,
  useRemoveTroupeMemberMutation,
  useUpdateTroupeMemberKindMutation,
  useUpdateTeamMemberMutation,
  type ProjectCastMemberItem,
  type TeamMemberItem,
  type TeamMemberRole,
  type TroupeMemberKind,
  type TroupeMemberItem,
} from "../api/troupe-api";
import { currentMonthStart, monthKey } from "./troupe-page-utils";

function queryErrorMessage(error: unknown, fallback: string): string {
  const e = error as OrchestraQueryError | undefined;
  const dataMessage =
    e?.data && typeof e.data === "object" && "message" in e.data
      ? (e.data as { message?: unknown }).message
      : null;
  return String(dataMessage ?? e?.message ?? fallback);
}

function queryErrorStatus(error: unknown): number | undefined {
  const e = error as OrchestraQueryError | undefined;
  return typeof e?.status === "number" ? e.status : undefined;
}

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function normalizeTroupeMemberKind(kind: unknown): TroupeMemberKind {
  return kind === "guest" ? "guest" : "regular";
}

export type TroupePageTab = "team" | "troupe" | "project";

function readInitialTroupeTab(locationState: unknown): TroupePageTab {
  const tab = (locationState as { tab?: unknown } | null)?.tab;
  if (tab === "team" || tab === "troupe" || tab === "project") {
    return tab;
  }
  return "troupe";
}

export const TEAM_MEMBER_ROLE_OPTIONS: Array<{
  value: TeamMemberRole;
  label: string;
}> = [
  { value: "actor", label: "Актёр" },
  { value: "director", label: "Режиссёр" },
  { value: "accountant", label: "Бухгалтер" },
  { value: "artist", label: "Художник" },
  { value: "producer", label: "Продюсер" },
  { value: "smm", label: "SMM" },
  { value: "assistant_director", label: "Пом. реж." },
  { value: "troupe_manager", label: "Зав. труппой" },
];

export type TroupePageViewModel = ReturnType<typeof useTroupePage>;

export function useTroupePage() {
  const location = useLocation();
  const { theaterId = "" } = useParams();
  const { accessToken } = useAuth();
  const {
    onProjectChange,
    projectName,
    projectItems,
    currentProjectDisplayName,
    projects,
    isProjectsLoaded,
    projectsLoading,
  } = useProject();
  const {
    canManageProjectMembers,
    projectMembers,
    projectMembersLoading,
    projectOwner,
    refreshMembers,
  } = useTeam();

  const [titleDraft, setTitleDraft] = useState("");
  const [email, setEmail] = useState("");
  const [teamEmail, setTeamEmail] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TroupePageTab>(() =>
    readInitialTroupeTab(location.state),
  );

  useEffect(() => {
    const nextTab = readInitialTroupeTab(location.state);
    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [location.key, location.state]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    currentMonthStart(),
  );
  const [invitingIds, setInvitingIds] = useState<Record<string, boolean>>({});
  const [inviteErrorByMemberId, setInviteErrorByMemberId] = useState<
    Record<string, string>
  >({});
  const [removingIds, setRemovingIds] = useState<Record<string, boolean>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const [patchTitleError, setPatchTitleError] = useState<string | null>(null);

  const month = monthKey(currentMonth);
  const skipFetch = !accessToken;
  const hasTheaterContext = Boolean(theaterId);

  const myTroupeQuery = useMyTroupeQuery(
    { month },
    { skip: skipFetch || hasTheaterContext },
  );
  const theaterTroupeQuery = useTheaterHomeTroupeQuery(
    { theaterId, month },
    { skip: skipFetch || !hasTheaterContext },
  );
  const data = hasTheaterContext ? theaterTroupeQuery.data : myTroupeQuery.data;
  const fetchError = hasTheaterContext
    ? theaterTroupeQuery.error
    : myTroupeQuery.error;
  const loading = hasTheaterContext
    ? theaterTroupeQuery.isLoading
    : myTroupeQuery.isLoading;
  const isFetching = hasTheaterContext
    ? theaterTroupeQuery.isFetching
    : myTroupeQuery.isFetching;
  const refetchTroupe = hasTheaterContext
    ? theaterTroupeQuery.refetch
    : myTroupeQuery.refetch;
  const {
    data: projectParticipantsData,
    isLoading: projectParticipantsLoading,
    refetch: refetchProjectParticipants,
  } = useProjectParticipantsQuery(
    { project: projectName, month },
    {
      skip:
        !accessToken || !projectName || !isProjectsLoaded || projectsLoading,
    },
  );

  const troupe = data?.troupe ?? null;
  const troupeMembers = useMemo<TroupeMemberItem[]>(
    () =>
      (data?.members ?? []).map((member) => ({
        ...member,
        kind: normalizeTroupeMemberKind(member.kind),
      })),
    [data?.members],
  );
  const teamMembers = useMemo<TeamMemberItem[]>(
    () => data?.teamMembers ?? [],
    [data?.teamMembers],
  );
  const projectCastMembers = useMemo<ProjectCastMemberItem[]>(
    () => projectParticipantsData?.members ?? [],
    [projectParticipantsData?.members],
  );
  const members = troupeMembers;
  const regularTroupeMembers = useMemo(
    () => troupeMembers.filter((member) => member.kind !== "guest"),
    [troupeMembers],
  );
  const guestTroupeMembers = useMemo(
    () => troupeMembers.filter((member) => member.kind === "guest"),
    [troupeMembers],
  );
  const scheduleRefreshing = isFetching && !loading && troupe != null;
  const error = fetchError
    ? queryErrorMessage(fetchError, "Не удалось загрузить труппу")
    : null;

  const [addTroupeMemberMut, { isLoading: adding }] =
    useAddTroupeMemberMutation();
  const [removeTroupeMemberMut] = useRemoveTroupeMemberMutation();
  const [updateTroupeMemberKindMut] = useUpdateTroupeMemberKindMutation();
  const [patchTroupeTitleMut, { isLoading: patchingTitle }] =
    usePatchTroupeTitleMutation();
  const [addTeamMemberMut, { isLoading: addingTeamMember }] =
    useAddTeamMemberMutation();
  const [updateTeamMemberMut] = useUpdateTeamMemberMutation();
  const [removeTeamMemberMut] = useRemoveTeamMemberMutation();
  const [inviteProjectMemberMut] = useInviteProjectMemberMutation();

  useEffect(() => {
    if (troupe?.title != null) setTitleDraft(troupe.title);
  }, [troupe?.id, troupe?.title]);

  const days = useMemo(() => {
    const start = dayjs(currentMonth).startOf("month");
    const n = start.daysInMonth();
    return Array.from({ length: n }, (_v, i) => start.add(i, "day").toDate());
  }, [currentMonth]);

  const todayIso = dayjs().format("YYYY-MM-DD");

  useEffect(() => {
    setSelectedDayIso((prev) => {
      if (!prev) return null;
      return days.some((d) => dayjs(d).format("YYYY-MM-DD") === prev)
        ? prev
        : null;
    });
  }, [currentMonth, days]);

  const selectedMember = useMemo(
    () =>
      selectedMemberId
        ? (troupeMembers.find((m) => m.id === selectedMemberId) ?? null)
        : null,
    [selectedMemberId, troupeMembers],
  );

  const selectedMemberInProject = useMemo(() => {
    const email = normalizeEmail(selectedMember?.email);
    if (!email) return false;
    if (normalizeEmail(projectOwner?.email) === email) return true;
    return projectMembers.some(
      (member) => normalizeEmail(member.user.email) === email,
    );
  }, [projectMembers, projectOwner?.email, selectedMember?.email]);

  useEffect(() => {
    if (!selectedMemberId) return;
    if (!troupeMembers.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(null);
    }
  }, [selectedMemberId, troupeMembers]);

  const canManageTroupe = Boolean(accessToken);
  const canManageProjectTroupe = canManageProjectMembers === true;

  const saveTitle = useCallback(async () => {
    setPatchTitleError(null);
    try {
      await patchTroupeTitleMut({ title: titleDraft }).unwrap();
    } catch (e: unknown) {
      setPatchTitleError(queryErrorMessage(e, "Не удалось сохранить название"));
    }
  }, [patchTroupeTitleMut, titleDraft]);

  const inviteSelectedToProject = useCallback(async () => {
    if (!selectedMember || !projectName) return;
    const id = selectedMember.id;
    if (selectedMemberInProject) {
      setInviteErrorByMemberId((p) => ({
        ...p,
        [id]: "Этот человек уже есть в проекте.",
      }));
      return;
    }
    setInvitingIds((p) => ({ ...p, [id]: true }));
    setInviteErrorByMemberId((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    try {
      await inviteProjectMemberMut({
        projectSlug: projectName,
        email: selectedMember.email,
        role: "viewer",
      }).unwrap();
      void refetchProjectParticipants();
      void refreshMembers();
    } catch (e: unknown) {
      setInviteErrorByMemberId((p) => ({
        ...p,
        [id]:
          queryErrorStatus(e) === 409
            ? "Приглашение уже отправлено или человек уже в проекте."
            : queryErrorMessage(e, "Не удалось пригласить в проект"),
      }));
    } finally {
      setInvitingIds((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  }, [
    inviteProjectMemberMut,
    projectName,
    refetchProjectParticipants,
    refreshMembers,
    selectedMember,
    selectedMemberInProject,
  ]);

  const removeSelectedFromTroupe = useCallback(async () => {
    if (!selectedMember?.troupeMemberId) return;
    const memberId = selectedMember.troupeMemberId;
    setRemovingIds((p) => ({ ...p, [memberId]: true }));
    try {
      await removeTroupeMemberMut({
        memberId,
      }).unwrap();
    } catch (e: unknown) {
      alert(queryErrorMessage(e, "Не удалось удалить участника"));
    } finally {
      setRemovingIds((p) => {
        const next = { ...p };
        delete next[memberId];
        return next;
      });
    }
  }, [removeTroupeMemberMut, selectedMember?.troupeMemberId]);

  const updateSelectedTroupeMemberKind = useCallback(
    async (kind: TroupeMemberKind) => {
      if (!selectedMember?.troupeMemberId) return;
      try {
        await updateTroupeMemberKindMut({
          memberId: selectedMember.troupeMemberId,
          kind,
        }).unwrap();
      } catch (e: unknown) {
        alert(queryErrorMessage(e, "Не удалось обновить тип актёра"));
      }
    },
    [selectedMember?.troupeMemberId, updateTroupeMemberKindMut],
  );

  const addMemberByEmail = useCallback(async () => {
    const value = email.trim();
    if (!value) return;
    setAddError(null);
    try {
      await addTroupeMemberMut({ email: value }).unwrap();
      setEmail("");
    } catch (e: unknown) {
      setAddError(queryErrorMessage(e, "Не удалось отправить приглашение"));
    }
  }, [addTroupeMemberMut, email]);

  const addTeamMemberByEmail = useCallback(async () => {
    const value = teamEmail.trim();
    if (!value) return;
    setTeamError(null);
    try {
      await addTeamMemberMut({ email: value, roles: [] }).unwrap();
      setTeamEmail("");
    } catch (e: unknown) {
      setTeamError(
        queryErrorMessage(e, "Не удалось добавить участника команды"),
      );
    }
  }, [addTeamMemberMut, teamEmail]);

  const toggleTeamMemberRole = useCallback(
    async (member: TeamMemberItem, role: TeamMemberRole) => {
      const nextRoles = member.roles.includes(role)
        ? member.roles.filter((item) => item !== role)
        : [...member.roles, role];
      setTeamError(null);
      try {
        if (member.id.startsWith("team-fallback:")) {
          await addTeamMemberMut({
            email: member.email,
            roles: nextRoles,
          }).unwrap();
          void refetchTroupe();
          return;
        }
        await updateTeamMemberMut({
          memberId: member.id,
          roles: nextRoles,
        }).unwrap();
      } catch (e: unknown) {
        setTeamError(queryErrorMessage(e, "Не удалось обновить должности"));
      }
    },
    [addTeamMemberMut, refetchTroupe, updateTeamMemberMut],
  );

  const removeTeamMemberById = useCallback(
    async (memberId: string) => {
      if (memberId.startsWith("team-fallback:")) return;
      setTeamError(null);
      try {
        await removeTeamMemberMut({ memberId }).unwrap();
      } catch (e: unknown) {
        setTeamError(
          queryErrorMessage(e, "Не удалось удалить участника команды"),
        );
      }
    },
    [removeTeamMemberMut],
  );

  return {
    accessToken,
    activeTab,
    addingTeamMember,
    adding,
    addError,
    addMemberByEmail,
    addTeamMemberByEmail,
    canManageTroupe,
    canManageProjectTroupe,
    currentMonth,
    days,
    email,
    error,
    inviteErrorByMemberId,
    inviteSelectedToProject,
    invitingIds,
    loading,
    members,
    onProjectChange,
    patchTitleError,
    patchingTitle,
    projectName,
    projectItems,
    projectCastMembers,
    currentProjectDisplayName,
    projects,
    projectsLoading,
    projectMembersLoading: projectMembersLoading || projectParticipantsLoading,
    regularTroupeMembers,
    removeSelectedFromTroupe,
    removingIds,
    saveTitle,
    scheduleRefreshing,
    selectedDayIso,
    selectedMember,
    selectedMemberId,
    selectedMemberInProject,
    setCurrentMonth,
    setEmail,
    setActiveTab,
    setSelectedDayIso,
    setSelectedMemberId,
    setTeamEmail,
    setTitleDraft,
    teamEmail,
    teamError,
    teamMembers,
    teamRoleOptions: TEAM_MEMBER_ROLE_OPTIONS,
    titleDraft,
    toggleTeamMemberRole,
    todayIso,
    troupe,
    troupeMembers,
    guestTroupeMembers,
    updateSelectedTroupeMemberKind,
    removeTeamMemberById,
  };
}
