import { projectPath } from "../../../app/router/paths";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Modal } from "@shared/core/modal/Modal";
import cn from "classnames";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchWorkspaces,
  type WorkspaceSummary,
} from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../model/project-context";
import {
  hasSeenProjectOnboarding,
  projectOnboardingHref,
} from "../model/project-onboarding";
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
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const {
    createProject,
    onProjectChange,
    projectItems,
    projectName,
    projectsLoading,
  } = useProject();
  const createTitleId = useId();
  const createInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const hasProjects = projectItems.length > 0;

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase("ru");
  const filteredProjects = useMemo(() => {
    if (!normalizedSearch) return projectItems;
    return projectItems.filter((project) => {
      const name = String(project.name ?? "").toLocaleLowerCase("ru");
      const slug = String(project.slug ?? "").toLocaleLowerCase("ru");
      return name.includes(normalizedSearch) || slug.includes(normalizedSearch);
    });
  }, [normalizedSearch, projectItems]);

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

  const openCreateModal = () => {
    setProjectTitle("");
    setCreateError("");
    setIsCreateOpen(true);
    void loadWorkspaces();
  };

  const closeCreateModal = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
    setCreateError("");
  };

  useEffect(() => {
    if (!isCreateOpen) return;
    const timer = window.setTimeout(() => {
      createInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isCreateOpen]);

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
      const createdSlug = await createProject(
        title,
        workspaceForCreate || undefined,
      );
      if (!createdSlug) {
        setCreateError("Не удалось создать проект");
        return;
      }
      setProjectTitle("");
      setIsCreateOpen(false);
      const href = hasSeenProjectOnboarding()
        ? projectPath(createdSlug)
        : projectOnboardingHref(createdSlug);
      navigate(href);
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

  const emptyMessage = hasProjects
    ? "Ничего не найдено по запросу."
    : "Здесь пока нет проектов.";
  const emptyHint = hasProjects
    ? "Измените поиск или сбросьте фильтр."
    : "Нажмите «Создать», чтобы добавить первый.";

  return (
    <section
      className="project-workspace"
      aria-labelledby="project-workspace-title"
    >
      <header className="project-workspace__header">
        <div className="project-workspace__title-row">
          <div className="project-workspace__intro">
            <h1 id="project-workspace-title">Мои проекты</h1>
  
          </div>
          <button
            type="button"
            className="project-workspace__create-button"
            onClick={openCreateModal}
            aria-label="Создать проект"
            title="Создать проект"
          >
            <span className="project-workspace__create-label">Создать</span>
            <span className="project-workspace__create-icon" aria-hidden>+</span>
          </button>
        </div>

        <div className="project-workspace__toolbar">
          <label className="project-workspace__search" htmlFor="project-workspace-search">
            <input
              id="project-workspace-search"
              className="project-workspace__input"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск по названию"
              autoComplete="off"
            />
          </label>
        </div>
      </header>

      {projectsLoading ? (
        <PageLoader variant="view" label="Загрузка проектов…" />
      ) : filteredProjects.length > 0 ? (
        <ul className="project-workspace__list">
          {filteredProjects.map((project) => {
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
          <h2>{emptyMessage}</h2>
          <p>{emptyHint}</p>
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        panelClassName="project-workspace-create-modal"
        ariaLabelledBy={createTitleId}
      >
        <form
          className="project-workspace-create-modal__form"
          onSubmit={(event) => {
            void handleCreateProject(event);
          }}
        >
          <header className="project-workspace-create-modal__header">
            <h2 id={createTitleId} className="project-workspace-create-modal__title">
              Новый проект
            </h2>
          </header>

          <label className="project-workspace-create-modal__field" htmlFor="project-workspace-name">
            <span className="project-workspace-create-modal__label">Название</span>
            <input
              ref={createInputRef}
              id="project-workspace-name"
              className="project-workspace__input"
              value={projectTitle}
              onChange={(event) => {
                setProjectTitle(event.target.value);
                if (createError) setCreateError("");
              }}
              placeholder="Название проекта"
              disabled={isCreating}
            />
          </label>

          {workspaces.length > 0 ? (
            <label className="project-workspace-create-modal__field" htmlFor="project-workspace-space">
              <span className="project-workspace-create-modal__label">Пространство</span>
              <select
                id="project-workspace-space"
                className="project-workspace__select"
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                disabled={isCreating}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} · {workspaceTypeLabels[workspace.type]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {createError ? (
            <p className="project-workspace__error" role="alert">
              {createError}
            </p>
          ) : null}

          <div className="project-workspace-create-modal__actions">
            <button
              type="button"
              className="project-workspace-create-modal__cancel"
              onClick={closeCreateModal}
              disabled={isCreating}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="project-workspace__create-button"
              disabled={isCreating || !projectTitle.trim()}
            >
              {isCreating ? "Создание…" : "Создать"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
