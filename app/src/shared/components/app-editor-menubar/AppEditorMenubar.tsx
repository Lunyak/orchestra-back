import { useState, type MouseEvent } from "react";
import { useProject } from "../../../features/project";
import { AppEditorChatToggle } from "./AppEditorChatToggle";
import { AppEditorPlaylistEditToggle } from "./AppEditorPlaylistEditToggle";
import { AppEditorPlayerToggle } from "./AppEditorPlayerToggle";
import { AppEditorHomeLink } from "./AppEditorHomeLink";
import { AppEditorMenubarProjectSelect } from "./AppEditorMenubarProjectSelect";
import { useAppEditorMenubarCenter, useAppEditorMenubarToolbarActions, useAppEditorMenubarViewMenu } from "./AppEditorMenubarContext";
import "./style.css";

export function AppEditorMenubar() {
  const viewMenu = useAppEditorMenubarViewMenu();
  const centerContent = useAppEditorMenubarCenter();
  const toolbarActions = useAppEditorMenubarToolbarActions();
  const { projectName } = useProject();
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
            <AppEditorHomeLink />
            {viewMenu}
          </div>
        </div>
        {projectName || centerContent ? (
          <div className="app-editor-menubar__center">
            {centerContent}
            {projectName ? <AppEditorMenubarProjectSelect /> : null}
          </div>
        ) : null}
        <div className="app-editor-menubar__end">
          <div className="app-editor-menubar__actions">
            {toolbarActions}
            <AppEditorPlayerToggle />
            <AppEditorPlaylistEditToggle />
            <AppEditorChatToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
