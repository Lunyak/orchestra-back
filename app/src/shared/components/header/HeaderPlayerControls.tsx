import cn from "classnames";
import type { LoadedTrack } from "./header-player-types";

type HeaderPlayerSettingsToggleProps = {
  showSettings: boolean;
  onToggle: () => void;
};

export function HeaderPlayerSettingsToggle({
  showSettings,
  onToggle,
}: HeaderPlayerSettingsToggleProps) {
  const hideLabel = "Скрыть настройки звуков";
  const showLabel = "Показать настройки звуков";
  const label = showSettings ? hideLabel : showLabel;
  const title = showSettings ? hideLabel : "Настройки звуков";

  return (
    <button
      className="header-player-settings-toggle"
      onClick={onToggle}
      type="button"
      aria-pressed={showSettings}
      aria-label={label}
      title={title}
    >
      <svg
        className="header-player-settings-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.51.4 1.05.71 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
        />
      </svg>
    </button>
  );
}

type HeaderPlayerTrackControlsProps = {
  track: LoadedTrack;
  onRename: (track: LoadedTrack) => void;
  onRestartOnStopChange: (track: LoadedTrack, value: boolean) => void;
  onLoopChange: (track: LoadedTrack, value: boolean) => void;
  onAddIcon: (track: LoadedTrack) => void;
};

export function HeaderPlayerTrackControls({
  track,
  onRename,
  onRestartOnStopChange,
  onLoopChange,
  onAddIcon,
}: HeaderPlayerTrackControlsProps) {
  return (
    <div className="header-player-settings">
      <button
        className="header-player-mini-toggle"
        type="button"
        title="Переименовать"
        aria-label="Переименовать"
        onClick={(event) => {
          event.stopPropagation();
          onRename(track);
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        className="header-player-mini-toggle"
        type="button"
        aria-pressed={track.restartOnStop}
        data-active={track.restartOnStop ? "true" : "false"}
        title="После стопа — с начала"
        aria-label="После стопа — с начала"
        onClick={(event) => {
          event.stopPropagation();
          onRestartOnStopChange(track, !track.restartOnStop);
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>
      <button
        className="header-player-mini-toggle"
        type="button"
        aria-pressed={track.loop}
        data-active={track.loop ? "true" : "false"}
        title="Цикл"
        aria-label="Цикл"
        onClick={(event) => {
          event.stopPropagation();
          void onLoopChange(track, !track.loop);
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </svg>
      </button>
      <button
        className="header-player-mini-toggle"
        onClick={(event) => {
          event.stopPropagation();
          onAddIcon(track);
        }}
        type="button"
        title="Иконка"
        aria-label="Иконка"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect width="18" height="18" x="3" y="3" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      </button>
    </div>
  );
}

type HeaderPlayerLoadTileProps = {
  uploading: boolean;
  title: string;
  onAdd: () => void;
};

export function HeaderPlayerLoadTile({ uploading, title, onAdd }: HeaderPlayerLoadTileProps) {
  const label = uploading ? "Загрузка…" : "+";

  return (
    <div
      className={cn(
        "header-player-track-row",
        "header-player-load-tile",
        uploading && "header-player-load-tile--uploading",
      )}
      onClick={onAdd}
      role="button"
      tabIndex={0}
      title={title}
      aria-disabled={uploading}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAdd();
        }
      }}
    >
      <div className="header-player-track-name">{label}</div>
      <div className="header-player-load-icon" aria-hidden="true">
        ↑
      </div>
    </div>
  );
}
