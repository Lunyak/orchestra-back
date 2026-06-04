import { useState, type MouseEvent } from "react";
import { useProject } from "../../../features/project";
import { AppEditorChatToggle } from "./AppEditorChatToggle";
import { AppEditorPlaylistEditToggle } from "./AppEditorPlaylistEditToggle";
import { AppEditorPlayerToggle } from "./AppEditorPlayerToggle";
import { AppEditorNavigationMenu } from "./AppEditorNavigationMenu";
import { AppEditorProjectMenu } from "./AppEditorProjectMenu";
import { useAppEditorMenubarCenter, useAppEditorMenubarToolbarActions, useAppEditorMenubarViewMenu } from "./AppEditorMenubarContext";
import "./style.css";

export function AppEditorMenubar() {
  const viewMenu = useAppEditorMenubarViewMenu();
  const centerContent = useAppEditorMenubarCenter();
  const toolbarActions = useAppEditorMenubarToolbarActions();
  const { projectName, currentProjectDisplayName } = useProject();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const handleMenusClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const title = target?.closest(".theater-editor-menubar__menu-title");
    if (title) {
      const menu = title.parentElement?.classList.contains("theater-editor-menubar__menu")
        ? title.parentElement
        : null;
      menu?.classList.toggle("app-editor-menubar__menu--mobile-expanded");
      return;
    }
    if (target?.closest("button")) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <header
      className={[
        "theater-editor-menubar",
        "app-editor-menubar",
        mobileMenuOpen ? "app-editor-menubar--mobile-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Меню приложения"
    >
      <div className="theater-editor-menubar__track app-editor-menubar__track">
        <div className="app-editor-menubar__start">
          <button
            type="button"
            className="app-editor-menubar__burger"
            aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span aria-hidden />
            <span aria-hidden />
            <span aria-hidden />
          </button>
          <div
            className="theater-editor-menubar__menus"
            onClick={handleMenusClick}
          >
            <AppEditorNavigationMenu />
            <AppEditorProjectMenu />
            {viewMenu}
          </div>
        </div>
        {centerContent ? (
          <div className="app-editor-menubar__center">{centerContent}</div>
        ) : null}
        <div className="app-editor-menubar__end">
          <div className="app-editor-menubar__actions">
            {toolbarActions}
            <AppEditorPlayerToggle />
            <AppEditorPlaylistEditToggle />
            <AppEditorChatToggle />
          </div>
          {projectName ? (
            <div className="app-editor-menubar__project-badge" title={projectName}>
              <strong>{currentProjectDisplayName}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
