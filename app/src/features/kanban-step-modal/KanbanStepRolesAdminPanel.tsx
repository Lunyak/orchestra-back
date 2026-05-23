import cn from "classnames";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/model/auth-context";
import {
  projectApi,
  useCreateProjectRoleMutation,
  useDeleteProjectRoleMutation,
  useSetProjectRoleAssignmentsMutation,
} from "../project/api/project-api";
import { Button } from "../../shared/core/button/Button";
import { InlineTextField } from "../../shared/core/inline-text-field/InlineTextField";
import { LabeledCheckbox } from "../../shared/core/labeled-checkbox/LabeledCheckbox";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import type { OrchestraQueryError } from "../../shared/api/rtk/axios-base-query";
import { useAppDispatch } from "../../shared/store/hooks";
import type { ProjectRoleInfo } from "../../sync/api/projects";
import "./KanbanStepRolesAdminPanel.css";

export type KanbanStepRolesAdminMember = {
  email: string;
  profile: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

function normalizeEmail(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function memberLabel(m: KanbanStepRolesAdminMember): string {
  const p = m.profile ?? null;
  const display = String(p?.displayName ?? "").trim();
  if (display) return `${display} (${m.email})`;
  const full =
    `${String(p?.firstName ?? "").trim()} ${String(p?.lastName ?? "").trim()}`.trim();
  if (full) return `${full} (${m.email})`;
  return m.email;
}

function mutationErrorMessage(e: unknown, fallback: string): string {
  const err = e as OrchestraQueryError | undefined;
  return String(err?.message ?? fallback);
}

export type KanbanStepRolesAdminPanelProps = {
  projectName: string | null;
  projectRoles: ProjectRoleInfo[];
  members: KanbanStepRolesAdminMember[];
  missingSceneRoles: string[];
};

export function KanbanStepRolesAdminPanel({
  projectName,
  projectRoles,
  members,
  missingSceneRoles,
}: KanbanStepRolesAdminPanelProps) {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const [createTitle, setCreateTitle] = useState("");
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createProjectRole, { isLoading: creating }] = useCreateProjectRoleMutation();
  const [deleteProjectRole, { isLoading: deleting }] = useDeleteProjectRoleMutation();
  const [setRoleAssignments, { isLoading: assigning }] =
    useSetProjectRoleAssignmentsMutation();

  const busy = creating || deleting || assigning;

  const activeRole = useMemo(
    () => projectRoles.find((r) => r.id === activeRoleId) ?? null,
    [projectRoles, activeRoleId],
  );

  const rolesSorted = useMemo(() => {
    return [...(projectRoles ?? [])].sort((a, b) =>
      a.title.localeCompare(b.title, "ru"),
    );
  }, [projectRoles]);

  const patchRolesCache = (roles: ProjectRoleInfo[]) => {
    if (!projectName) return;
    dispatch(
      projectApi.util.updateQueryData("projectRoles", projectName, (draft) => {
        draft.roles = roles;
      }),
    );
  };

  const createRole = async () => {
    if (!accessToken || !projectName) return;
    const title = createTitle.trim();
    if (!title) return;
    setError(null);
    try {
      await createProjectRole({ projectSlug: projectName, title, aliases: [] }).unwrap();
      setCreateTitle("");
    } catch (e: unknown) {
      setError(mutationErrorMessage(e, "Не удалось создать роль"));
    }
  };

  const deleteRole = async () => {
    if (!accessToken || !projectName || !activeRole) return;
    const ok =
      typeof window !== "undefined"
        ? window.confirm(`Удалить роль “${activeRole.title}”?`)
        : true;
    if (!ok) return;
    setError(null);
    try {
      await deleteProjectRole({
        projectSlug: projectName,
        roleId: activeRole.id,
      }).unwrap();
      setActiveRoleId((prev) => (prev === activeRole.id ? null : prev));
    } catch {
      setError("Не удалось удалить роль");
    }
  };

  const toggleAssignment = async (roleId: string, email: string) => {
    if (!accessToken || !projectName) return;
    const role = projectRoles.find((r) => r.id === roleId);
    if (!role) return;
    const cur = new Set(
      (role.emails ?? []).map(normalizeEmail).filter(Boolean),
    );
    const e = normalizeEmail(email);
    if (!e) return;
    if (cur.has(e)) cur.delete(e);
    else cur.add(e);
    const nextEmails = Array.from(cur).sort();
    const nextRoles = projectRoles.map((r) =>
      r.id === roleId ? { ...r, emails: nextEmails } : r,
    );
    patchRolesCache(nextRoles);
    try {
      await setRoleAssignments({
        projectSlug: projectName,
        roleId,
        emails: nextEmails,
      }).unwrap();
    } catch {
      dispatch(
        projectApi.util.invalidateTags([
          { type: "ProjectRoles", id: projectName },
        ]),
      );
    }
  };

  if (!accessToken || !projectName) {
    return null;
  }

  return (
    <div className="kanban-roles-admin">
      <div className="kanban-roles-admin__title">Создание и назначения ролей</div>
      {error ? <div className="kanban-roles-admin__error">{error}</div> : null}

      {missingSceneRoles.length > 0 ? (
        <div className="kanban-roles-admin__missing">
          <span className="kanban-roles-admin__missing-label">
            Нет карточки в проекте для роли из сценария — нажмите, чтобы подставить название:
          </span>
          {missingSceneRoles.map((r) => (
            <button
              key={r}
              type="button"
              className="kanban-roles-admin__chip"
              onClick={() => setCreateTitle(r)}
            >
              {r}
            </button>
          ))}
        </div>
      ) : null}

      <div className="kanban-roles-admin__row">
        <InlineTextField
          className="kanban-roles-admin__title-input"
          value={createTitle}
          onChange={(e) => setCreateTitle(e.target.value)}
          placeholder="Название новой роли"
          disabled={busy}
        />
        <Button type="button" onClick={createRole} disabled={busy || !createTitle.trim()}>
          Создать
        </Button>
      </div>

      <div className="kanban-roles-admin__list" aria-label="Список ролей проекта">
        {rolesSorted.map((r) => {
          const isActive = r.id === activeRoleId;
          return (
            <button
              key={r.id}
              type="button"
              className={cn(
                "kanban-roles-admin__list-item",
                isActive && "kanban-roles-admin__list-item_active",
              )}
              onClick={() => setActiveRoleId(r.id)}
            >
              <div className="kanban-roles-admin__list-title">{r.title}</div>
              <div className="kanban-roles-admin__list-meta">
                назначено: {(r.emails ?? []).length}
              </div>
            </button>
          );
        })}
        {rolesSorted.length === 0 ? (
          <div className="kanban-roles-admin__muted">Ролей в проекте пока нет</div>
        ) : null}
      </div>

      {!activeRole ? (
        <div className="kanban-roles-admin__muted">Выберите роль, чтобы назначить актёров</div>
      ) : (
        <div>
          <div className="kanban-roles-admin__assign-head">
            <span className="kanban-roles-admin__assign-title">{activeRole.title}</span>
            <button
              type="button"
              className="kanban-roles-admin__danger"
              onClick={deleteRole}
              disabled={busy}
            >
              Удалить
            </button>
          </div>
          <div className="kanban-roles-admin__muted kanban-roles-admin__muted_spacing">
            Назначения (труппа и участники проекта)
          </div>
          <div className="kanban-roles-admin__assignments">
            {members.map((m) => {
              const email = m.email;
              const checked = (activeRole.emails ?? [])
                .map(normalizeEmail)
                .includes(normalizeEmail(email));
              const label = memberLabel(m);
              return (
                <LabeledCheckbox
                  key={email}
                  className="kanban-roles-admin__check"
                  checked={checked}
                  disabled={busy}
                  onChange={() => toggleAssignment(activeRole.id, email)}
                >
                  <span className="kanban-roles-admin__check-label">
                    <MiniAvatar
                      src={String(m.profile?.avatarUrl ?? "").trim() || null}
                      label={label}
                      size={20}
                    />
                    <span>{label}</span>
                  </span>
                </LabeledCheckbox>
              );
            })}
            {members.length === 0 ? (
              <div className="kanban-roles-admin__muted">
                Список пуст — добавьте людей в «Труппу» или участников проекта
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
