import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from "classnames";
import { useCallback, useState, type FormEvent } from "react";
import {
  fetchWorkspaces,
  type WorkspaceSummary,
} from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../model/project-context";
import { readProjectPoster } from "../model/project-poster-storage";
import posterPlaceholderUrl from "../assets/project-poster-placeholder.png";
import "./project-workspace.css";

type ProjectWorkspaceProps = {
  onProjectOpen?: (slug: string) => void;
};

const workspaceTypeLabels: Record<WorkspaceSummary["type"], string> = {
  PERSONAL: "Личное",
  THEATER: "Театр",
  TROUPE: "Труппа",
};

function ProjectPosterTile({
  slug,
  label,
  isActive,
  onOpen,
}: {
  slug: string;
  label: string;
  isActive: boolean;
  onOpen: () => void;
}) {
  const posterSrc = readProjectPoster(slug);
  const displaySrc = posterSrc ?? posterPlaceholderUrl;
  const hasCustomPoster = Boolean(posterSrc);

  return (
    <button
      type="button"
      className={cn(
        "project-workspace__poster",
        isActive && "project-workspace__poster--active",
        hasCustomPoster && "project-workspace__poster--filled",
      )}
      aria-current={isActive ? "true" : undefined}
      onClick={onOpen}
    >
      <span
        className={cn(
          "project-workspace__poster-frame",
          !hasCustomPoster && "project-workspace__poster-frame--placeholder",
        )}
      >
        <img
          className="project-workspace__poster-image"
          src={displaySrc}
          alt=""
        />
      </span>
      <span className="project-workspace__poster-name">{label}</span>
    </button>
  );
}

export function ProjectWorkspace({ onProjectOpen }: ProjectWorkspaceProps) {
  const { accessToken } = useAuth();
  const {
    createProject,
    onProjectChange,
    projectItems,
    projectName,
    projectsLoading,
  } = useProject();
  const [projectTitle, setProjectTitle] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const hasProjects = projectItems.length > 0;

  const loadWorkspaces = useCallback(async () => {
    if (!accessToken) return "";
    try {
      const workspaceItems = await fetchWorkspaces(accessToken);
      setWorkspaces(workspaceItems);
      const personalWorkspaceId =
        workspaceItems.find((workspace) => workspace.type === "PERSONAL")?.id ??
        "";
      setWorkspaceId((current) => {
        if (workspaceItems.some((workspace) => workspace.id === current))
          return current;
        return personalWorkspaceId;
      });
      return personalWorkspaceId;
    } catch {
      setWorkspaces([]);
      setWorkspaceId("");
      return "";
    }
  }, [accessToken]);

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = projectTitle.trim();
    if (!title) {
      setCreateError("Введите название проекта");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    try {
      let workspaceForCreate = workspaceId;
      if (workspaces.length === 0) {
        workspaceForCreate = (await loadWorkspaces()) || workspaceId;
      }
      await createProject(title, workspaceForCreate || undefined);
      setProjectTitle("");
    } catch {
      setCreateError("Не удалось создать проект");
    } finally {
      setIsCreating(false);
    }
  };

  const handleProjectOpen = (slug: string) => {
    onProjectChange(slug);
    onProjectOpen?.(slug);
  };

  return (
    <section
      className="project-workspace"
      aria-labelledby="project-workspace-title"
    >
      <header className="project-workspace__header">
        <div>
          <h1 id="project-workspace-title">Мои проекты</h1>
          <p className="project-workspace__description">
            Выберите проект или создайте новый.
          </p>
        </div>
        <form
          className="project-workspace__create"
          onSubmit={handleCreateProject}
        >
          <label htmlFor="project-workspace-name">Новый проект</label>
          <div className="project-workspace__create-row">
            <input
              id="project-workspace-name"
              className="project-workspace__input"
              value={projectTitle}
              onChange={(event) => {
                setProjectTitle(event.target.value);
                if (createError) setCreateError("");
              }}
              onFocus={() => {
                if (workspaces.length === 0) void loadWorkspaces();
              }}
              placeholder="Название проекта"
              disabled={isCreating}
            />
            <button
              type="submit"
              className="project-workspace__create-button"
              disabled={isCreating || !projectTitle.trim()}
            >
              {isCreating ? "Создание…" : "Создать"}
            </button>
          </div>
          {workspaces.length > 0 ? (
            <select
              className="project-workspace__select"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              aria-label="Пространство проекта"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} · {workspaceTypeLabels[workspace.type]}
                </option>
              ))}
            </select>
          ) : null}
          {createError ? (
            <p className="project-workspace__error" role="alert">
              {createError}
            </p>
          ) : null}
        </form>
      </header>

      {projectsLoading ? (
        <PageLoader variant="view" label="Загрузка проектов…" />
      ) : hasProjects ? (
        <ul className="project-workspace__list">
          {projectItems.map((project) => {
            const isActive = project.slug === projectName;
            const projectLabel = project.name || project.slug;

            return (
              <li key={project.slug}>
                <ProjectPosterTile
                  slug={project.slug}
                  label={projectLabel}
                  isActive={isActive}
                  onOpen={() => handleProjectOpen(project.slug)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="project-workspace__empty">
          <h2>Здесь пока нет проектов</h2>
          <p>Выберите пространство и введите название проекта.</p>
        </div>
      )}
    </section>
  );
}
