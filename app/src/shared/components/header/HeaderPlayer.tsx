import React from "react";
import {
  HeaderPlayerLoadTile,
  HeaderPlayerSettingsToggle,
} from "./HeaderPlayerControls";
import { HeaderPlayerTrackRow } from "./HeaderPlayerTrackRow";
import type { HeaderPlayerProps, HeaderSound } from "./header-player-types";
import { useHeaderPlayer } from "./useHeaderPlayer";
import "./style.css";

export type { HeaderSound, HeaderPlayerProps };

export const HeaderPlayer: React.FC<HeaderPlayerProps> = (props) => {
  const vm = useHeaderPlayer(props);

  return (
    <div className="header-player">
      <input
        ref={vm.fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="native-file-input--hidden"
        onChange={vm.handleAudioFilesChange}
      />
      <input
        ref={vm.iconInputRef}
        type="file"
        accept="image/*"
        className="native-file-input--hidden"
        onChange={vm.handleIconFileChange}
      />
      {vm.showSettingsToggle ? (
        <HeaderPlayerSettingsToggle
          showSettings={vm.showSettings}
          onToggle={vm.toggleSettings}
        />
      ) : null}

      <div className="header-player-list" ref={vm.tracksListRef}>
        {vm.tracks.map((track) => (
          <HeaderPlayerTrackRow
            key={track.id}
            track={track}
            projectName={vm.projectName}
            showSettings={vm.showSettings}
            isRenaming={vm.editingId === track.id}
            editingName={vm.editingName}
            renameInputRef={vm.renameInputRef}
            onToggle={vm.toggleTrack}
            onEnded={vm.markTrackEnded}
            onVolumeChange={vm.handleVolumeChange}
            onFadeChange={vm.handleFadeChange}
            onRemove={vm.removeTrack}
            onStartRename={vm.startRename}
            onEditingNameChange={vm.setEditingName}
            onApplyRename={vm.applyRename}
            onCancelRename={vm.cancelRename}
            onRestartOnStopChange={vm.handleRestartOnStopChange}
            onLoopChange={vm.handleLoopChange}
            onAddIcon={vm.addIcon}
            bindAudioRef={vm.bindAudioRef}
          />
        ))}
        <HeaderPlayerLoadTile
          uploading={vm.soundsUpload.uploading}
          title={vm.loadTileTitle}
          onAdd={vm.addTracks}
        />
        {vm.showEmpty ? (
          <div className="header-player-empty">{vm.emptyMessage}</div>
        ) : null}
      </div>
    </div>
  );
};
