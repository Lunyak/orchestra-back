import { AdminSectionChrome } from "@shared/components/admin/AdminSectionChrome";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  projectTeamRolePath,
  theaterTeamPath,
} from "../../../app/router/paths";
import { useAuth } from "../../auth/model/auth-context";
import {
  useCreateProjectTeamRoleMutation,
  useProductionTeamQuery,
} from "../api/project-api";
import { useProject } from "../model/project-context";
import { CreateTeamRoleModal } from "./CreateTeamRoleModal";
import { TeamRoleMindmap } from "./TeamRoleMindmap";
import "../../../pages/troupe/style.css";
import "./project-production-team.css";

export function ProjectProductionTeamPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error } = useProductionTeamQuery(projectName, {
    skip: !accessToken || !projectName,
  });
  const [createRole, { isLoading: creating }] =
    useCreateProjectTeamRoleMutation();

  const theater = data?.theater ?? null;
  const theaterRoles = data?.theaterRoles ?? [];
  const projectRoles = data?.projectRoles ?? [];

  const parentOptions = [
    { value: "", label: "Верхний уровень" },
    ...projectRoles.map((role) => ({
      value: role.id,
      label: role.title,
    })),
  ];

  const theaterMindmapRoles = theaterRoles.map((role) => ({
    id: role.id,
    title: role.title,
    parentId: role.parentId,
    description: role.description,
    avatarKey: role.avatarKey,
    assignmentCount: role.assignmentCount,
  }));

  const projectMindmapRoles = projectRoles.map((role) => ({
    id: role.id,
    title: role.title,
    parentId: role.parentId,
    description: role.description,
    avatarKey: role.avatarKey,
    assignmentCount: role.assignmentCount,
    href: projectTeamRolePath(projectName, role.id),
  }));

  if (!accessToken) {
    return <div>Нужно войти, чтобы открыть должности постановки.</div>;
  }

  return (
    <AdminSectionChrome activeSection="team">
    <div className="project-production-team">
      <div className="troupe-view">
        <div className="troupe-card troupe-team-card troupe-role-tree-card">
          <div className="troupe-team-head">
            <div>
              <div className="troupe-team-title">Должности постановки</div>
              <div className="troupe-team-subtitle">
                Штат привязанного театра плюс роли только этой постановки.
              </div>
            </div>
          </div>

          {error ? (
            <div className="troupe-error">Не удалось загрузить должности</div>
          ) : null}
          {isLoading ? (
            <PageLoader variant="view" label="Загружаем должности…" />
          ) : (
            <>
              <section
                className="project-production-team__section"
                aria-labelledby="theater-base-title"
              >
                <h2
                  id="theater-base-title"
                  className="project-production-team__section-title"
                >
                  Из театра
                  {theater ? (
                    <span className="project-production-team__section-meta">
                      {" "}
                      · {theater.title}
                    </span>
                  ) : null}
                </h2>
                {!theater ? (
                  <div className="troupe-team-empty">
                    Театр не привязан. Привяжите театр в настройках проекта,
                    чтобы подтянуть штат.
                  </div>
                ) : theaterRoles.length === 0 ? (
                  <div className="troupe-team-empty">
                    В театре пока нет должностей.
                  </div>
                ) : (
                  <>
                    <TeamRoleMindmap
                      rootLabel={theater.title}
                      roles={theaterMindmapRoles}
                      accessToken={accessToken}
                      readonly
                    />
                    <p className="project-production-team__hint">
                      Штат театра только для просмотра. Править состав — в{" "}
                      <Link to={theaterTeamPath(theater.id)}>
                        должностях театра
                      </Link>
                      .
                    </p>
                  </>
                )}
              </section>

              <section
                className="project-production-team__section"
                aria-labelledby="project-roles-title"
              >
                <h2
                  id="project-roles-title"
                  className="project-production-team__section-title"
                >
                  Роли постановки
                </h2>
                <TeamRoleMindmap
                  rootLabel="Постановка"
                  roles={projectMindmapRoles}
                  accessToken={accessToken}
                  onAddClick={() => setCreateOpen(true)}
                />
              </section>
            </>
          )}
        </div>
      </div>

      <CreateTeamRoleModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        parentOptions={parentOptions}
        submitting={creating}
        onSubmit={async ({ title, parentId }) => {
          if (!projectName) throw new Error("no project");
          await createRole({
            projectSlug: projectName,
            title,
            parentId,
          }).unwrap();
        }}
      />
    </div>
    </AdminSectionChrome>
  );
}
