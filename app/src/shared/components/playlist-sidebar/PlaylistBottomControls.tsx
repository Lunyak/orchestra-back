import { useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import type { PlaylistTrack } from "../../types/playlist";

type PlaylistBottomControlsProps = {
  currentTrack: PlaylistTrack | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  progressPercent: number;
  volumePercent: number;
  isEditMode: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onTogglePlayback: () => void;
  onToggleEditMode: () => void;
  onSeek: (value: number) => void;
  onVolumeChange: (value: number) => void;
  formatTime: (value: number) => string;
};

export function PlaylistBottomControls({
  currentTrack,
  isPlaying,
  progress,
  duration,
  volume,
  progressPercent,
  volumePercent,
  isEditMode,
  canGoPrev,
  canGoNext,
  onPrevTrack,
  onNextTrack,
  onTogglePlayback,
  onToggleEditMode,
  onSeek,
  onVolumeChange,
  formatTime,
}: PlaylistBottomControlsProps) {
  const [hidden, setHidden] = useState(false);

  if (typeof document === "undefined") return null;
  if (hidden) {
    return createPortal(
      <button
        type="button"
        className="playlist-bottom-player-reveal"
        onClick={() => setHidden(false)}
        aria-label="Показать проигрыватель"
        title="Показать проигрыватель"
      >
        <span className="playlist-bottom-player__play-icon" aria-hidden />
      </button>,
      document.body,
    );
  }

  return createPortal(
    <div className="playlist-bottom-player" aria-label="Управление проигрывателем">
      <div className="playlist-bottom-player__inner">
        <div className="playlist-bottom-player__transport">
          <button
            type="button"
            className="playlist-bottom-player__skip"
            onClick={onPrevTrack}
            disabled={!canGoPrev}
            aria-label="Предыдущий трек"
            title="Предыдущий трек"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className="playlist-bottom-player__play"
            onClick={onTogglePlayback}
            disabled={!currentTrack}
            aria-label={isPlaying ? "Пауза" : "Играть"}
            title={isPlaying ? "Пауза" : "Играть"}
          >
            {isPlaying ? (
              <span className="playlist-bottom-player__pause" aria-hidden />
            ) : (
              <span className="playlist-bottom-player__play-icon" aria-hidden />
            )}
          </button>
          <button
            type="button"
            className="playlist-bottom-player__skip"
            onClick={onNextTrack}
            disabled={!canGoNext}
            aria-label="Следующий трек"
            title="Следующий трек"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <div className="playlist-bottom-player__main">
          <div className="playlist-bottom-player__meta">
            <span className="playlist-bottom-player__label">Плейлист</span>
            <span className="playlist-bottom-player__title">
              {currentTrack?.title || "Трек не выбран"}
            </span>
            <span className="playlist-bottom-player__time">
              {formatTime(progress)} / {formatTime(duration)}
            </span>
          </div>
          <input
            className="playlist-bottom-player__range playlist-bottom-player__range--progress"
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={Math.min(progress, duration || 0)}
            style={
              {
                ["--range-fill" as unknown as string]: `${progressPercent}%`,
              } as CSSProperties
            }
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={!currentTrack || duration <= 0}
            aria-label="Позиция трека"
          />
        </div>

        <label className="playlist-bottom-player__volume">
          <span>Громкость</span>
          <input
            className="playlist-bottom-player__range playlist-bottom-player__range--volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            style={
              {
                ["--range-fill" as unknown as string]: `${volumePercent}%`,
              } as CSSProperties
            }
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
        </label>

        <button
          type="button"
          className="playlist-bottom-player__hide"
          onClick={() => setHidden(true)}
          aria-label="Скрыть проигрыватель"
          title="Скрыть проигрыватель"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          className="playlist-toggle-btn playlist-bottom-player__settings"
          onClick={onToggleEditMode}
          aria-pressed={isEditMode}
          title={isEditMode ? "Закрыть настройки плейлиста" : "Настройки плейлиста"}
          aria-label={isEditMode ? "Закрыть настройки плейлиста" : "Настройки плейлиста"}
        >
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
        </button>
      </div>
    </div>,
    document.body,
  );
}
