import cn from "classnames";
import { useState, type MouseEvent } from "react";
import { useLocation } from "react-router-dom";
import { isProjectPath } from "../../../app/router/paths";
import { useProject } from "../../../features/project";
import { AppEditorChatToggle } from "./AppEditorChatToggle";
import { AppEditorHomeLink } from "./AppEditorHomeLink";
import { AppEditorMenubarMiniPlayer } from "./AppEditorMenubarMiniPlayer";
import { AppEditorMenubarProjectSelect } from "./AppEditorMenubarProjectSelect";
import { AppEditorProjectDirectionsNav } from "./AppEditorProjectDirectionsNav";
import { AppEditorUserMenu } from "./AppEditorUserMenu";
import { useAppEditorMenubarCenter, useAppEditorMenubarToolbarActions, useAppEditorMenubarViewMenu } from "./AppEditorMenubarContext";
import "./style.css";

export function AppEditorMenubar() {
  const viewMenu = useAppEditorMenubarViewMenu();
  const centerContent = useAppEditorMenubarCenter();
  const toolbarActions = useAppEditorMenubarToolbarActions();
  const { projectName } = useProject();
  const { pathname } = useLocation();
  const isProjectRoute = isProjectPath(pathname);
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
    if (target?.closest("button") || target?.closest("a")) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <header
      className={cn(
        "theater-editor-menubar",
        "app-editor-menubar",
        mobileMenuOpen && "app-editor-menubar--mobile-open",
      )}
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
            <AppEditorHomeLink />
            {isProjectRoute ? <AppEditorProjectDirectionsNav /> : null}
            {viewMenu}
          </div>
        </div>
        {(projectName && isProjectRoute) || centerContent ? (
          <div className="app-editor-menubar__center">
            {centerContent}
            {projectName && isProjectRoute ? <AppEditorMenubarProjectSelect /> : null}
          </div>
        ) : null}
        <div className="app-editor-menubar__end">
          <AppEditorMenubarMiniPlayer />
          <div className="app-editor-menubar__actions">
            {toolbarActions}
            <AppEditorChatToggle />
          </div>
          <AppEditorUserMenu />
        </div>
      </div>
    </header>
  );
}
