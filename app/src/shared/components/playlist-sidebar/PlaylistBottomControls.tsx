import cn from "classnames";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { usePlayerDockHidden } from "../../player/usePlayerDockHidden";
import type { PlaylistTrack } from "../../types/playlist";

type PlaylistBottomControlsProps = {
  currentTrack: PlaylistTrack | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  progressPercent: number;
  volumePercent: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onTogglePlayback: () => void;
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
  canGoPrev,
  canGoNext,
  onPrevTrack,
  onNextTrack,
  onTogglePlayback,
  onSeek,
  onVolumeChange,
  formatTime,
}: PlaylistBottomControlsProps) {
  const { playerDockHidden } = usePlayerDockHidden();

  if (typeof document === "undefined") return null;
  if (playerDockHidden) return null;

  return createPortal(
    <div
      className="playlist-bottom-player"
      aria-label="Управление проигрывателем"
    >
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
            <label className="playlist-bottom-player__volume">
              <span className="playlist-bottom-player__volume-label">Громкость</span>
              <input
                className={cn(
                  "playlist-bottom-player__range",
                  "playlist-bottom-player__range--volume",
                )}
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
                aria-label="Громкость"
              />
            </label>
          </div>
          <input
            className={cn(
              "playlist-bottom-player__range",
              "playlist-bottom-player__range--progress",
            )}
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
      </div>
    </div>,
    document.body,
  );
}
