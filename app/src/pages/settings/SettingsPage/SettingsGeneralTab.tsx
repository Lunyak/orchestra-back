import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  projectSettingsPath,
} from "../../../app/router/paths";
import { useProject } from "../../../features/project";
import { ProjectConnectionsSettings } from "../../../features/project/ui/ProjectConnectionsSettings";
import { useTeam } from "../../../features/team";
import { usePlatform } from "../../../PlatformContext";
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

export function SettingsGeneralTab() {
  const navigate = useNavigate();
  const { onPushAllLocal, onResyncProject } = usePlatform();
  const {
    projectName,
    currentProjectDisplayName,
    updateProjectDisplayName,
    updateProjectSlug,
  } = useProject();
  const { canWriteProject } = useTeam();

  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectNameSaving, setProjectNameSaving] = useState(false);
  const [projectNameError, setProjectNameError] = useState<string | null>(null);
  const [projectSlugDraft, setProjectSlugDraft] = useState("");
  const [projectSlugSaving, setProjectSlugSaving] = useState(false);
  const [projectSlugError, setProjectSlugError] = useState<string | null>(null);
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

  useEffect(() => {
    setProjectNameDraft(currentProjectDisplayName || "");
    setProjectNameError(null);
    setProjectSlugDraft(projectName || "");
    setProjectSlugError(null);
  }, [currentProjectDisplayName, projectName]);

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

  const handleRenameSlug = async () => {
    const value = projectSlugDraft.trim();
    if (!projectName || !value) return;
    setProjectSlugSaving(true);
    setProjectSlugError(null);
    try {
      const nextSlug = await updateProjectSlug(value);
      navigate(projectSettingsPath(nextSlug), { replace: true });
    } catch (error: unknown) {
      const e = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setProjectSlugError(
        e?.response?.data?.message ??
          e?.message ??
          "Не удалось сохранить slug проекта",
      );
    } finally {
      setProjectSlugSaving(false);
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
        "Локальные отличия могут быть перезаписаны.",
    );
    if (!confirmed) return;
    void onResyncProject(projectName).then(() => {
      alert("Resync завершён.");
    });
  };

  return (
    <div className="settings-tab-page">
      <section className="settings-card">
        <div className="settings-project-fields">
          <div className="settings-project-field">
            <label className="settings-project-field__label" htmlFor="settings-project-name">
              Название
            </label>
            <div className="settings-project-create">
              <input
                id="settings-project-name"
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
            <p className="settings-sync-hint">Видимое имя в интерфейсе и в меню проектов.</p>
            {projectNameError ? (
              <div className="settings-invite-error">{projectNameError}</div>
            ) : null}
          </div>

          <div className="settings-project-field">
            <label className="settings-project-field__label" htmlFor="settings-project-slug">
              Slug
            </label>
            <div className="settings-project-create">
              <input
                id="settings-project-slug"
                type="text"
                value={projectSlugDraft}
                onChange={(event) => {
                  setProjectSlugDraft(event.target.value);
                  setProjectSlugError(null);
                }}
                placeholder="slug-proekta"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                disabled={
                  !projectName || projectSlugSaving || canWriteProject === false
                }
              />
              <Button
                type="button"
                className="primary"
                onClick={handleRenameSlug}
                disabled={
                  !projectName ||
                  projectSlugSaving ||
                  !projectSlugDraft.trim() ||
                  projectSlugDraft.trim() === projectName ||
                  canWriteProject === false
                }
              >
                {projectSlugSaving ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
            <p className="settings-sync-hint">
              Часть URL: <b>/projects/{projectName || "—"}/…</b>
            </p>
            {projectSlugError ? (
              <div className="settings-invite-error">{projectSlugError}</div>
            ) : null}
          </div>
        </div>

        {canWriteProject === false ? (
          <div className="settings-invite-forbidden">
            У вас нет права изменять проект.
          </div>
        ) : null}
      </section>

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

      <ProjectConnectionsSettings />

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
    </div>
  );
}
