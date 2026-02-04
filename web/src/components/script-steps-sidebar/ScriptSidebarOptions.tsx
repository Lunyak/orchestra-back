import React from 'react';

interface ScriptSidebarOptionsProps {
  showRequisites: boolean;
  onToggleRequisites: () => void;
  showPlaylist: boolean;
  onTogglePlaylist: () => void;
  showHeaderSounds: boolean;
  onToggleHeaderSounds: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

export const ScriptSidebarOptions: React.FC<ScriptSidebarOptionsProps> = ({
  showRequisites,
  onToggleRequisites,
  showPlaylist,
  onTogglePlaylist,
  showHeaderSounds,
  onToggleHeaderSounds,
  isCollapsed,
  onToggleCollapsed,
}) => {
  return (
    <div className="script-sidebar-options">
      <button
        type="button"
        className="script-requisites-toggle"
        onClick={onTogglePlaylist}
        aria-pressed={showPlaylist}
        title={showPlaylist ? 'Скрыть плейлист' : 'Показать плейлист'}
        data-open={showPlaylist ? 'true' : 'false'}
      >
        Плейлист
      </button>
      <button
        type="button"
        className="script-requisites-toggle"
        onClick={onToggleHeaderSounds}
        aria-pressed={showHeaderSounds}
        title={showHeaderSounds ? 'Скрыть звуки' : 'Показать звуки'}
        data-open={showHeaderSounds ? 'true' : 'false'}
      >
        Звуки
      </button>
      <button
        type="button"
        className="script-requisites-toggle"
        onClick={onToggleRequisites}
        aria-pressed={showRequisites}
        title={showRequisites ? 'Скрыть реквизит' : 'Показать реквизит'}
        data-open={showRequisites ? 'true' : 'false'}
      >
        Реквизит
      </button>
      <button
        type="button"
        className="script-requisites-toggle"
        onClick={onToggleCollapsed}
        aria-pressed={isCollapsed}
        title={isCollapsed ? 'Показать шаги' : 'Скрыть шаги'}
        data-open={isCollapsed ? 'false' : 'true'}
      >
        Шаги
      </button>
    </div>
  );
};

