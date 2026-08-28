import type { HeaderScriptStateProps } from "../header/HeaderScriptStateNav";
import { MenubarPanelIcon } from "./MenubarPanelIcon";
import { PROJECT_ONBOARDING_PANELS_ATTR } from "../../../features/project/model/project-onboarding";

const icons = {
  scenes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  playlist: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  runText: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
};

export type AppEditorScriptPanelsNavProps = HeaderScriptStateProps & {
  showScenesToggle?: boolean;
  showSpectacleRunTextToggle?: boolean;
  spectacleRunTextHidden?: boolean;
  onToggleSpectacleRunText?: () => void;
};

export function AppEditorScriptPanelsNav({
  showPlaylist,
  onTogglePlaylist,
  isScenesCollapsed,
  onToggleScenesCollapsed,
  showScenesToggle = true,
  showSpectacleRunTextToggle = false,
  spectacleRunTextHidden = false,
  onToggleSpectacleRunText,
}: AppEditorScriptPanelsNavProps) {
  const scenesActive = !isScenesCollapsed;
  const runTextVisible = !spectacleRunTextHidden;
  const navLabel = showSpectacleRunTextToggle ? "Панели спектакля" : "Панели сценария";

  return (
    <nav
      className="app-editor-menubar__panels-nav"
      aria-label={navLabel}
      data-onboarding={PROJECT_ONBOARDING_PANELS_ATTR}
    >
      {showScenesToggle ? (
        <button
          type="button"
          className={[
            "app-editor-menubar__panel-btn",
            scenesActive ? "app-editor-menubar__panel-btn--active" : "app-editor-menubar__panel-btn--muted",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={onToggleScenesCollapsed}
          title={isScenesCollapsed ? "Показать сцены" : "Скрыть сцены"}
          aria-label={isScenesCollapsed ? "Показать сцены" : "Скрыть сцены"}
          aria-pressed={scenesActive}
        >
          <MenubarPanelIcon active={scenesActive}>{icons.scenes}</MenubarPanelIcon>
        </button>
      ) : null}
      <button
        type="button"
        className={[
          "app-editor-menubar__panel-btn",
          showPlaylist ? "app-editor-menubar__panel-btn--active" : "app-editor-menubar__panel-btn--muted",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onTogglePlaylist}
        title={showPlaylist ? "Скрыть плейлист" : "Показать плейлист"}
        aria-label={showPlaylist ? "Скрыть плейлист" : "Показать плейлист"}
        aria-pressed={showPlaylist}
      >
        <MenubarPanelIcon active={showPlaylist}>{icons.playlist}</MenubarPanelIcon>
      </button>
      {showSpectacleRunTextToggle && onToggleSpectacleRunText ? (
        <button
          type="button"
          className={[
            "app-editor-menubar__panel-btn",
            "app-editor-menubar__panel-btn--run-text",
            runTextVisible
              ? "app-editor-menubar__panel-btn--active"
              : "app-editor-menubar__panel-btn--muted",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={onToggleSpectacleRunText}
          title={spectacleRunTextHidden ? "Показать текст" : "Скрыть текст"}
          aria-label={spectacleRunTextHidden ? "Показать текст сцены" : "Скрыть текст сцены"}
          aria-pressed={runTextVisible}
        >
          <MenubarPanelIcon active={runTextVisible}>{icons.runText}</MenubarPanelIcon>
        </button>
      ) : null}
    </nav>
  );
}
