import { Buttons } from "@shared/components/buttons/Buttons";
import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  globalPaths,
  projectPath,
  projectSettingsPath,
} from "../../../app/router/paths";
import { useAuth } from "../../../features/auth";
import { useProject } from "../../../features/project";
import { ProjectConnectionsSettings } from "../../../features/project/ui/ProjectConnectionsSettings";
import { useTeam } from "../../../features/team";
import { usePlatform } from "../../../PlatformContext";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { isOrchestraWebAppSubpath } from "../../../shared/settings/orchestraWebHost";
import {
  getSpectaclePageLockEnabled,
  setSpectaclePageLockEnabled,
} from "../../../shared/settings/spectaclePageLock";
import {
  getConfirmBeforeRemoteScenePull,
  getPauseRemoteSceneUpdates,
  setConfirmBeforeRemoteScenePull,
  setPauseRemoteSceneUpdates,
} from "../../../shared/settings/syncPreferences";
import { getProfilesBatch, type TeamProfile } from "../../../sync/api/profile";

export function SettingsGeneralTab() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { onPushAllLocal, onResyncProject } = usePlatform();
  const { projectName, currentProjectDisplayName, updateProjectDisplayName } =
    useProject();
  const {
    projectMembers,
    projectOwner,
    isProjectOwner,
    canWriteProject,
    canManageProjectMembers,
    inviteEmail,
    setInviteEmail,
    inviteError,
    setInviteError,
    invite,
    updateMemberRole,
    removeMember,
    transferOwnership,
  } = useTeam();

  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectNameSaving, setProjectNameSaving] = useState(false);
  const [projectNameError, setProjectNameError] = useState<string | null>(null);
  const [transferUserId, setTransferUserId] = useState("");
  const [pauseRemoteSceneUpdates, setPauseRemoteSceneUpdatesState] = useState(
    () => getPauseRemoteSceneUpdates(),
  );
  const [confirmBeforeRemotePull, setConfirmBeforeRemotePullState] = useState(
    () => getConfirmBeforeRemoteScenePull(),
  );
  const [spectaclePageLock, setSpectaclePageLockUi] = useState(() =>
    getSpectaclePageLockEnabled(),
  );
  const showOrchestraWebPageLock = isOrchestraWebAppSubpath();

  const [profileByEmail, setProfileByEmail] = useState<
    Map<string, TeamProfile>
  >(() => new Map());
  const memberEmails = useMemo(() => {
    const out: string[] = [];
    if (projectOwner?.email)
      out.push(String(projectOwner.email).trim().toLowerCase());
    for (const m of projectMembers ?? []) {
      const em = String(m?.user?.email ?? "")
        .trim()
        .toLowerCase();
      if (em) out.push(em);
    }
    return Array.from(new Set(out)).filter(Boolean);
  }, [projectMembers, projectOwner?.email]);

  useEffect(() => {
    setProjectNameDraft(currentProjectDisplayName || "");
    setProjectNameError(null);
  }, [currentProjectDisplayName, projectName]);

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
          const em = String(p?.email ?? "")
            .trim()
            .toLowerCase();
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

  const handleRenameProject = async () => {
    const value = projectNameDraft.trim();
    if (!projectName || !value) return;
    setProjectNameSaving(true);
    setProjectNameError(null);
    try {
      await updateProjectDisplayName(value);
    } catch (error: unknown) {
      const e = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setProjectNameError(
        e?.response?.data?.message ??
          e?.message ??
          "Не удалось сохранить имя проекта",
      );
    } finally {
      setProjectNameSaving(false);
    }
  };

  const handlePushAllLocal = () => {
    if (!onPushAllLocal) return;
    const confirmed = window.confirm(
      "Выгрузить все локальные проекты и сцены на сервер?\n\n" +
        "Если на сервере уже есть изменённые данные, они могут быть перезаписаны.",
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
        "Перед подтяжкой приложение попробует отправить локальные несинхронизированные изменения (outbox), чтобы не потерять их.",
    );
    if (!confirmed) return;
    void onResyncProject(projectName).then((r) => {
      alert(
        `Resync завершён: обновлено сцен ${r.updatedScenes}/${r.totalScenes}.`,
      );
    });
  };

  return (
    <div className="settings-tab-page">
      <section className="settings-card settings-sync-live">
        <h3 className="settings-card__title">
          Синхронизация с сервером в прогоне
        </h3>
        <p className="settings-sync-hint">
          По событию с сервера сцена подтягивается без перезагрузки страницы.
          Полная перезагрузка вкладки при обычной работе чаще связана с
          истечением сессии или сбоем обновления токена. Здесь можно ограничить
          автоматическое применение чужих правок.
        </p>
        <LabeledCheckbox
          className="settings-sync-live-row"
          checked={pauseRemoteSceneUpdates}
          onChange={(e) => {
            setPauseRemoteSceneUpdates(e);
            setPauseRemoteSceneUpdatesState(e);
          }}
        >
          <span className="settings-sync-hint">
            Не подтягивать обновления сцены автоматически (только по кнопке
            «Подтянуть» в интерфейсе)
          </span>
        </LabeledCheckbox>

        <LabeledCheckbox
          className="settings-sync-live-row"
          checked={confirmBeforeRemotePull}
          onChange={(e) => {
            setConfirmBeforeRemoteScenePull(e);
            setConfirmBeforeRemotePullState(e);
          }}
          disabled={pauseRemoteSceneUpdates}
        >
          <span className="settings-sync-hint">
            Спрашивать подтверждение перед автоматическим подтягиванием
            обновлений с сервера
          </span>
        </LabeledCheckbox>
      </section>

      {showOrchestraWebPageLock ? (
        <section className="settings-card settings-sync-live">
          <h3 className="settings-card__title">
            Страница на dopamin / orkestr
          </h3>
          <p className="settings-sync-hint">
            Пока включено: нельзя уйти на другой маршрут приложения без
            подтверждения, браузер предупредит при перезагрузке или закрытии
            вкладки. Полностью запретить перезагрузку технически нельзя — только
            через системный диалог браузера.
          </p>
          <label className="settings-sync-live-row">
            <input
              type="checkbox"
              checked={spectaclePageLock}
              onChange={(e) => {
                const v = e.target.checked;
                setSpectaclePageLockEnabled(v);
                setSpectaclePageLockUi(v);
              }}
            />
            <span>
              Не покидать эту страницу (блок ухода по ссылкам и «Назад»,
              предупреждение при F5)
            </span>
          </label>
        </section>
      ) : null}

      <section className="settings-card">
        <h3 className="settings-card__title">Название проекта</h3>
        <div className="settings-project-create">
          <input
            type="text"
            value={projectNameDraft}
            onChange={(event) => {
              setProjectNameDraft(event.target.value);
              setProjectNameError(null);
            }}
            placeholder="Название проекта"
            disabled={
              !projectName || projectNameSaving || canWriteProject === false
            }
          />
          <Button
            type="button"
            className="primary"
            onClick={handleRenameProject}
            disabled={
              !projectName ||
              projectNameSaving ||
              !projectNameDraft.trim() ||
              projectNameDraft.trim() === currentProjectDisplayName.trim() ||
              canWriteProject === false
            }
          >
            {projectNameSaving ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
        <p className="settings-sync-hint">
          Меняется только видимое имя. Технический slug проекта остаётся:{" "}
          <b>{projectName || "—"}</b>
        </p>
        {canWriteProject === false ? (
          <div className="settings-invite-forbidden">
            У вас нет права изменять проект.
          </div>
        ) : null}
        {projectNameError ? (
          <div className="settings-invite-error">{projectNameError}</div>
        ) : null}
        <Button type="button" onClick={() => navigate(globalPaths.projects)}>
          Открыть мои проекты
        </Button>
      </section>

      <ProjectConnectionsSettings />

      <section className="settings-card">
        <h3 className="settings-card__title">Библиотека медиа</h3>
        <p className="settings-sync-hint">
          Единое хранилище музыки, звуков, видео и заставок проекта. Заполнение
          с сервера, из папки на диске или загрузкой файлов.
        </p>
        <Button
          type="button"
          onClick={() => navigate(projectPath(projectName, "media"))}
        >
          Открыть библиотеку
        </Button>
      </section>

      {(onPushAllLocal || onResyncProject) && (
        <section className="settings-card settings-sync">
          <h3 className="settings-card__title">
            Синхронизация локальных данных
          </h3>
          <p className="settings-sync-hint">
            Вы можете выгрузить все локальные проекты и сцены с этого компьютера
            на сервер. Используйте это, если раньше работали только офлайн и
            хотите перенести данные в онлайн-версию. Если на сервере уже есть
            изменённые данные, они могут быть перезаписаны.
          </p>
          {onPushAllLocal && (
            <Button
              type="button"
              className="primary"
              onClick={handlePushAllLocal}
            >
              Выгрузить все локальные данные на сервер
            </Button>
          )}
          {onResyncProject && (
            <Button type="button" onClick={handleResync}>
              Подтянуть отличия с сервера (resync)
            </Button>
          )}
        </section>
      )}

      <section className="settings-card">
        <h3 className="settings-card__title">Бот</h3>
        <p>
          Подключите Telegram-бота (своим токеном) и управляйте переменными для
          шаблонов сообщений.
        </p>
        <Button
          type="button"
          className="primary"
          onClick={() => navigate(projectSettingsPath(projectName, true))}
        >
          Настройки бота
        </Button>
      </section>

      <section className="settings-card settings-invite">
        {canManageProjectMembers === false ? (
          <p className="settings-invite-forbidden">
            Управлять участниками могут владелец и администраторы пространства.
          </p>
        ) : (
          <>
            <h3 className="settings-card__title settings-privet-title">
              Права участников в проекте
            </h3>
            {projectOwner ? (
              <p className="settings-sync-hint">
                Владелец проекта:{" "}
                {projectOwner.displayName
                  ? `${projectOwner.displayName} (${projectOwner.email})`
                  : projectOwner.email}
              </p>
            ) : null}
            {isProjectOwner === true && projectMembers.length > 0 ? (
              <div className="settings-invite-row">
                <select
                  className="settings-invite-input"
                  value={transferUserId}
                  onChange={(event) => setTransferUserId(event.target.value)}
                  aria-label="Новый владелец"
                >
                  <option value="">Передать владение…</option>
                  {projectMembers.map((member) => (
                    <option key={member.id} value={member.user.id}>
                      {member.user.displayName
                        ? `${member.user.displayName} (${member.user.email})`
                        : member.user.email}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={() => {
                    void transferOwnership(transferUserId);
                  }}
                  disabled={!transferUserId}
                >
                  Передать
                </Button>
              </div>
            ) : null}
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
                className="primary"
                onClick={invite}
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
                          const email = String(m.user.email ?? "")
                            .trim()
                            .toLowerCase();
                          const prof = email ? profileByEmail.get(email) : null;
                          const label = m.user.displayName
                            ? `${m.user.displayName} (${m.user.email})`
                            : m.user.email;
                          return (
                            <span className="settings-member-email__inner">
                              <MiniAvatar
                                src={
                                  String(prof?.avatarUrl ?? "").trim() || null
                                }
                                label={label}
                                size={20}
                              />
                              <span>{label}</span>
                            </span>
                          );
                        })()}
                      </span>
                      <div className="settings-member-actions">
                        <LabeledCheckbox
                          className="settings-member-role"
                          checked={m.role === "editor"}
                          onChange={(checked) =>
                            updateMemberRole(
                              m.id,
                              checked ? "editor" : "viewer",
                            )
                          }
                        >
                          {m.role === "editor"
                            ? "Редактирование"
                            : "Только просмотр"}
                        </LabeledCheckbox>
                        <Buttons.DeleteButton
                          type="button"
                          className="settings-member-remove"
                          onClick={() => removeMember(m.id)}
                        ></Buttons.DeleteButton>
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
  );
}
