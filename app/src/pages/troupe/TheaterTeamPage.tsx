import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  theaterOrganizationPath,
  theaterTeamRolePath,
} from "../../app/router/paths";
import { useAuth } from "../../features/auth/model/auth-context";
import { TheaterSectionNav } from "../../features/organizations/ui/TheaterSectionNav";
import { CreateTeamRoleModal } from "../../features/project/ui/CreateTeamRoleModal";
import { TeamRoleMindmap } from "../../features/project/ui/TeamRoleMindmap";
import {
  useCreateTeamRoleMutation,
  useTeamRolesQuery,
} from "../../features/troupe/api/troupe-api";
import "../../features/organizations/ui/organizations.css";
import "../../features/project/ui/team-role-mindmap.css";
import "./theater-team-page.css";

export function TheaterTeamPage() {
  const { theaterId = "" } = useParams();
  const { accessToken } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const {
    data: teamRoles = [],
    isLoading: teamRolesLoading,
    error: teamRolesError,
  } = useTeamRolesQuery(undefined, { skip: !accessToken });
  const [createTeamRole, { isLoading: creatingTeamRole }] =
    useCreateTeamRoleMutation();

  const parentOptions = [
    { value: "", label: "Верхний уровень" },
    ...teamRoles.map((role) => ({
      value: role.id,
      label: role.title,
    })),
  ];

  const mindmapRoles = teamRoles.map((role) => ({
    id: role.id,
    title: role.title,
    parentId: role.parentId,
    description: role.description,
    avatarKey: role.avatarKey,
    assignmentCount: role.assignmentCount,
    href: theaterId ? theaterTeamRolePath(theaterId, role.id) : undefined,
  }));

  if (!theaterId) {
    return <Navigate to={theaterOrganizationPath()} replace />;
  }

  if (!accessToken) {
    return (
      <div className="app-layout">
        <div className="app-content">
          <main className="organizations-page organizations-page--detail">
            <p>Нужно войти, чтобы открыть команду театра.</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div className="app-content">
        <TheaterSectionNav theaterId={theaterId} active="team" />
        <main className="organizations-page organizations-page--detail">
          <header className="theater-team-page__header">
            <p className="organizations-page__eyebrow">Штат театра</p>
            <h1>Команда</h1>
            <span>
              Дерево должностей. Откройте карточку, чтобы назначить людей и
              заполнить инструкцию.
            </span>
          </header>

          <section className="theater-team-page__section">
            {teamRolesError ? (
              <p role="alert">Не удалось загрузить должности</p>
            ) : null}
            {teamRolesLoading ? (
              <p>Загружаем дерево должностей…</p>
            ) : (
              <TeamRoleMindmap
                rootLabel="Команда"
                roles={mindmapRoles}
                accessToken={accessToken}
                onAddClick={() => setCreateOpen(true)}
              />
            )}
          </section>

          <CreateTeamRoleModal
            isOpen={createOpen}
            onClose={() => setCreateOpen(false)}
            parentOptions={parentOptions}
            submitting={creatingTeamRole}
            onSubmit={async ({ title, parentId }) => {
              await createTeamRole({
                title,
                parentId,
              }).unwrap();
            }}
          />
        </main>
      </div>
    </div>
  );
}
