import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/model/auth-context";
import { useProject } from "../project";
import {
  projectApi,
  useDeleteProjectRoleMutation,
  useSetProjectRoleAssignmentsMutation,
  useUpdateProjectRoleMutation,
} from "../project/api/project-api";
import { RoleAvatarEditor } from "../role-card/RoleAvatarEditor";
import { Button } from "../../shared/core/button/Button";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import type { OrchestraQueryError } from "../../shared/api/rtk/axios-base-query";
import { useAppDispatch } from "../../shared/store/hooks";
import type { ProjectRoleInfo } from "../../sync/api/projects";
import type { KanbanStepRolesAdminMember } from "./KanbanStepRolesAdminPanel";
import { normalizeActorEmail } from "./kanbanStepCastDisplay";
import "./KanbanStepRoleDetailPanel.css";

function memberLabel(m: KanbanStepRolesAdminMember): {
  firstLine: string;
  secondLine: string | null;
  title: string;
} {
  const p = m.profile ?? null;
  const firstName = String(p?.firstName ?? "").trim();
  const lastName = String(p?.lastName ?? "").trim();
  if (firstName || lastName) {
    const firstLine = firstName || lastName;
    const secondLine = firstName && lastName ? lastName : null;
    return {
      firstLine,
      secondLine,
      title: [firstName, lastName].filter(Boolean).join(" "),
    };
  }
  const display = String(p?.displayName ?? "").trim();
  if (display) return { firstLine: display, secondLine: null, title: display };
  return { firstLine: "Участник", secondLine: null, title: "Участник" };
}

function mutationErrorMessage(e: unknown, fallback: string): string {
  const err = e as OrchestraQueryError | undefined;
  return String(err?.message ?? fallback);
}

export type KanbanStepRoleDetailPanelProps = {
  projectName: string;
  role: ProjectRoleInfo;
  projectRoles: ProjectRoleInfo[];
  members: KanbanStepRolesAdminMember[];
  onDeleted: () => void;
};

export function KanbanStepRoleDetailPanel({
  projectName,
  role,
  projectRoles,
  members,
  onDeleted,
}: KanbanStepRoleDetailPanelProps) {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const { ensureRemoteProject } = useProject();
  const [remoteProjectId, setRemoteProjectId] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState(String(role.description ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [savingDescription, setSavingDescription] = useState(false);

  const [setRoleAssignments, { isLoading: assigning }] =
    useSetProjectRoleAssignmentsMutation();
  const [updateProjectRole, { isLoading: updatingRole }] = useUpdateProjectRoleMutation();
  const [deleteProjectRole, { isLoading: deleting }] = useDeleteProjectRoleMutation();

  const busy = assigning || updatingRole || deleting || savingDescription;

  useEffect(() => {
    setDescriptionDraft(String(role.description ?? ""));
  }, [role.description, role.id]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void ensureRemoteProject(accessToken).then((id) => {
      if (!cancelled) setRemoteProjectId(id || null);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, ensureRemoteProject]);

  const patchRolesCache = useCallback(
    (roles: ProjectRoleInfo[]) => {
      dispatch(
        projectApi.util.updateQueryData("projectRoles", projectName, (draft) => {
          draft.roles = roles;
        }),
      );
    },
    [dispatch, projectName],
  );

  const toggleAssignment = async (email: string) => {
    if (!accessToken) return;
    const cur = new Set((role.emails ?? []).map(normalizeActorEmail).filter(Boolean));
    const e = normalizeActorEmail(email);
    if (!e) return;
    if (cur.has(e)) cur.delete(e);
    else cur.add(e);
    const nextEmails = Array.from(cur).sort();
    const nextRoles = projectRoles.map((r) =>
      r.id === role.id ? { ...r, emails: nextEmails } : r,
    );
    patchRolesCache(nextRoles);
    try {
      await setRoleAssignments({
        projectSlug: projectName,
        roleId: role.id,
        emails: nextEmails,
      }).unwrap();
    } catch {
      dispatch(
        projectApi.util.invalidateTags([{ type: "ProjectRoles", id: projectName }]),
      );
    }
  };

  const saveDescription = async () => {
    if (!accessToken) return;
    const next = descriptionDraft.trim();
    const prev = String(role.description ?? "").trim();
    if (next === prev) return;
    setError(null);
    setSavingDescription(true);
    try {
      await updateProjectRole({
        projectSlug: projectName,
        roleId: role.id,
        title: role.title,
        description: next,
      }).unwrap();
      patchRolesCache(
        projectRoles.map((r) =>
          r.id === role.id ? { ...r, description: next || null } : r,
        ),
      );
    } catch (e: unknown) {
      setError(mutationErrorMessage(e, "Не удалось сохранить описание"));
    } finally {
      setSavingDescription(false);
    }
  };

  const deleteRole = async () => {
    if (!accessToken) return;
    const ok =
      typeof window !== "undefined"
        ? window.confirm(`Удалить роль “${role.title}”?`)
        : true;
    if (!ok) return;
    setError(null);
    try {
      await deleteProjectRole({ projectSlug: projectName, roleId: role.id }).unwrap();
      onDeleted();
    } catch {
      setError("Не удалось удалить роль");
    }
  };

  return (
    <div className="kanban-role-detail">
      {error ? <div className="kanban-role-detail__error">{error}</div> : null}

      <div className="kanban-role-detail__top">
        <section className="kanban-role-detail__section kanban-role-detail__section_card">
          {remoteProjectId && accessToken ? (
            <RoleAvatarEditor
              accessToken={accessToken}
              projectId={remoteProjectId}
              role={role}
              canEdit
              busy={busy}
              onSaveAvatarKey={async (avatarKey) => {
                await updateProjectRole({
                  projectSlug: projectName,
                  roleId: role.id,
                  title: role.title,
                  avatarKey,
                }).unwrap();
                patchRolesCache(
                  projectRoles.map((r) => (r.id === role.id ? { ...r, avatarKey } : r)),
                );
              }}
            />
          ) : (
            <div className="kanban-role-detail__muted">Загрузка редактора портрета…</div>
          )}
        </section>

        <section className="kanban-role-detail__section kanban-role-detail__section_description">
          <div className="kanban-role-detail__section-title">Описание роли</div>
          <textarea
            className="kanban-role-detail__description native-text-input"
            rows={8}
            value={descriptionDraft}
            disabled={busy}
            placeholder="Кратко: кто этот персонаж, возраст, характер, заметки для актёра…"
            onChange={(e) => setDescriptionDraft(e.target.value)}
            onBlur={() => void saveDescription()}
          />
          <div className="kanban-role-detail__hint">
            Сохраняется автоматически при выходе из поля.
          </div>
        </section>
      </div>

      <section className="kanban-role-detail__section">
        <div className="kanban-role-detail__section-title">Кто играет</div>
        <div className="kanban-role-detail__assignments">
          {members.map((m) => {
            const email = m.email;
            const checked = (role.emails ?? [])
              .map(normalizeActorEmail)
              .includes(normalizeActorEmail(email));
            const label = memberLabel(m);
            return (
              <button
                key={email}
                type="button"
                className={`kanban-role-detail__actor-tile${
                  checked ? " kanban-role-detail__actor-tile_selected" : ""
                }`}
                disabled={busy}
                onClick={() => void toggleAssignment(email)}
                aria-pressed={checked}
                title={label.title}
              >
                <MiniAvatar
                  src={String(m.profile?.avatarUrl ?? "").trim() || null}
                  label={label.title}
                  size={42}
                />
                <span className="kanban-role-detail__actor-name">
                  <span>{label.firstLine}</span>
                  {label.secondLine ? <span>{label.secondLine}</span> : null}
                </span>
                {checked ? (
                  <span className="kanban-role-detail__actor-state">Играет</span>
                ) : null}
              </button>
            );
          })}
          {members.length === 0 ? (
            <div className="kanban-role-detail__muted">
              Список пуст — добавьте людей в «Труппу» или участников проекта
            </div>
          ) : null}
        </div>
      </section>

      <div className="kanban-role-detail__footer">
        <Button className="danger" type="button" disabled={busy} onClick={() => void deleteRole()}>
          Удалить роль
        </Button>
      </div>
    </div>
  );
}
