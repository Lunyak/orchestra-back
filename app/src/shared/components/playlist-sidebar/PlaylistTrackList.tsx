import cn from "classnames";
import React from "react";
import { invokePlaylistPlay } from "../../../features/playbook/model/playbook-playback-bridge";
import type { PlaylistTrack } from "../../types/playlist";
import { Buttons } from "../buttons/Buttons";
import { ListItem } from "../list-item/ListItem";
import { PLAYLIST_REORDER_MIME } from "./usePlaylistTrackActions";
import { PROJECT_ONBOARDING_PLAYLIST_ADD_ATTR } from "../../../features/project/model/project-onboarding";

type PlaylistTrackListProps = {
  playlist: PlaylistTrack[];
  highlightedTrack: PlaylistTrack | null;
  isEditMode: boolean;
  showPlayer: boolean;
  playlistUploading: boolean;
  addButtonTitle: string;
  desktopAvailable: boolean;
  editingId: number | null;
  editingTitle: string;
  dragOverTrackId: number | null;
  preloadStatusById: Record<number, "idle" | "loading" | "ready" | "error">;
  onPlayTrack: (track: PlaylistTrack) => void;
  onAddTracks: () => void;
  onSetEditingTitle: (value: string) => void;
  onStartRename: (track: PlaylistTrack) => void;
  onCancelRename: () => void;
  onApplyRename: (track: PlaylistTrack) => void;
  onUpdateFade: (track: PlaylistTrack, nextFade: number) => void;
  onUpdateLoop: (track: PlaylistTrack, nextLoop: boolean) => void;
  onDeleteTrack: (track: PlaylistTrack) => void;
  onSetDragOverTrackId: (value: number | null | ((prev: number | null) => number | null)) => void;
  onReorderTrack: (fromIndex: number, toIndex: number) => void;
};

export function PlaylistTrackList({
  playlist,
  highlightedTrack,
  isEditMode,
  showPlayer,
  playlistUploading,
  addButtonTitle,
  desktopAvailable,
  editingId,
  editingTitle,
  dragOverTrackId,
  preloadStatusById,
  onPlayTrack,
  onAddTracks,
  onSetEditingTitle,
  onStartRename,
  onCancelRename,
  onApplyRename,
  onUpdateFade,
  onUpdateLoop,
  onDeleteTrack,
  onSetDragOverTrackId,
  onReorderTrack,
}: PlaylistTrackListProps) {
  return (
    <div className="playlist-tracks">
      {playlist.length === 0 ? (
        <div className="playlist-empty">Треки не добавлены</div>
      ) : (
        playlist.map((track, index) => {
          const trackIsHighlighted = Number(highlightedTrack?.id) === Number(track.id);
          const trackIsDragOver = dragOverTrackId === track.id;
          const preloadState = preloadStatusById[track.id] ?? "idle";
          const preloadTitle =
            preloadState === "ready"
              ? "Готов"
              : preloadState === "loading"
                ? "Грузится…"
                : preloadState === "error"
                  ? "Ошибка загрузки"
                  : "Не готов";
          const fadeMs = track.fadeMs ?? 500;
          const fadeFillPercent = Math.min(100, Math.max(0, (fadeMs / 3000) * 100));
          const loopEnabled = track.loop ?? false;
          const trackLabel = `${index + 1}. ${track.title}`;

          return (
            <ListItem
              key={track.id}
              className={cn(
                "playlist-track-row",
                trackIsHighlighted && "list-item--active",
                trackIsHighlighted && "playlist-track-row--active",
                isEditMode && "playlist-track-row--edit-mode",
                trackIsDragOver && "playlist-track-row--drag-over",
              )}
              draggable={isEditMode}
              onDragStart={(event) => {
                if (!isEditMode) return;
                if (!event.dataTransfer) return;
                onSetDragOverTrackId(null);
                try {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(PLAYLIST_REORDER_MIME, String(index));
                } catch {
                  // ignore
                }
              }}
              onDragOver={(event) => {
                if (!isEditMode) return;
                const types = Array.from(event.dataTransfer?.types ?? []);
                if (!types.includes(PLAYLIST_REORDER_MIME)) return;
                event.preventDefault();
                onSetDragOverTrackId(track.id);
              }}
              onDragLeave={() => {
                onSetDragOverTrackId((prev) => (prev === track.id ? null : prev));
              }}
              onDrop={(event) => {
                if (!isEditMode) return;
                const types = Array.from(event.dataTransfer?.types ?? []);
                if (!types.includes(PLAYLIST_REORDER_MIME)) return;
                event.preventDefault();
                event.stopPropagation();
                const raw = event.dataTransfer.getData(PLAYLIST_REORDER_MIME);
                const fromIndex = Number(raw);
                const toIndex = index;
                onSetDragOverTrackId(null);
                if (!Number.isFinite(fromIndex) || fromIndex < 0) return;
                if (fromIndex === toIndex) return;
                if (toIndex < 0 || toIndex >= playlist.length) return;
                onReorderTrack(fromIndex, toIndex);
              }}
              onDragEnd={() => onSetDragOverTrackId(null)}
            >
              <div className="playlist-track-row-main">
                <button
                  className="playlist-track-btn"
                  onClick={() => {
                    if (showPlayer) {
                      onPlayTrack(track);
                      return;
                    }
                    invokePlaylistPlay(track.id);
                  }}
                  title={track.title}
                >
                  {editingId === track.id ? (
                    <input
                      className="playlist-track-input"
                      value={editingTitle}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(event) => onSetEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void onApplyRename(track);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          onCancelRename();
                        }
                      }}
                      onBlur={() => void onApplyRename(track)}
                      placeholder="Название трека"
                      autoFocus
                    />
                  ) : (
                    <span
                      className={cn(
                        "playlist-track-title",
                        isEditMode && "playlist-track-title--editable",
                      )}
                      onClick={(e) => {
                        if (!isEditMode) return;
                        e.preventDefault();
                        e.stopPropagation();
                        onStartRename(track);
                      }}
                      title={isEditMode ? "Переименовать" : track.title}
                    >
                      {trackLabel}
                    </span>
                  )}
                </button>
                <div className="playlist-track-row-meta">
                  <span
                    className="playlist-preload-dot"
                    data-state={preloadState}
                    aria-hidden="true"
                    title={preloadTitle}
                  />
                  <Buttons.DeleteButton
                    className="playlist-track-btn-delete"
                    variant="scene"
                    onClick={() => void onDeleteTrack(track)}
                    title="Удалить трек"
                    aria-label="Удалить трек"
                  />
                </div>
              </div>

              {isEditMode ? (
                <div
                  className="playlist-track-settings"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    className="playlist-track-icon-btn"
                    data-active={loopEnabled}
                    aria-pressed={loopEnabled}
                    onClick={() => void onUpdateLoop(track, !loopEnabled)}
                    title={loopEnabled ? "Зацикливание включено" : "Зацикливание выключено"}
                    aria-label="Зацикливание"
                  >
                    ∞
                  </button>

                  <div className="playlist-track-fade">
                    <input
                      className="playlist-top-player__range"
                      type="range"
                      min={0}
                      max={3000}
                      step={100}
                      value={fadeMs}
                      title={`Fade: ${fadeMs}мс`}
                      aria-label={`Fade ${fadeMs} миллисекунд`}
                      style={
                        {
                          ["--range-fill" as unknown as string]: `${fadeFillPercent}%`,
                        } as React.CSSProperties
                      }
                      onChange={(event) => void onUpdateFade(track, Number(event.target.value))}
                    />
                  </div>
                </div>
              ) : null}
            </ListItem>
          );
        })
      )}
      <Buttons.AddButton
        onClick={onAddTracks}
        disabled={playlistUploading}
        title={addButtonTitle}
        aria-disabled={!desktopAvailable || playlistUploading}
        aria-label={addButtonTitle}
        data-onboarding={PROJECT_ONBOARDING_PLAYLIST_ADD_ATTR}
      />
    </div>
  );
}
