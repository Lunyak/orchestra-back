import cn from "classnames";
import type { CSSProperties } from "react";
import type { PlaylistTrack } from "../../types/playlist";

type PlaylistBottomControlsProps = {
  projectName: string;
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
  return (
    <div className="playlist-top-player" aria-label="Управление проигрывателем">
      <div className="playlist-top-player__inner">
        <div className="playlist-top-player__body">
          <div className="playlist-top-player__main">
            <div className="playlist-top-player__transport">
              <button
                type="button"
                className="playlist-top-player__skip"
                onClick={onPrevTrack}
                disabled={!canGoPrev}
                aria-label="Предыдущий трек"
                title="Предыдущий трек"
              >
                <svg
                  width="14"
                  height="14"
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
                className="playlist-top-player__play"
                onClick={onTogglePlayback}
                disabled={!currentTrack}
                aria-label={isPlaying ? "Пауза" : "Играть"}
                title={isPlaying ? "Пауза" : "Играть"}
              >
                {isPlaying ? (
                  <span className="playlist-top-player__pause" aria-hidden />
                ) : (
                  <span className="playlist-top-player__play-icon" aria-hidden />
                )}
              </button>
              <button
                type="button"
                className="playlist-top-player__skip"
                onClick={onNextTrack}
                disabled={!canGoNext}
                aria-label="Следующий трек"
                title="Следующий трек"
              >
                <svg
                  width="14"
                  height="14"
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

            <span className="playlist-top-player__title">
              {currentTrack?.title || "Трек не выбран"}
            </span>

            <input
              className={cn(
                "playlist-top-player__range",
                "playlist-top-player__range--progress",
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

            <span className="playlist-top-player__time">
              {formatTime(progress)} / {formatTime(duration)}
            </span>

            <label className="playlist-top-player__volume">
              <span className="playlist-top-player__volume-label">Громкость</span>
              <input
                className={cn(
                  "playlist-top-player__range",
                  "playlist-top-player__range--volume",
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
        </div>
      </div>
    </div>
  );
}
