import { useState, type FormEvent } from "react";
import { useProject } from "../../../features/project";

export function AppEditorProjectMenu() {
  const {
    projects,
    projectItems,
    projectName,
    currentProjectDisplayName,
    projectsLoading,
    onProjectChange,
    createProject,
    updateProjectDisplayName,
  } = useProject();
  const [dialogMode, setDialogMode] = useState<"create" | "rename" | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);

  const openCreateDialog = () => {
    setIsMenuCollapsed(true);
    setProjectTitle("");
    setDialogError("");
    setDialogMode("create");
  };

  const openRenameDialog = () => {
    setIsMenuCollapsed(true);
    setProjectTitle(currentProjectDisplayName || projectName);
    setDialogError("");
    setDialogMode("rename");
  };

  const closeProjectDialog = () => {
    if (isSavingProject) return;
    setDialogMode(null);
    setDialogError("");
  };

  const handleSaveProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = projectTitle.trim();
    if (!title) {
      setDialogError("Введите название проекта");
      return;
    }
    setIsSavingProject(true);
    setDialogError("");
    try {
      if (dialogMode === "rename") {
        await updateProjectDisplayName(title);
      } else {
        await createProject(title);
      }
      setDialogMode(null);
      setProjectTitle("");
    } catch {
      setDialogError(
        dialogMode === "rename" ? "Не удалось переименовать проект" : "Не удалось создать проект",
      );
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleProjectChange = (slug: string) => {
    onProjectChange(slug);
    setIsMenuCollapsed(true);
  };

  return (
    <>
      <div
        className={[
          "theater-editor-menubar__menu",
          isMenuCollapsed ? "app-editor-project-menu--collapsed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseLeave={() => setIsMenuCollapsed(false)}
      >
        <span className="theater-editor-menubar__menu-title">Проект</span>
        <div className="theater-editor-menubar__options" role="menu">
          {projectsLoading ? (
            <span
              className="theater-editor-menubar__option theater-editor-menubar__option--meta"
              role="presentation"
            >
              Загрузка проектов…
            </span>
          ) : projects.length === 0 ? (
            <>
              <span
                className="theater-editor-menubar__option theater-editor-menubar__option--meta"
                role="presentation"
              >
                Проектов нет
              </span>
              <div
                className="theater-editor-menubar__option theater-editor-menubar__option--separator"
                role="separator"
              />
              <button
                type="button"
                role="menuitem"
                className="theater-editor-menubar__option"
                onClick={openCreateDialog}
              >
                Создать
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className="theater-editor-menubar__option"
                onClick={openCreateDialog}
              >
                Создать
              </button>
              <button
                type="button"
                role="menuitem"
                className="theater-editor-menubar__option"
                onClick={openRenameDialog}
              >
                Переименовать
              </button>
              <div
                className="theater-editor-menubar__option theater-editor-menubar__option--separator"
                role="separator"
              />
              <div className="theater-editor-menubar__submenu-group" role="presentation">
                <span
                  className="theater-editor-menubar__option theater-editor-menubar__option--submenu-title"
                  role="menuitem"
                  aria-haspopup="menu"
                >
                  Сменить проект
                </span>
                <div className="theater-editor-menubar__submenu" role="menu">
                  {projectItems.map((project) => {
                    const isActive = project.slug === projectName;
                    return (
                      <button
                        key={project.slug}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        className={[
                          "theater-editor-menubar__option",
                          isActive ? "theater-editor-menubar__option--active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleProjectChange(project.slug)}
                      >
                        {project.name || project.slug}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {dialogMode ? (
        <div
          className="app-editor-project-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-editor-project-dialog-title"
        >
          <form className="app-editor-project-dialog__panel" onSubmit={handleSaveProject}>
            <div className="app-editor-project-dialog__title" id="app-editor-project-dialog-title">
              {dialogMode === "rename" ? "Переименовать проект" : "Создать проект"}
            </div>
            <label className="app-editor-project-dialog__field">
              <span>Название проекта</span>
              <input
                className="app-editor-project-dialog__input"
                value={projectTitle}
                onChange={(event) => {
                  setProjectTitle(event.target.value);
                  if (dialogError) setDialogError("");
                }}
                autoFocus
                disabled={isSavingProject}
              />
            </label>
            {dialogError ? (
              <div className="app-editor-project-dialog__error">{dialogError}</div>
            ) : null}
            <div className="app-editor-project-dialog__actions">
              <button
                type="button"
                className="app-editor-project-dialog__button"
                onClick={closeProjectDialog}
                disabled={isSavingProject}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="app-editor-project-dialog__button app-editor-project-dialog__button--primary"
                disabled={isSavingProject}
              >
                {isSavingProject
                  ? dialogMode === "rename"
                    ? "Сохранение…"
                    : "Создание…"
                  : dialogMode === "rename"
                    ? "Сохранить"
                    : "Создать"}
              </button>
            </div>
          </form>
          <button
            type="button"
            className="app-editor-project-dialog__backdrop"
            aria-label="Закрыть"
            onClick={closeProjectDialog}
            disabled={isSavingProject}
          />
        </div>
      ) : null}
    </>
  );
}
