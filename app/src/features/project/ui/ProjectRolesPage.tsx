import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../shared/core/button/Button";
import { InlineTextField } from "../../../shared/core/inline-text-field/InlineTextField";
import type { OrchestraQueryError } from "../../../shared/api/rtk/axios-base-query";
import { useAuth } from "../../auth/model/auth-context";
import { mergeKanbanRoleAssignmentMembers } from "../../kanban/model/kanban-role-members";
import { KanbanSceneRoleCastTile } from "../../kanban-scene-modal/KanbanSceneRoleCastTile";
import { useMyTroupeQuery } from "../../troupe/api/troupe-api";
import {
  useCreateProjectRoleMutation,
  useProjectMembersQuery,
  useProjectRolesQuery,
} from "../api/project-api";
import { useProject } from "../model/project-context";
import "./project-roles-page.css";

function mutationErrorMessage(e: unknown, fallback: string): string {
  const err = e as OrchestraQueryError | undefined;
  return String(err?.message ?? fallback);
}

export function ProjectRolesPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const navigate = useNavigate();
  const [createTitle, setCreateTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const skip = !accessToken || !projectName;
  const {
    data: rolesRes,
    isLoading: rolesLoading,
    error: rolesQueryError,
  } = useProjectRolesQuery(projectName, { skip });
  const { data: troupeRes } = useMyTroupeQuery({}, { skip: !accessToken });
  const { data: projectMembersRes } = useProjectMembersQuery(projectName, {
    skip,
  });
  const [createProjectRole, { isLoading: creating }] =
    useCreateProjectRoleMutation();

  const projectRoles = [...(rolesRes?.roles ?? [])].sort((a, b) =>
    a.title.localeCompare(b.title, "ru"),
  );
  const roleAssignmentMembers = mergeKanbanRoleAssignmentMembers(
    troupeRes,
    projectMembersRes,
  );
  const loadError = rolesQueryError
    ? String(
        (rolesQueryError as { message?: string }).message ??
          "Не удалось загрузить роли",
      )
    : null;

  const openRole = (roleId: string) => {
    navigate(`/role-workbook/${encodeURIComponent(roleId)}`);
  };

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
      if (roleId) openRole(roleId);
    } catch (e: unknown) {
      setError(mutationErrorMessage(e, "Не удалось создать роль"));
    }
  };

  if (!accessToken) {
    return (
      <div className="project-roles-page">
        <div className="project-roles-page__hint">
          Нужно войти, чтобы открыть роли проекта.
        </div>
      </div>
    );
  }

  return (
    <div className="project-roles-page">
      <div className="project-roles-page__content">
        <header className="project-roles-page__header">
          <h1 className="project-roles-page__title">Роли проекта</h1>
          <p className="project-roles-page__subtitle">
            Карточки ролей проекта.
          </p>
        </header>

        {error || loadError ? (
          <div className="project-roles-page__error">{error ?? loadError}</div>
        ) : null}

        <div className="project-roles-page__create">
          <InlineTextField
            className="project-roles-page__create-input"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            placeholder="Название новой роли"
            disabled={creating}
          />
          <Button
            type="button"
            onClick={() => void createRole()}
            disabled={creating || !createTitle.trim()}
          >
            Создать
          </Button>
        </div>

        {rolesLoading ? (
          <div className="project-roles-page__hint">Загрузка ролей…</div>
        ) : projectRoles.length === 0 ? (
          <div className="project-roles-page__panel">
            <p className="project-roles-page__hint">
              Ролей в проекте пока нет. Создайте первую карточку выше.
            </p>
          </div>
        ) : (
          <div
            className="kanban-scene-cast-grid"
            aria-label="Список ролей проекта"
          >
            {projectRoles.map((role) => (
              <KanbanSceneRoleCastTile
                key={role.id}
                roleKey={role.key || role.id}
                roleTitle={role.title}
                roleInfo={role}
                actorEmails={role.emails ?? []}
                members={roleAssignmentMembers}
                accessToken={accessToken}
                onOpenRole={openRole}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
