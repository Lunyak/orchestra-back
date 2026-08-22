import { useState } from "react";
import { useAuth } from "../auth/model/auth-context";
import { useCreateProjectRoleMutation } from "../project/api/project-api";
import { RolePlayingCard } from "../role-card/RolePlayingCard";
import { Button } from "../../shared/core/button/Button";
import { InlineTextField } from "../../shared/core/inline-text-field/InlineTextField";
import type { OrchestraQueryError } from "../../shared/api/rtk/axios-base-query";
import type { ProjectRoleInfo } from "../../sync/api/projects";
import "./KanbanSceneRolesAdminPanel.css";

export type KanbanSceneRolesAdminMember = {
  email: string;
  profile: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    avatarSmallUrl?: string | null;
  } | null;
};

function mutationErrorMessage(e: unknown, fallback: string): string {
  const err = e as OrchestraQueryError | undefined;
  return String(err?.message ?? fallback);
}

export type KanbanSceneRolesAdminPanelProps = {
  projectName: string | null;
  projectRoles: ProjectRoleInfo[];
  missingSceneRoles: string[];
  onOpenRole: (roleId: string) => void;
};

export function KanbanSceneRolesAdminPanel({
  projectName,
  projectRoles,
  missingSceneRoles,
  onOpenRole,
}: KanbanSceneRolesAdminPanelProps) {
  const { accessToken } = useAuth();
  const [createTitle, setCreateTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createProjectRole, { isLoading: creating }] = useCreateProjectRoleMutation();

  const rolesSorted = [...(projectRoles ?? [])].sort((a, b) =>
    a.title.localeCompare(b.title, "ru"),
  );

  const createRole = async () => {
    if (!accessToken || !projectName) return;
    const title = createTitle.trim();
    if (!title) return;
    setError(null);
    try {
      const res = await createProjectRole({
        projectSlug: projectName,
        title,
        aliases: [],
      }).unwrap();
      setCreateTitle("");
      const roleId = String(res?.roleId ?? "").trim();
      if (roleId) onOpenRole(roleId);
    } catch (e: unknown) {
      setError(mutationErrorMessage(e, "Не удалось создать роль"));
    }
  };

  if (!accessToken || !projectName) {
    return null;
  }

  return (
    <div className="kanban-roles-admin">
      <div className="kanban-roles-admin__title">Роли проекта</div>
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
          disabled={creating}
        />
        <Button type="button" onClick={() => void createRole()} disabled={creating || !createTitle.trim()}>
          Создать
        </Button>
      </div>

      <div className="kanban-roles-admin__list" aria-label="Список ролей проекта">
        {rolesSorted.map((r) => {
          const assignedCount = (r.emails ?? []).length;
          return (
            <button
              key={r.id}
              type="button"
              className="kanban-roles-admin__list-item"
              onClick={() => onOpenRole(r.id)}
              title={r.title}
            >
              <RolePlayingCard role={r} accessToken={accessToken} />
              <div className="kanban-roles-admin__list-meta">
                {assignedCount > 0 ? `актёров: ${assignedCount}` : "не назначено"}
              </div>
            </button>
          );
        })}
        {rolesSorted.length === 0 ? (
          <div className="kanban-roles-admin__muted">Ролей в проекте пока нет</div>
        ) : null}
      </div>
    </div>
  );
}
