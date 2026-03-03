import React from "react";

export interface HeaderScriptStateProps {
  showRequisites: boolean;
  onToggleRequisites: () => void;
  showPlaylist: boolean;
  onTogglePlaylist: () => void;
  showHeaderSounds: boolean;
  onToggleHeaderSounds: () => void;
  showRoles: boolean;
  onToggleRoles: () => void;
  isStepsCollapsed: boolean;
  onToggleStepsCollapsed: () => void;
}

const icons = {
  steps: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  playlist: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  requisite: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 6l6-3 3 3-3 6-3 3" />
      <path d="M9.5 17.5L21 9v3l-9.5 9.5-3-3z" />
    </svg>
  ),
  sounds: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  roles: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
};

export const HeaderScriptStateNav: React.FC<HeaderScriptStateProps> = ({
  showRequisites,
  onToggleRequisites,
  showPlaylist,
  onTogglePlaylist,
  showHeaderSounds,
  onToggleHeaderSounds,
  showRoles,
  onToggleRoles,
  isStepsCollapsed,
  onToggleStepsCollapsed,
}) => (
  <nav className="header-script-state-nav" aria-label="Состояние страницы сценария">
    <button
      type="button"
      className={`header-nav-btn ${!isStepsCollapsed ? "active" : ""}`}
      onClick={onToggleStepsCollapsed}
      title={isStepsCollapsed ? "Показать шаги" : "Скрыть шаги"}
      aria-label={isStepsCollapsed ? "Показать шаги" : "Скрыть шаги"}
      aria-pressed={!isStepsCollapsed}
    >
      <span className="header-nav-icon">{icons.steps}</span>
    </button>
    <button
      type="button"
      className={`header-nav-btn ${showPlaylist ? "active" : ""}`}
      onClick={onTogglePlaylist}
      title={showPlaylist ? "Скрыть плейлист" : "Показать плейлист"}
      aria-label={showPlaylist ? "Скрыть плейлист" : "Показать плейлист"}
      aria-pressed={showPlaylist}
    >
      <span className="header-nav-icon">{icons.playlist}</span>
    </button>
    <button
      type="button"
      className={`header-nav-btn ${showHeaderSounds ? "active" : ""}`}
      onClick={onToggleHeaderSounds}
      title={showHeaderSounds ? "Скрыть звуки" : "Показать звуки"}
      aria-label={showHeaderSounds ? "Скрыть звуки" : "Показать звуки"}
      aria-pressed={showHeaderSounds}
    >
      <span className="header-nav-icon">{icons.sounds}</span>
    </button>
    <button
      type="button"
      className={`header-nav-btn ${showRequisites ? "active" : ""}`}
      onClick={onToggleRequisites}
      title={showRequisites ? "Скрыть реквизит" : "Показать реквизит"}
      aria-label={showRequisites ? "Скрыть реквизит" : "Показать реквизит"}
      aria-pressed={showRequisites}
    >
      <span className="header-nav-icon">{icons.requisite}</span>
    </button>
    <button
      type="button"
      className={`header-nav-btn ${showRoles ? "active" : ""}`}
      onClick={onToggleRoles}
      title={showRoles ? "Скрыть роли" : "Показать роли"}
      aria-label={showRoles ? "Скрыть роли" : "Показать роли"}
      aria-pressed={showRoles}
    >
      <span className="header-nav-icon">{icons.roles}</span>
    </button>
  </nav>
);
