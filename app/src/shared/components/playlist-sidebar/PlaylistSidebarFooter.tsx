import cn from "classnames";
import React from "react";
import { scriptUiActions } from "../../../features/script-ui/model/script-ui-slice";
import { useAppDispatch } from "../../store/hooks";
import { AppEditorPlaylistEditToggle } from "../app-editor-menubar/AppEditorPlaylistEditToggle";

type PlaylistSidebarFooterProps = {
  isEditMode: boolean;
  uiMessage: string | null;
  crossfadeEnabled: boolean;
  preloadRunning: boolean;
  preloadDone: number;
  playlistLength: number;
  onPreparePlaylist: () => void;
  onCancelPrepare: () => void;
};

export function PlaylistSidebarFooter({
  isEditMode,
  uiMessage,
  crossfadeEnabled,
  preloadRunning,
  preloadDone,
  playlistLength,
  onPreparePlaylist,
  onCancelPrepare,
}: PlaylistSidebarFooterProps) {
  const dispatch = useAppDispatch();

  const prepareCountLabel =
    playlistLength > 0 ? `${preloadDone}/${playlistLength}` : null;
  const prepareTitle = preloadRunning
    ? "Идёт подготовка треков"
    : "Фоновая подготовка треков (буферизация)";

  return (
    <footer className="playlist-sidebar__footer">
      <AppEditorPlaylistEditToggle />
      <div className="playlist-controls compact">
        {isEditMode ? (
          <div className="playlist-controls-row playlist-controls-row--toolbar">
            <div className="playlist-prepare">
              <button
                type="button"
                className={cn(
                  "playlist-prepare-btn",
                  preloadRunning && "playlist-prepare-btn--running",
                )}
                onClick={onPreparePlaylist}
                disabled={preloadRunning || playlistLength === 0}
                title={prepareTitle}
                aria-label={prepareTitle}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </button>
              {prepareCountLabel ? (
                <span className="playlist-prepare__count">{prepareCountLabel}</span>
              ) : null}
              {preloadRunning ? (
                <button
                  type="button"
                  className="playlist-prepare-stop-btn"
                  onClick={onCancelPrepare}
                  title="Остановить подготовку"
                  aria-label="Остановить подготовку"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <rect x="6" y="6" width="12" height="12" />
                  </svg>
                </button>
              ) : null}
            </div>

            <label className="playlist-crossfade">
              <input
                type="checkbox"
                checked={crossfadeEnabled}
                onChange={(event) =>
                  dispatch(
                    scriptUiActions.setPlaylistCrossfadeEnabled({
                      value: event.target.checked,
                    }),
                  )
                }
              />
              <span className="playlist-crossfade__switch" aria-hidden="true" />
              <span className="playlist-crossfade__text">Кроссфейд</span>
            </label>
          </div>
        ) : null}
        {uiMessage ? <div className="playlist-empty">{uiMessage}</div> : null}
      </div>
    </footer>
  );
}
