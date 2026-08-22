import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Link } from "react-router-dom";
import { projectPath } from "../../../app/router/paths";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { useAuth } from "../../auth/model/auth-context";
import {
  actorDisplay,
  findAssignmentMember,
  normalizeActorEmail,
} from "../../kanban-scene-modal/KanbanSceneCastDisplay";
import { mergeKanbanRoleAssignmentMembers } from "../../kanban/model/kanban-role-members";
import { useMyTroupeQuery } from "../../troupe/api/troupe-api";
import {
  useProjectMembersQuery,
  useProjectRolesQuery,
} from "../api/project-api";
import { useProject } from "../model/project-context";
import "./project-cast-page.css";

type CastRoleRef = {
  id: string;
  title: string;
};

type CastActorEntry = {
  email: string;
  roles: CastRoleRef[];
};

function buildCastActors(
  roles: ReadonlyArray<{ id: string; title: string; emails?: string[] }>,
): CastActorEntry[] {
  const byEmail = new Map<string, CastActorEntry>();

  for (const role of roles) {
    const roleRef: CastRoleRef = { id: role.id, title: role.title };
    for (const raw of role.emails ?? []) {
      const email = normalizeActorEmail(raw);
      if (!email) continue;
      const existing = byEmail.get(email);
      if (!existing) {
        byEmail.set(email, { email, roles: [roleRef] });
        continue;
      }
      if (!existing.roles.some((r) => r.id === role.id)) {
        existing.roles.push(roleRef);
      }
    }
  }

  return Array.from(byEmail.values());
}

export function ProjectCastPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();

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

  const projectRoles = rolesRes?.roles ?? [];
  const members = mergeKanbanRoleAssignmentMembers(troupeRes, projectMembersRes);
  const castActors = buildCastActors(projectRoles).sort((a, b) => {
    const labelA = actorDisplay(findAssignmentMember(members, a.email), a.email)
      .label;
    const labelB = actorDisplay(findAssignmentMember(members, b.email), b.email)
      .label;
    return labelA.localeCompare(labelB, "ru");
  });
  const loadError = rolesQueryError
    ? String(
        (rolesQueryError as { message?: string }).message ??
          "Не удалось загрузить каст",
      )
    : null;
  const rolesHref = projectPath(projectName, "roles");

  if (!accessToken) {
    return (
      <div className="project-cast-page">
        <div className="project-cast-page__hint">
          Нужно войти, чтобы открыть каст проекта.
        </div>
      </div>
    );
  }

  return (
    <div className="project-cast-page">
      <div className="project-cast-page__content">
        <header className="project-cast-page__header">
          <h1 className="project-cast-page__title">Каст</h1>
          <p className="project-cast-page__subtitle">
            Кто играет в этом проекте — актёры, назначенные на роли.
          </p>
        </header>

        {loadError ? (
          <div className="project-cast-page__error">{loadError}</div>
        ) : null}

        {rolesLoading ? (
          <PageLoader variant="view" label="Загрузка каста…" />
        ) : castActors.length === 0 ? (
          <div className="project-cast-page__panel">
            <p className="project-cast-page__hint">
              Пока никто не назначен. Назначьте актёров на{" "}
              <Link className="project-cast-page__link" to={rolesHref}>
                роли проекта
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="project-cast-page__grid" aria-label="Каст проекта">
            {castActors.map((actor) => {
              const member = findAssignmentMember(members, actor.email);
              const { label, avatarUrl, title } = actorDisplay(
                member,
                actor.email,
              );
              const rolesSorted = [...actor.roles].sort((a, b) =>
                a.title.localeCompare(b.title, "ru"),
              );

              return (
                <li
                  key={actor.email}
                  className="project-cast-page__card"
                  title={title}
                >
                  <div className="project-cast-page__person">
                    <MiniAvatar
                      src={avatarUrl}
                      label={label}
                      size={72}
                      title={title}
                    />
                    <div className="project-cast-page__person-text">
                      <div className="project-cast-page__name">{label}</div>
                      <div className="project-cast-page__email">
                        {actor.email}
                      </div>
                    </div>
                  </div>
                  <ul className="project-cast-page__roles">
                    {rolesSorted.map((role) => (
                      <li key={role.id}>
                        <Link
                          className="project-cast-page__role-link"
                          to={`/role-workbook/${encodeURIComponent(role.id)}`}
                        >
                          {role.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
