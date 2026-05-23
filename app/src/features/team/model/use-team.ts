import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { ProjectMemberInfo } from "../../../sync/api/projects";
import {
  useInviteProjectMemberMutation,
  useProjectMembersQuery,
  useRemoveProjectMemberMutation,
  useUpdateProjectMemberRoleMutation,
} from "../../project/api/project-api";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../../project/model/project-context";
import type { OrchestraQueryError } from "../../../shared/api/rtk/axios-base-query";
import { shouldLoadProjectMembers } from "./team-page-utils";

function membersQueryStatus(error: unknown): number | undefined {
  const e = error as OrchestraQueryError | undefined;
  return typeof e?.status === "number" ? e.status : undefined;
}

export function useTeam() {
  const location = useLocation();
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const fetchMembers = useMemo(
    () => shouldLoadProjectMembers(location.pathname),
    [location.pathname],
  );

  const {
    data: membersData,
    error: membersError,
    isFetching: membersFetching,
    refetch: refetchMembers,
  } = useProjectMembersQuery(projectName, {
    skip: !accessToken || !projectName || !fetchMembers,
  });

  const [inviteProjectMember] = useInviteProjectMemberMutation();
  const [updateProjectMemberRoleMut] = useUpdateProjectMemberRoleMutation();
  const [removeProjectMemberMut] = useRemoveProjectMemberMutation();

  const [isProjectOwner, setIsProjectOwner] = useState<boolean | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!fetchMembers) return;
    if (membersFetching) return;
    if (membersData) {
      setIsProjectOwner(true);
      return;
    }
    if (membersQueryStatus(membersError) === 403) {
      setIsProjectOwner(false);
      return;
    }
    if (membersError) {
      setIsProjectOwner(true);
    }
  }, [fetchMembers, membersData, membersError, membersFetching]);

  const projectMembers: ProjectMemberInfo[] = membersData?.members ?? [];
  const projectOwner = membersData?.owner ?? null;

  const refreshMembers = useCallback(async () => {
    if (!accessToken || !projectName || !fetchMembers) return;
    await refetchMembers();
  }, [accessToken, fetchMembers, projectName, refetchMembers]);

  const invite = useCallback(async () => {
    const email = inviteEmail.trim();
    if (!email || !accessToken || !projectName) return;
    setInviteError(null);
    try {
      await inviteProjectMember({ projectSlug: projectName, email }).unwrap();
      setInviteEmail("");
    } catch (err: unknown) {
      const e = err as {
        status?: number;
        data?: { message?: string };
        message?: string;
      };
      setInviteError(
        e?.data?.message ??
          (e?.status === 404
            ? "Пользователь с таким email не найден"
            : "Не удалось пригласить"),
      );
    }
  }, [accessToken, inviteEmail, inviteProjectMember, projectName]);

  const updateMemberRole = useCallback(
    async (memberId: string, role: "editor" | "viewer") => {
      if (!accessToken || !projectName) return;
      try {
        await updateProjectMemberRoleMut({
          projectSlug: projectName,
          memberId,
          role,
        }).unwrap();
      } catch (err: unknown) {
        const e = err as { data?: { message?: string }; message?: string };
        alert(e?.data?.message ?? e?.message ?? "Не удалось изменить права");
      }
    },
    [accessToken, projectName, updateProjectMemberRoleMut],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!accessToken || !projectName) return;
      if (
        !confirm("Удалить участника из проекта? Он потеряет доступ к проекту.")
      )
        return;
      try {
        await removeProjectMemberMut({
          projectSlug: projectName,
          memberId,
        }).unwrap();
      } catch (err: unknown) {
        const e = err as { data?: { message?: string }; message?: string };
        alert(e?.data?.message ?? e?.message ?? "Не удалось удалить участника");
      }
    },
    [accessToken, projectName, removeProjectMemberMut],
  );

  return {
    projectMembers,
    projectOwner,
    isProjectOwner,
    inviteEmail,
    setInviteEmail,
    inviteError,
    setInviteError,
    invite,
    refreshMembers,
    updateMemberRole,
    removeMember,
  };
}
