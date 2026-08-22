import cn from "classnames";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { projectPath } from "../../../app/router/paths";
import { usePlaybook } from "../../playbook";
import { useProject } from "../../project/model/project-context";
import { ProjectMediaFileList } from "./ProjectMediaFileList";
import { ProjectMediaSourceBar } from "./ProjectMediaSourceBar";
import "./project-media.css";

export function ProjectMediaPageSection() {
  const { projectName, currentProjectDisplayName } = useProject();
  const { playbookData } = usePlaybook();
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

      <div
        className="project-media-page__library"
        aria-label="Содержимое библиотеки"
      >
        <ProjectMediaFileList
          playlist={playbookData?.playlist}
          sounds={playbookData?.sounds}
          videos={playbookData?.videos}
          holdImages={playbookData?.holdImages}
          onStatus={setStatus}
        />
      </div>

      <ProjectMediaSourceBar onStatus={setStatus} />
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
