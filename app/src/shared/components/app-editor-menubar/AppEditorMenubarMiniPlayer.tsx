import cn from "classnames";
import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { isProjectPath } from "../../../app/router/paths";
import {
  getPlaylistPlaybackSnapshot,
  getPlaylistProgressSnapshot,
  getPlaylistVisualSnapshot,
  invokePlaylistNext,
  invokePlaylistPrev,
  invokePlaylistSeek,
  invokePlaylistToggle,
  subscribePlaylistActiveTrack,
  subscribePlaylistProgress,
} from "../../../features/playbook/model/playbook-playback-bridge";
import { useProject } from "../../../features/project";
import { useScriptUI } from "../../../features/script-ui";
import { useIsMobile } from "../../hooks/useIsMobile";

export function AppEditorMenubarMiniPlayer() {
  const { pathname } = useLocation();
  const { projectName } = useProject();
  const isMobile = useIsMobile();
  const { showPlaylistSidebar, mobilePlaylistOpen } = useScriptUI();
  const isProjectRoute = isProjectPath(pathname);
  const isPlaylistVisible = isMobile ? mobilePlaylistOpen : showPlaylistSidebar;

  const visual = useSyncExternalStore(
    subscribePlaylistActiveTrack,
    getPlaylistVisualSnapshot,
    getPlaylistVisualSnapshot,
  );
  const progressState = useSyncExternalStore(
    subscribePlaylistProgress,
    getPlaylistProgressSnapshot,
    getPlaylistProgressSnapshot,
  );
  const snapshot = getPlaylistPlaybackSnapshot();
  const isPlaying = visual.isPlaying;
  const trackTitle = snapshot.trackTitle?.trim() || "Трек не выбран";
  const progress = progressState.progress;
  const duration = progressState.duration;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
  const progressStyle = {
    ["--mini-progress" as string]: `${progressPercent}%`,
  } as CSSProperties;

  const shouldShow =
    Boolean(projectName) &&
    isProjectRoute &&
    !isPlaylistVisible;

  if (!shouldShow) return null;

  return (
    <div className="app-editor-menubar__mini-player" aria-label="Мини-проигрыватель">
      <button
        type="button"
        className="app-editor-menubar__mini-player-skip"
        onClick={invokePlaylistPrev}
        aria-label="Предыдущий трек"
        title="Предыдущий трек"
      >
        <svg
          width="12"
          height="12"
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
        className={cn(
          "app-editor-menubar__mini-player-play",
          isPlaying && "app-editor-menubar__mini-player-play--active",
        )}
        onClick={invokePlaylistToggle}
        aria-label={isPlaying ? "Пауза" : "Играть"}
        title={isPlaying ? "Пауза" : "Играть"}
      >
        {isPlaying ? (
          <span className="app-editor-menubar__mini-player-pause" aria-hidden />
        ) : (
          <span className="app-editor-menubar__mini-player-play-icon" aria-hidden />
        )}
      </button>
      <button
        type="button"
        className="app-editor-menubar__mini-player-skip"
        onClick={invokePlaylistNext}
        aria-label="Следующий трек"
        title="Следующий трек"
      >
        <svg
          width="12"
          height="12"
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
      <div className="app-editor-menubar__mini-player-meta">
        <span className="app-editor-menubar__mini-player-title" title={trackTitle}>
          {trackTitle}
        </span>
        <input
          className="app-editor-menubar__mini-player-progress"
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={Math.min(progress, duration || 0)}
          style={progressStyle}
          onChange={(event) => invokePlaylistSeek(Number(event.target.value))}
          disabled={duration <= 0}
          aria-label="Прогресс трека"
        />
      </div>
    </div>
  );
}
