import { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { ProjectMemberInfo } from "../../../sync/api/projects";
import {
  useInviteProjectMemberMutation,
  useProjectAccessQuery,
  useProjectMembersQuery,
  useRemoveProjectMemberMutation,
  useTransferProjectOwnershipMutation,
  useUpdateProjectMemberRoleMutation,
} from "../../project/api/project-api";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../../project/model/project-context";
import { shouldLoadProjectMembers } from "./team-page-utils";

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
    isFetching: membersFetching,
    refetch: refetchMembers,
  } = useProjectMembersQuery(projectName, {
    skip: !accessToken || !projectName || !fetchMembers,
  });
  const { data: projectAccess, refetch: refetchAccess } = useProjectAccessQuery(
    projectName,
    {
      skip: !accessToken || !projectName || !fetchMembers,
    },
  );

  const [inviteProjectMember] = useInviteProjectMemberMutation();
  const [updateProjectMemberRoleMut] = useUpdateProjectMemberRoleMutation();
  const [removeProjectMemberMut] = useRemoveProjectMemberMutation();
  const [transferOwnershipMut] = useTransferProjectOwnershipMutation();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const projectMembers: ProjectMemberInfo[] = membersData?.members ?? [];
  const projectOwner = membersData?.owner ?? null;
  const isProjectOwner = projectAccess?.capabilities.owner ?? null;
  const canWriteProject = projectAccess?.capabilities.write ?? null;
  const canManageProjectMembers =
    projectAccess?.capabilities.manageMembers ?? null;

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
          (e?.status === 409
            ? "Приглашение уже отправлено"
            : "Не удалось отправить приглашение"),
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

  const transferOwnership = useCallback(
    async (userId: string) => {
      if (!accessToken || !projectName || !userId) return;
      if (
        !confirm(
          "Передать владение проектом выбранному участнику? Вы потеряете права владельца.",
        )
      )
        return;
      try {
        await transferOwnershipMut({
          projectSlug: projectName,
          userId,
        }).unwrap();
        await Promise.all([refetchMembers(), refetchAccess()]);
      } catch (err: unknown) {
        const e = err as { data?: { message?: string }; message?: string };
        alert(
          e?.data?.message ?? e?.message ?? "Не удалось передать владение",
        );
      }
    },
    [
      accessToken,
      projectName,
      refetchAccess,
      refetchMembers,
      transferOwnershipMut,
    ],
  );

  return {
    projectMembers,
    projectMembersLoading: membersFetching,
    projectOwner,
    isProjectOwner,
    canWriteProject,
    canManageProjectMembers,
    inviteEmail,
    setInviteEmail,
    inviteError,
    setInviteError,
    invite,
    refreshMembers,
    updateMemberRole,
    removeMember,
    transferOwnership,
  };
}
