import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInviteProjectMemberMutation } from "../../project/api/project-api";
import { useProject } from "../../project";
import { useTeam } from "../../team";
import { useAuth } from "../../auth/model/auth-context";
import type { OrchestraQueryError } from "../../../shared/api/rtk/axios-base-query";
import {
  useAddTroupeMemberMutation,
  useMyTroupeQuery,
  usePatchTroupeTitleMutation,
  useRemoveTroupeMemberMutation,
} from "../api/troupe-api";
import {
  monthKey,
  readStoredTroupeMonth,
} from "./troupe-page-utils";

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
  return String(email ?? "").trim().toLowerCase();
}

export type TroupePageViewModel = ReturnType<typeof useTroupePage>;

export function useTroupePage() {
  const { accessToken } = useAuth();
  const {
    onProjectChange,
    projectName,
    projects,
    isProjectsLoaded,
    projectsLoading,
  } = useProject();
  const {
    isProjectOwner,
    projectMembers,
    projectMembersLoading,
    projectOwner,
  } = useTeam();

  const [titleDraft, setTitleDraft] = useState("");
  const [email, setEmail] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    readStoredTroupeMonth(),
  );
  const [invitingIds, setInvitingIds] = useState<Record<string, boolean>>({});
  const [inviteErrorByMemberId, setInviteErrorByMemberId] = useState<
    Record<string, string>
  >({});
  const [removingIds, setRemovingIds] = useState<Record<string, boolean>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const [patchTitleError, setPatchTitleError] = useState<string | null>(null);

  const month = monthKey(currentMonth);
  const skipFetch =
    !accessToken || !isProjectsLoaded || projectsLoading || !projectName;

  const {
    data,
    error: fetchError,
    isLoading: loading,
    isFetching,
  } = useMyTroupeQuery(
    { project: projectName, month },
    { skip: skipFetch },
  );

  const troupe = data?.troupe ?? null;
  const members = data?.members ?? [];
  const scheduleRefreshing = isFetching && !loading && troupe != null;
  const error = fetchError
    ? queryErrorMessage(fetchError, "Не удалось загрузить труппу")
    : null;

  const [addTroupeMemberMut, { isLoading: adding }] = useAddTroupeMemberMutation();
  const [removeTroupeMemberMut] = useRemoveTroupeMemberMutation();
  const [patchTroupeTitleMut, { isLoading: patchingTitle }] =
    usePatchTroupeTitleMutation();
  const [inviteProjectMemberMut] = useInviteProjectMemberMutation();

  useEffect(() => {
    if (troupe?.title != null) setTitleDraft(troupe.title);
  }, [troupe?.id, troupe?.title]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem("troupe-month", monthKey(currentMonth));
    } catch {
      // ignore
    }
  }, [currentMonth]);

  const days = useMemo(() => {
    const start = dayjs(currentMonth).startOf("month");
    const n = start.daysInMonth();
    return Array.from({ length: n }, (_v, i) => start.add(i, "day").toDate());
  }, [currentMonth]);

  const todayIso = dayjs().format("YYYY-MM-DD");

  useEffect(() => {
    setSelectedDayIso((prev) => {
      if (!prev) return null;
      return days.some((d) => dayjs(d).format("YYYY-MM-DD") === prev) ? prev : null;
    });
  }, [currentMonth, days]);

  const selectedMember = useMemo(
    () =>
      selectedMemberId
        ? (members.find((m) => m.id === selectedMemberId) ?? null)
        : null,
    [members, selectedMemberId],
  );

  const selectedMemberInProject = useMemo(() => {
    const email = normalizeEmail(selectedMember?.email);
    if (!email) return false;
    if (normalizeEmail(projectOwner?.email) === email) return true;
    return projectMembers.some((member) => normalizeEmail(member.user.email) === email);
  }, [projectMembers, projectOwner?.email, selectedMember?.email]);

  useEffect(() => {
    if (!selectedMemberId) return;
    if (!members.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(null);
    }
  }, [members, selectedMemberId]);

  const canManageProjectTroupe = isProjectOwner === true;

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
    } catch (e: unknown) {
      setInviteErrorByMemberId((p) => ({
        ...p,
        [id]:
          queryErrorStatus(e) === 409
            ? "Этот человек уже есть в проекте."
            : queryErrorMessage(e, "Не удалось добавить в проект"),
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
    selectedMember,
    selectedMemberInProject,
  ]);

  const removeSelectedFromTroupe = useCallback(async () => {
    if (!selectedMember?.troupeMemberId || !projectName) return;
    const memberId = selectedMember.troupeMemberId;
    setRemovingIds((p) => ({ ...p, [memberId]: true }));
    try {
      await removeTroupeMemberMut({
        project: projectName,
        memberId,
        month,
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
  }, [month, projectName, removeTroupeMemberMut, selectedMember?.troupeMemberId]);

  const addMemberByEmail = useCallback(async () => {
    const value = email.trim();
    if (!value || !projectName) return;
    setAddError(null);
    try {
      await addTroupeMemberMut({ project: projectName, email: value, month }).unwrap();
      setEmail("");
    } catch (e: unknown) {
      setAddError(queryErrorMessage(e, "Не удалось добавить участника"));
    }
  }, [addTroupeMemberMut, email, month, projectName]);

  return {
    accessToken,
    adding,
    addError,
    addMemberByEmail,
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
    projects,
    projectsLoading,
    projectMembersLoading,
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
    setSelectedDayIso,
    setSelectedMemberId,
    setTitleDraft,
    titleDraft,
    todayIso,
    troupe,
  };
}
