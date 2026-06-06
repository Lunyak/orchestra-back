import cn from "classnames";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import {
  getPlaylistVisualSnapshot,
  subscribePlaylistActiveTrack,
} from "../../../../features/scene/model/scene-playback-bridge";

type MarkdownTrackLinkProps = {
  trackId?: number;
  trackName?: string;
  onClick: () => void;
  children: ReactNode;
};

function readPlaylistVisualSnapshot() {
  return getPlaylistVisualSnapshot();
}

export function MarkdownTrackLink({
  trackId,
  trackName,
  onClick,
  children,
}: MarkdownTrackLinkProps) {
  const playback = useSyncExternalStore(
    subscribePlaylistActiveTrack,
    readPlaylistVisualSnapshot,
    readPlaylistVisualSnapshot,
  );

  const numericTrackId = trackId != null ? Number(trackId) : null;
  const activeTrackId = playback.trackId != null ? Number(playback.trackId) : null;
  const isPlayingThisTrack =
    playback.isPlaying &&
    numericTrackId != null &&
    activeTrackId != null &&
    activeTrackId === numericTrackId;

  return (
    <button
      type="button"
      className={cn("markdown-track-link", isPlayingThisTrack && "markdown-track-link--playing")}
      data-track-id={trackId != null ? String(trackId) : undefined}
      data-track-name={trackName}
      aria-pressed={isPlayingThisTrack || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
