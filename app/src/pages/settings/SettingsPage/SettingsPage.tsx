import { Button } from "@shared/core/button/Button";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../features/auth";
import { useProject } from "../../../features/project";
import { useTeam } from "../../../features/team";
import { usePlatform } from "../../../PlatformContext";
import { ProjectPanel } from "../../../shared/components/project-panel/ProjectPanel";
import { getProfilesBatch, type TeamProfile } from "../../../sync/api";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import "./style.css";

export function SettingsPage() {
  const navigate = useNavigate();
  const { accessToken, logout } = useAuth();
  const { onPushAllLocal, onResyncProject } = usePlatform();
  const {
    projects,
    projectName,
    onProjectChange,
    createProject,
    deleteProject,
  } = useProject();
  const {
    projectMembers,
    projectOwner,
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

  const [profileByEmail, setProfileByEmail] = useState<Map<string, TeamProfile>>(() => new Map());
  const memberEmails = useMemo(() => {
    const out: string[] = [];
    if (projectOwner?.email) out.push(String(projectOwner.email).trim().toLowerCase());
    for (const m of projectMembers ?? []) {
      const em = String(m?.user?.email ?? "").trim().toLowerCase();
      if (em) out.push(em);
    }
    return Array.from(new Set(out)).filter(Boolean);
  }, [projectMembers, projectOwner?.email]);

  useEffect(() => {
    if (!accessToken || memberEmails.length === 0) {
      setProfileByEmail(new Map());
      return;
    }
    let cancelled = false;
    getProfilesBatch(accessToken, memberEmails)
      .then((list) => {
        if (cancelled) return;
        const map = new Map<string, TeamProfile>();
        for (const p of list ?? []) {
          const em = String(p?.email ?? "").trim().toLowerCase();
          if (!em) continue;
          map.set(em, p);
        }
        setProfileByEmail(map);
      })
      .catch(() => {
        if (!cancelled) setProfileByEmail(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, memberEmails.join("|")]);

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

  const handleResync = () => {
    if (!onResyncProject) return;
    if (!projectName) return;
    const confirmed = window.confirm(
      "Подтянуть отличающиеся данные проекта с сервера в локальные файлы?\n\n" +
        "Перед подтяжкой приложение попробует отправить локальные несинхронизированные изменения (outbox), чтобы не потерять их."
    );
    if (!confirmed) return;
    void onResyncProject(projectName).then((r) => {
      alert(`Resync завершён: обновлено сцен ${r.updatedScenes}/${r.totalScenes}.`);
    });
  };

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content settings-main">
          <div className="settings-view">
            <div className="settings-view-header">
              <h2>Настройки проекта</h2>
              <Button type="button" className="danger" onClick={logout}>
                Выйти из аккаунта
              </Button>
            </div>
            <p>Текущий проект: {projectName || "—"}</p>
            {(onPushAllLocal || onResyncProject) && (
              <section className="settings-sync">
                <h3>Синхронизация локальных данных</h3>
                <p className="settings-sync-hint">
                  Вы можете выгрузить все локальные проекты и сцены с этого
                  компьютера на сервер. Используйте это, если раньше работали
                  только офлайн и хотите перенести данные в онлайн-версию. Если на
                  сервере уже есть изменённые данные, они могут быть перезаписаны.
                </p>
                {onPushAllLocal && (
                  <button type="button" onClick={handlePushAllLocal}>
                    Выгрузить все локальные данные на сервер
                  </button>
                )}
                {onResyncProject && (
                  <button type="button" onClick={handleResync}>
                    Подтянуть отличия с сервера (resync)
                  </button>
                )}
              </section>
            )}
            <section className="settings-project-section">
              <h2>Сменить проект</h2>
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

            <section className="settings-project-section">
              <h2>Бот</h2>
              <p>
                Подключите Telegram-бота (своим токеном) и управляйте переменными
                для шаблонов сообщений.
              </p>
              <Button type="button" className="pri" onClick={() => navigate("/settings/bot")}>
                Настройки бота
              </Button>
            </section>

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
                    <Button
                      type="button"
                      className="primary" onClick={invite}
                      disabled={!inviteEmail.trim()}
                    >
                      Пригласить
                    </Button>
                  </div>
                  {inviteError && (
                    <div className="settings-invite-error">{inviteError}</div>
                  )}
                  {projectMembers.length > 0 && (
                    <div className="settings-members">
                      <ul className="settings-members-list">
                        {projectMembers.map((m) => (
                          <li key={m.id} className="settings-member-row">
                            <span className="settings-member-email">
                              {(() => {
                                const email = String(m.user.email ?? "").trim().toLowerCase();
                                const prof = email ? profileByEmail.get(email) : null;
                                const label = m.user.displayName
                                  ? `${m.user.displayName} (${m.user.email})`
                                  : m.user.email;
                                return (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    <MiniAvatar
                                      src={String(prof?.avatarUrl ?? "").trim() || null}
                                      label={label}
                                      size={20}
                                    />
                                    <span>{label}</span>
                                  </span>
                                );
                              })()}
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

          </div>
        </main>
      </div>
    </div>
  );
}
