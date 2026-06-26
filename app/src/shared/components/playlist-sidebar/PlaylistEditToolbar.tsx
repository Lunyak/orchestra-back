import React from "react";
import { scriptUiActions } from "../../../features/script-ui/model/script-ui-slice";
import { useAppDispatch } from "../../store/hooks";

type PlaylistEditToolbarProps = {
  isEditMode: boolean;
  uiMessage: string | null;
  crossfadeEnabled: boolean;
  preloadRunning: boolean;
  preloadDone: number;
  playlistLength: number;
  onPreparePlaylist: () => void;
  onCancelPrepare: () => void;
};

export function PlaylistEditToolbar({
  isEditMode,
  uiMessage,
  crossfadeEnabled,
  preloadRunning,
  preloadDone,
  playlistLength,
  onPreparePlaylist,
  onCancelPrepare,
}: PlaylistEditToolbarProps) {
  const dispatch = useAppDispatch();

  if (!isEditMode && !uiMessage) {
    return null;
  }

  return (
    <div className="playlist-controls compact">
      {isEditMode ? (
        <div className="playlist-controls-row">
          <button
            type="button"
            className="playlist-action-btn playlist-prepare-btn"
            onClick={onPreparePlaylist}
            disabled={preloadRunning || playlistLength === 0}
            title="Фоновая подготовка треков (буферизация), чтобы в спектакле запускалось без ожидания"
          >
            {preloadRunning ? "Готовлю…" : "Подготовить"}
            {playlistLength > 0 ? ` (${preloadDone}/${playlistLength})` : ""}
          </button>
          {preloadRunning ? (
            <button
              type="button"
              className="playlist-action-btn danger playlist-prepare-stop-btn"
              onClick={onCancelPrepare}
              title="Остановить подготовку"
            >
              Стоп
            </button>
          ) : null}
        </div>
      ) : null}
      {uiMessage ? <div className="playlist-empty">{uiMessage}</div> : null}
      {isEditMode ? (
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
      ) : null}
    </div>
  );
}
