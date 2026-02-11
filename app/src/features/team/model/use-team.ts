import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  getProjectMembers,
  inviteToProject,
  removeProjectMember,
  updateProjectMemberRole,
  type ProjectMemberInfo,
} from "../../../sync/api";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../../project/model/project-context";

export function useTeam() {
  const location = useLocation();
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const [projectMembers, setProjectMembers] = useState<ProjectMemberInfo[]>([]);
  const [isProjectOwner, setIsProjectOwner] = useState<boolean | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (
      (location.pathname !== "/settings" && location.pathname !== "/board") ||
      !accessToken ||
      !projectName
    )
      return;
    setIsProjectOwner(null);
    getProjectMembers(accessToken, projectName)
      .then((res) => {
        setProjectMembers(res.members ?? []);
        setIsProjectOwner(true);
      })
      .catch((err: any) => {
        if (err?.response?.status === 403) {
          setIsProjectOwner(false);
          setProjectMembers([]);
        } else {
          setIsProjectOwner(true);
          setProjectMembers([]);
        }
      });
  }, [location.pathname, accessToken, projectName]);

  const refreshMembers = useCallback(async () => {
    if (!accessToken || !projectName) return;
    try {
      const res = await getProjectMembers(accessToken, projectName);
      setProjectMembers(res.members ?? []);
    } catch {
      setProjectMembers([]);
    }
  }, [accessToken, projectName]);

  const invite = useCallback(async () => {
    const email = inviteEmail.trim();
    if (!email || !accessToken || !projectName) return;
    setInviteError(null);
    try {
      await inviteToProject(accessToken, projectName, email);
      setInviteEmail("");
      const res = await getProjectMembers(accessToken, projectName);
      setProjectMembers(res.members ?? []);
    } catch (err: any) {
      setInviteError(
        err?.response?.data?.message ??
          (err?.response?.status === 404
            ? "Пользователь с таким email не найден"
            : "Не удалось пригласить")
      );
    }
  }, [accessToken, inviteEmail, projectName]);

  const updateMemberRole = useCallback(
    async (memberId: string, role: "editor" | "viewer") => {
      if (!accessToken || !projectName) return;
      try {
        await updateProjectMemberRole(accessToken, projectName, memberId, role);
        await refreshMembers();
      } catch (err: any) {
        alert(err?.response?.data?.message ?? "Не удалось изменить права");
      }
    },
    [accessToken, projectName, refreshMembers]
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!accessToken || !projectName) return;
      if (
        !confirm("Удалить участника из проекта? Он потеряет доступ к проекту.")
      )
        return;
      try {
        await removeProjectMember(accessToken, projectName, memberId);
        await refreshMembers();
      } catch (err: any) {
        alert(err?.response?.data?.message ?? "Не удалось удалить участника");
      }
    },
    [accessToken, projectName, refreshMembers]
  );

  return {
    projectMembers,
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
