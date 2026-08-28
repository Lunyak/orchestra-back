import cn from "classnames";
import type { Ref } from "react";
import { Buttons } from "../buttons/Buttons";
import { soundTrackHasIcon } from "../../platform/resolve-sound-icon-url";
import { SoundTrackIcon } from "./SoundTrackIcon";
import type { LoadedTrack } from "./header-player-types";
import { HeaderPlayerTrackControls } from "./HeaderPlayerControls";
import { HeaderPlayerTimeline } from "./HeaderPlayerTimeline";
import { HeaderPlayerVolume } from "./HeaderPlayerVolume";

type HeaderPlayerTrackRowProps = {
  track: LoadedTrack;
  projectName: string;
  showSettings: boolean;
  isRenaming: boolean;
  editingName: string;
  renameInputRef: Ref<HTMLInputElement>;
  onToggle: (track: LoadedTrack) => void;
  onEnded: (trackId: number) => void;
  onVolumeChange: (track: LoadedTrack, value: number) => void;
  onFadeChange: (track: LoadedTrack, value: number) => void;
  onRemove: (track: LoadedTrack) => void;
  onStartRename: (track: LoadedTrack) => void;
  onEditingNameChange: (value: string) => void;
  onApplyRename: (trackId: number) => void;
  onCancelRename: () => void;
  onRestartOnStopChange: (track: LoadedTrack, value: boolean) => void;
  onLoopChange: (track: LoadedTrack, value: boolean) => void;
  onAddIcon: (track: LoadedTrack) => void;
  bindAudioRef: (trackId: number, el: HTMLAudioElement | null) => void;
};

export function HeaderPlayerTrackRow({
  track,
  projectName,
  showSettings,
  isRenaming,
  editingName,
  renameInputRef,
  onToggle,
  onEnded,
  onVolumeChange,
  onFadeChange,
  onRemove,
  onStartRename,
  onEditingNameChange,
  onApplyRename,
  onCancelRename,
  onRestartOnStopChange,
  onLoopChange,
  onAddIcon,
  bindAudioRef,
}: HeaderPlayerTrackRowProps) {
  const volumePercent = Math.round(track.volume * 100);
  const rowTitle = `${track.name} · громкость ${volumePercent}% (колесо)`;
  const showTrackControls = showSettings && !isRenaming;

  return (
    <div
      data-sound-id={track.id}
      data-renaming={isRenaming ? "true" : undefined}
      className={cn(
        "header-player-track-row",
        track.isPlaying && "header-player-track-row--playing",
        showSettings && "header-player-track-row--settings-open",
        isRenaming && "header-player-track-row--renaming",
      )}
      onClick={() => {
        if (isRenaming) return;
        void onToggle(track);
      }}
      title={rowTitle}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (isRenaming) return;
          void onToggle(track);
        }
      }}
    >
      <audio
        ref={(el) => bindAudioRef(track.id, el)}
        onEnded={() => onEnded(track.id)}
      />
      <HeaderPlayerVolume track={track} onChange={onVolumeChange} />
      <HeaderPlayerTimeline track={track} onChange={onFadeChange} />
      {isRenaming ? (
        <input
          ref={renameInputRef}
          className="header-player-rename-input"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void onApplyRename(track.id);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancelRename();
            }
          }}
          onBlur={() => void onApplyRename(track.id)}
          aria-label="Переименовать звук"
        />
      ) : soundTrackHasIcon(track) ? (
        <SoundTrackIcon
          projectName={projectName}
          track={track}
          className="header-player-track-icon"
        />
      ) : (
        <div className="header-player-track-name" title={track.name}>
          {track.name}
        </div>
      )}
      <Buttons.DeleteButton
        className="header-player-remove"
        title="Удалить звук"
        aria-label="Удалить звук"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(track);
        }}
      />
      {showTrackControls ? (
        <HeaderPlayerTrackControls
          track={track}
          onRename={onStartRename}
          onRestartOnStopChange={onRestartOnStopChange}
          onLoopChange={onLoopChange}
          onAddIcon={onAddIcon}
        />
      ) : null}
    </div>
  );
}
