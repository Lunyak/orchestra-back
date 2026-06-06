import { Buttons } from "@shared/components/buttons/Buttons";
import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../features/auth";
import { useProject } from "../../../features/project";
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
import {
  applyScriptPlayFontSizePx,
  clampScriptPlayFontSizePx,
  DEFAULT_SCRIPT_PLAY_FONT_SIZE_PX,
  getScriptPlayFontSizePx,
  MAX_SCRIPT_PLAY_FONT_SIZE_PX,
  MIN_SCRIPT_PLAY_FONT_SIZE_PX,
  setScriptPlayFontSizePx,
} from "../../../shared/settings/scriptPlayFontSize";
import { getProfilesBatch, type TeamProfile } from "../../../sync/api/profile";
import { ThemeSettingsSection } from "../../../features/settings/ui/ThemeSettingsSection";
import "./style.css";

export function SettingsPage() {
  const navigate = useNavigate();
  const { accessToken, logout } = useAuth();
  const { onPushAllLocal, onResyncProject } = usePlatform();
  const {
    projectName,
    currentProjectDisplayName,
    createProject,
    updateProjectDisplayName,
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
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectNameSaving, setProjectNameSaving] = useState(false);
  const [projectNameError, setProjectNameError] = useState<string | null>(null);
  const [pauseRemoteSceneUpdates, setPauseRemoteSceneUpdatesState] = useState(
    () => getPauseRemoteSceneUpdates(),
  );
  const [confirmBeforeRemotePull, setConfirmBeforeRemotePullState] = useState(
    () => getConfirmBeforeRemoteScenePull(),
  );
  const [spectaclePageLock, setSpectaclePageLockUi] = useState(() =>
    getSpectaclePageLockEnabled(),
  );
  const [playFontSizePx, setPlayFontSizePxState] = useState(() => getScriptPlayFontSizePx());
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

  const handleCreateProject = async () => {
    const value = newProjectName.trim();
    if (!value) return;
    await createProject(value);
    setNewProjectName("");
  };

  const handleRenameProject = async () => {
    const value = projectNameDraft.trim();
    if (!projectName || !value) return;
    setProjectNameSaving(true);
    setProjectNameError(null);
    try {
      await updateProjectDisplayName(value);
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string } }; message?: string };
      setProjectNameError(
        e?.response?.data?.message ?? e?.message ?? "Не удалось сохранить имя проекта",
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
    <div className="app-layout settings-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="settings-view">
            <div className="settings-view-header">
              <div>
                <h2 className="settings-view-title">Настройки</h2>
                <p className="settings-view-subtitle">
                  Проект: <b>{currentProjectDisplayName || "не выбран"}</b>
                </p>
              </div>
              <Button type="button" className="danger" onClick={logout}>
                Выйти из аккаунта
              </Button>
            </div>
            <ThemeSettingsSection />
            <section className="settings-card">
              <h3 className="settings-card__title">Вкладка «Текст»</h3>
              <p className="settings-sync-hint">
                Размер шрифта для текста пьесы в сценарии (вкладка «Текст») и в панели текста на
                странице репетиции. Сохраняется в браузере.
              </p>
              <label className="settings-script-font-size">
                <span className="settings-script-font-size__label">Размер шрифта, px</span>
                <input
                  className="settings-script-font-size__input"
                  type="number"
                  min={MIN_SCRIPT_PLAY_FONT_SIZE_PX}
                  max={MAX_SCRIPT_PLAY_FONT_SIZE_PX}
                  step={1}
                  value={playFontSizePx}
                  onChange={(event) => {
                    const next = clampScriptPlayFontSizePx(Number(event.target.value));
                    setPlayFontSizePxState(next);
                    setScriptPlayFontSizePx(next);
                    applyScriptPlayFontSizePx(next);
                  }}
                />
              </label>
              <p className="settings-sync-hint">
                По умолчанию: {DEFAULT_SCRIPT_PLAY_FONT_SIZE_PX}px. Допустимо:{" "}
                {MIN_SCRIPT_PLAY_FONT_SIZE_PX}–{MAX_SCRIPT_PLAY_FONT_SIZE_PX}px.
              </p>
            </section>
            <section className="settings-card settings-sync-live">
              <h3 className="settings-card__title">
                Синхронизация с сервером во время спектакля
              </h3>
              <p className="settings-sync-hint">
                По событию с сервера сцена подтягивается без перезагрузки
                страницы. Полная перезагрузка вкладки при обычной работе чаще
                связана с истечением сессии или сбоем обновления токена. Здесь
                можно ограничить автоматическое применение чужих правок.
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
                  Не подтягивать обновления сцены автоматически (только по
                  кнопке «Подтянуть» в интерфейсе)
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
                  подтверждения, браузер предупредит при перезагрузке или
                  закрытии вкладки. Полностью запретить перезагрузку технически
                  нельзя — только через системный диалог браузера.
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
                  disabled={!projectName || projectNameSaving || isProjectOwner === false}
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
                    isProjectOwner === false
                  }
                >
                  {projectNameSaving ? "Сохранение…" : "Сохранить"}
                </Button>
              </div>
              <p className="settings-sync-hint">
                Меняется только видимое имя. Технический slug проекта остаётся:
                {" "}
                <b>{projectName || "—"}</b>
              </p>
              {isProjectOwner === false ? (
                <div className="settings-invite-forbidden">
                  Только владелец проекта может менять название.
                </div>
              ) : null}
              {projectNameError ? (
                <div className="settings-invite-error">{projectNameError}</div>
              ) : null}
            </section>
            {(onPushAllLocal || onResyncProject) && (
              <section className="settings-card settings-sync">
                <h3 className="settings-card__title">
                  Синхронизация локальных данных
                </h3>
                <p className="settings-sync-hint">
                  Вы можете выгрузить все локальные проекты и сцены с этого
                  компьютера на сервер. Используйте это, если раньше работали
                  только офлайн и хотите перенести данные в онлайн-версию. Если
                  на сервере уже есть изменённые данные, они могут быть
                  перезаписаны.
                </p>
                {onPushAllLocal && (
                  <Button type="button" className="primary" onClick={handlePushAllLocal}>
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
              <h3 className="settings-card__title">Создание проекта</h3>
              <div className="settings-project-create">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="Новый проект"
                />
                <Button
                  type="button"
                  className="primary"
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim()}
                >
                  Создать
                </Button>
              </div>
            </section>

            <section className="settings-card">
              <h3 className="settings-card__title">Бот</h3>
              <p>
                Подключите Telegram-бота (своим токеном) и управляйте
                переменными для шаблонов сообщений.
              </p>
              <Button
                type="button"
                className="primary"
                onClick={() => navigate("/settings/bot")}
              >
                Настройки бота
              </Button>
            </section>

            <section className="settings-card settings-invite">
              {isProjectOwner === false ? (
                <p className="settings-invite-forbidden">
                  Только владелец проекта может приглашать участников и
                  просматривать список.
                </p>
              ) : (
                <>
                  <h3 className="settings-card__title settings-privet-title">
                    Права участников в проекте
                  </h3>
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
                                const prof = email
                                  ? profileByEmail.get(email)
                                  : null;
                                const label = m.user.displayName
                                  ? `${m.user.displayName} (${m.user.email})`
                                  : m.user.email;
                                return (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 8,
                                    }}
                                  >
                                    <MiniAvatar
                                      src={
                                        String(prof?.avatarUrl ?? "").trim() ||
                                        null
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
        </main>
      </div>
    </div>
  );
}
