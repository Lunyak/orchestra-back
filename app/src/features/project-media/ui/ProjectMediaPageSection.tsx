import cn from "classnames";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { projectPath } from "../../../app/router/paths";
import { HeaderPlayer } from "../../../shared/components/header/HeaderPlayer";
import { PlaylistSidebar } from "../../../shared/components/playlist-sidebar/PlaylistSidebar";
import { usePlaybook } from "../../playbook";
import { useProject } from "../../project/model/project-context";
import { ProjectMediaProjectorSection } from "./ProjectMediaProjectorSection";
import { ProjectMediaSourceBar } from "./ProjectMediaSourceBar";
import "./project-media.css";

export function ProjectMediaPageSection() {
  const { projectName, currentProjectDisplayName } = useProject();
  const { playbookData, pushPlaybookAfterSoundsSave, registerSoundToggle } = usePlaybook();
  const [status, setStatus] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      playlist: playbookData?.playlist?.length ?? 0,
      sounds: playbookData?.sounds?.length ?? 0,
      videos: playbookData?.videos?.length ?? 0,
      holds: playbookData?.holdImages?.length ?? 0,
    }),
    [
      playbookData?.holdImages?.length,
      playbookData?.playlist?.length,
      playbookData?.sounds?.length,
      playbookData?.videos?.length,
    ],
  );

  const totalCount =
    counts.playlist + counts.sounds + counts.videos + counts.holds;

  if (!projectName) {
    return (
      <div className="project-media-page project-media-page--empty">
        <p>Выберите проект в верхней панели.</p>
      </div>
    );
  }

  const projectLabel = currentProjectDisplayName || projectName;

  return (
    <div className="project-media-page">
      <header className="project-media-page__header">
        <div>
          <h1 className="project-media-page__title">Библиотека медиа</h1>
          <p className="project-media-page__subtitle">
            {projectLabel} · {totalCount} файлов в проекте
          </p>
        </div>
        {status ? <p className="project-media-page__status">{status}</p> : null}
      </header>

      <ProjectMediaSourceBar onStatus={setStatus} />

      <div className="project-media-page__library" aria-label="Содержимое библиотеки">
        <div className="project-media-page__audio-row">
          <section className="project-media-library-section project-media-library-section--playlist">
            <header className="project-media-library-section__header">
              <h2 className="project-media-library-section__title">Музыка</h2>
              <span className="project-media-library-section__count">{counts.playlist}</span>
            </header>
            <p className="project-media-library-section__hint">
              Треки для плейлиста и прогона. Используются в прогоне и сценарии.
            </p>
            <div className="project-media-page__playlist-container">
              <PlaylistSidebar projectName={projectName} sceneName="script" mode="list" />
            </div>
          </section>

          <section className="project-media-library-section project-media-library-section--sounds">
            <header className="project-media-library-section__header">
              <h2 className="project-media-library-section__title">Звуки</h2>
              <span className="project-media-library-section__count">{counts.sounds}</span>
            </header>
            <p className="project-media-library-section__hint">
              Короткие эффекты для сценария (клики, атмосфера). Запускаются из текста сцены.
            </p>
            <div className="project-media-page__sounds-container">
              <HeaderPlayer
                projectName={projectName}
                sceneName="script"
                sounds={playbookData?.sounds ?? []}
                onSoundsSaved={pushPlaybookAfterSoundsSave}
                onRegisterToggleHandler={registerSoundToggle}
              />
            </div>
          </section>
        </div>

        <section className="project-media-library-section">
          <header className="project-media-library-section__header">
            <h2 className="project-media-library-section__title">Видео и заставки</h2>
            <span className="project-media-library-section__count">
              {counts.videos + counts.holds}
            </span>
          </header>
          <p className="project-media-library-section__hint">
            Медиа для окна проектора в прогоне и спектакле.
          </p>
          <ProjectMediaProjectorSection onStatus={setStatus} />
        </section>
      </div>
    </div>
  );
}

export function ProjectMediaPageLink({ className }: { className?: string }) {
  const { projectName } = useProject();
  return (
    <Link
      to={projectPath(projectName, "media")}
      className={cn("project-media-page-link", className)}
    >
      Библиотека медиа
    </Link>
  );
}
