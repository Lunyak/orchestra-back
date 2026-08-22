import { useCallback } from "react";
import cn from "classnames";
import { scriptUiActions } from "../../../features/script-ui/model/script-ui-slice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";

export function AppEditorPlaylistEditToggle() {
  const dispatch = useAppDispatch();
  const playlistEditMode = useAppSelector((s) => s.scriptUi.playlistEditMode);
  const toggle = useCallback(
    () => dispatch(scriptUiActions.togglePlaylistEditMode()),
    [dispatch],
  );

  const isActive = playlistEditMode;
  const label = isActive ? "Закрыть настройки" : "Настройки";

  return (
    <button
      type="button"
      className={cn(
        "app-editor-menubar__panel-btn",
        "app-editor-menubar__panel-btn--playlist-edit",
        isActive ? "app-editor-menubar__panel-btn--active" : "app-editor-menubar__panel-btn--muted",
      )}
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={isActive}
    >
      <span className="app-editor-menubar__panel-icon">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.54V22a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.54V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.54 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.7 1.7 0 0 0-1.51 1z" />
        </svg>
      </span>
    </button>
  );
}
