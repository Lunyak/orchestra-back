import React from "react";

export interface HeaderScriptStateProps {
  showPlaylist: boolean;
  onTogglePlaylist: () => void;
  showHeaderSounds: boolean;
  onToggleHeaderSounds: () => void;
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
  sounds: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
};

export const HeaderScriptStateNav: React.FC<HeaderScriptStateProps> = ({
  showPlaylist,
  onTogglePlaylist,
  showHeaderSounds,
  onToggleHeaderSounds,
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
  </nav>
);
