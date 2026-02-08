import { useState } from "react";
import { ProjectPanel } from "../../components/project-panel/ProjectPanel";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useTeam } from "../../features/team";
import { usePlatform } from "../../PlatformContext";

export function SettingsPage() {
  const { accessToken, logout } = useAuth();
  const { onPushAllLocal } = usePlatform();
  const {
    projects,
    projectName,
    onProjectChange,
    createProject,
    deleteProject,
  } = useProject();
  const {
    projectMembers,
    isProjectOwner,
    inviteEmail,
    setInviteEmail,
    inviteError,
    setInviteError,
    invite,
    updateMemberRole,
    removeMember,
  } = useTeam();

  const [newProjectName, setNewProjectName] = useState("");

  const handleProjectChange = (name: string) => {
    onProjectChange(name);
  };

  const handleCreateProject = async () => {
    const value = newProjectName.trim();
    if (!value) return;
    await createProject(value);
    setNewProjectName("");
  };

  const handleDeleteProject = async () => {
    if (!projectName) return;
    const confirmed = window.confirm(
      `Удалить проект "${projectName}"? Это удалит все файлы проекта${accessToken ? " и на сервере" : ""}.`
    );
    if (!confirmed) return;
    await deleteProject(projectName);
  };

  const handlePushAllLocal = () => {
    if (!onPushAllLocal) return;
    const confirmed = window.confirm(
      "Выгрузить все локальные проекты и сцены на сервер?\n\n" +
      "Если на сервере уже есть изменённые данные, они могут быть перезаписаны."
    );
    if (!confirmed) return;
    void onPushAllLocal().then(() => {
      alert("Выгрузка локальных данных завершена.");
    });
  };

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content settings-main">
          <div className="settings-view">
            <section className="settings-project-section">
              <h2>Проект</h2>
              <ProjectPanel
                projects={projects}
                projectName={projectName}
                newProjectName={newProjectName}
                onProjectChange={handleProjectChange}
                onNewProjectNameChange={setNewProjectName}
                onCreateProject={handleCreateProject}
                onDeleteProject={handleDeleteProject}
              />
            </section>
            <h2>Настройки проекта</h2>
            <p>Текущий проект: {projectName || "—"}</p>
            {onPushAllLocal && (
              <section className="settings-sync">
                <h3>Синхронизация локальных данных</h3>
                <p className="settings-sync-hint">
                  Вы можете выгрузить все локальные проекты и сцены с этого
                  компьютера на сервер. Используйте это, если раньше работали
                  только офлайн и хотите перенести данные в онлайн-версию. Если на
                  сервере уже есть изменённые данные, они могут быть перезаписаны.
                </p>
                <button type="button" onClick={handlePushAllLocal}>
                  Выгрузить все локальные данные на сервер
                </button>
              </section>
            )}
            <section className="settings-invite">
              {isProjectOwner === false ? (
                <p className="settings-invite-forbidden">
                  Только владелец проекта может приглашать участников и
                  просматривать список.
                </p>
              ) : (
                <>
                  <h3>Пригласить в проект</h3>
                  <p className="settings-invite-hint">
                    Другие пользователи смогут подсоединиться к проекту после
                    регистрации. Укажите email зарегистрированного пользователя.
                  </p>
                  <div className="settings-invite-row">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        setInviteError(null);
                      }}
                      placeholder="email@example.com"
                      className="settings-invite-input"
                    />
                    <button
                      type="button"
                      onClick={invite}
                      disabled={!inviteEmail.trim()}
                    >
                      Пригласить
                    </button>
                  </div>
                  {inviteError && (
                    <div className="settings-invite-error">{inviteError}</div>
                  )}
                  {projectMembers.length > 0 && (
                    <div className="settings-members">
                      <h4>Участники</h4>
                      <ul className="settings-members-list">
                        {projectMembers.map((m) => (
                          <li key={m.id} className="settings-member-row">
                            <span className="settings-member-email">
                              {m.user.email}
                            </span>
                            <div className="settings-member-actions">
                              <label className="settings-member-role">
                                <input
                                  type="checkbox"
                                  checked={m.role === "editor"}
                                  onChange={(e) =>
                                    updateMemberRole(
                                      m.id,
                                      e.target.checked ? "editor" : "viewer"
                                    )
                                  }
                                />
                                {m.role === "editor"
                                  ? "Редактирование"
                                  : "Только просмотр"}
                              </label>
                              <button
                                type="button"
                                className="settings-member-remove"
                                onClick={() => removeMember(m.id)}
                              >
                                Удалить из проекта
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </section>
            <button type="button" onClick={logout}>
              Выйти из аккаунта
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
