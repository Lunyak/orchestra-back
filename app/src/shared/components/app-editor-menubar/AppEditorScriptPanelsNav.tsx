import type { HeaderScriptStateProps } from "../header/HeaderScriptStateNav";
import { MenubarPanelIcon } from "./MenubarPanelIcon";

const icons = {
  steps: (
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
  sounds: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
};

export type AppEditorScriptPanelsNavProps = HeaderScriptStateProps;

export function AppEditorScriptPanelsNav({
  showPlaylist,
  onTogglePlaylist,
  showHeaderSounds,
  onToggleHeaderSounds,
  isStepsCollapsed,
  onToggleStepsCollapsed,
}: AppEditorScriptPanelsNavProps) {
  const stepsActive = !isStepsCollapsed;

  return (
    <nav className="app-editor-menubar__panels-nav" aria-label="Панели сценария">
      <button
        type="button"
        className={[
          "app-editor-menubar__panel-btn",
          stepsActive ? "app-editor-menubar__panel-btn--active" : "app-editor-menubar__panel-btn--muted",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onToggleStepsCollapsed}
        title={isStepsCollapsed ? "Показать шаги" : "Скрыть шаги"}
        aria-label={isStepsCollapsed ? "Показать шаги" : "Скрыть шаги"}
        aria-pressed={stepsActive}
      >
        <MenubarPanelIcon active={stepsActive}>{icons.steps}</MenubarPanelIcon>
      </button>
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
      <button
        type="button"
        className={[
          "app-editor-menubar__panel-btn",
          showHeaderSounds ? "app-editor-menubar__panel-btn--active" : "app-editor-menubar__panel-btn--muted",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onToggleHeaderSounds}
        title={showHeaderSounds ? "Скрыть звуки" : "Показать звуки"}
        aria-label={showHeaderSounds ? "Скрыть звуки" : "Показать звуки"}
        aria-pressed={showHeaderSounds}
      >
        <MenubarPanelIcon active={showHeaderSounds}>{icons.sounds}</MenubarPanelIcon>
      </button>
    </nav>
  );
}
