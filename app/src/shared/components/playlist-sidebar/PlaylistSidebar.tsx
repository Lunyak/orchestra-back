import cn from "classnames";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { PlaylistPlayOptions } from "../../../features/playbook/model/playbook-playback-bridge";
import { usePlaybookActions } from "../../../features/playbook";
import { usePlayerVolume } from "../../player/usePlayerVolume";
import { useAppSelector } from "../../store/hooks";
import type { PlaylistTrack } from "../../types/playlist";
import { HeaderPlayer } from "../header/HeaderPlayer";
import { PlaylistBottomControls } from "./PlaylistBottomControls";
import { PlaylistSidebarFooter } from "./PlaylistSidebarFooter";
import { formatPlaylistTime } from "./playlist-format-time";
import { PlaylistTrackList } from "./PlaylistTrackList";
import { usePlaylistPlayback } from "./usePlaylistPlayback";
import { usePlaylistTrackActions } from "./usePlaylistTrackActions";
import "./style.css";

interface PlaylistSidebarProps {
  projectName: string;
  sceneName?: string;
  onRegisterPlayHandler?: (handler: (trackId: number, options?: PlaylistPlayOptions) => void) => void;
  mode?: "full" | "player" | "list";
}

const EMPTY_PLAYLIST: PlaylistTrack[] = [];
const EMPTY_SOUNDS: never[] = [];

export const PlaylistSidebar: React.FC<PlaylistSidebarProps> = ({
  projectName,
  sceneName = "script",
  onRegisterPlayHandler,
  mode = "full",
}) => {
  const playlist = useAppSelector(
    (s) => (s.playbook.playbookData?.playlist as PlaylistTrack[] | undefined) ?? EMPTY_PLAYLIST,
  );
  const sounds = useAppSelector((s) => s.playbook.playbookData?.sounds ?? EMPTY_SOUNDS);
  const playlistUpload = useAppSelector((s) => s.playbook.playlistUpload);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const isEditMode = useAppSelector((s) => s.scriptUi.playlistEditMode);
  const crossfadeEnabled = useAppSelector((s) => s.scriptUi.playlistCrossfadeEnabled);
  const { pushPlaybookAfterSoundsSave, registerSoundToggle } = usePlaybookActions();

  const { volume, setVolume } = usePlayerVolume();
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const messageTimerRef = useRef<number | null>(null);

  const showMessage = useCallback((message: string) => {
    setUiMessage(message);
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = window.setTimeout(() => {
      setUiMessage(null);
      messageTimerRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    if (playlistUpload.error) {
      showMessage(playlistUpload.error);
    }
  }, [playlistUpload.error, showMessage]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  const showPlayer = mode !== "list";
  const showSidebar = mode !== "player";
  const mountAudioHost = showPlayer || Boolean(onRegisterPlayHandler);
  const showSoundsPanel = Boolean(projectName);

  const playback = usePlaylistPlayback({
    projectName,
    sceneName,
    playlist,
    accessToken,
    crossfadeEnabled,
    volume,
    setVolume,
    onRegisterPlayHandler,
    showPlayer,
  });

  const trackActions = usePlaylistTrackActions({
    projectName,
    sceneName,
    playlist,
    playlistUploading: playlistUpload.uploading,
    isEditMode,
    onShowMessage: showMessage,
    onTrackDeleted: (track) => {
      playback.stopAudioForTrack(track.id);
    },
  });

  const handlePreparePlaylist = () => {
    void playback.preparePlaylist();
  };

  const playerControls = showPlayer ? (
    <PlaylistBottomControls
      projectName={projectName}
      currentTrack={playback.currentTrack}
      isPlaying={playback.isPlaying}
      progress={playback.progress}
      duration={playback.duration}
      volume={volume}
      progressPercent={playback.progressPercent}
      volumePercent={playback.volumePercent}
      canGoPrev={playback.canGoPrevTrack}
      canGoNext={playback.canGoNextTrack}
      onPrevTrack={playback.playPreviousTrack}
      onNextTrack={playback.playNextTrack}
      onTogglePlayback={playback.togglePlayback}
      onSeek={playback.seekPlayer}
      onVolumeChange={playback.setPlayerVolume}
      formatTime={formatPlaylistTime}
    />
  ) : null;

  return (
    <>
      {mountAudioHost ? (
        <div className="playlist-audio-host" aria-hidden="true">
          <audio ref={playback.audioRefA} />
          <audio ref={playback.audioRefB} />
        </div>
      ) : null}
      {showSidebar ? (
        <aside
          className={cn(
            "playlist-sidebar",
            trackActions.isDragOver && "playlist-sidebar--drag-over",
            showSoundsPanel && "playlist-sidebar--with-sounds",
          )}
          onDragOver={trackActions.handleDragOver}
          onDragLeave={trackActions.handleDragLeave}
          onDrop={trackActions.handleDrop}
        >
          <input
            ref={trackActions.fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="native-file-input--hidden"
            onChange={trackActions.handleWebFileInputChange}
          />
          <div className="playlist-sidebar__tracks">
            <PlaylistTrackList
              playlist={playlist}
              highlightedTrack={playback.highlightedTrack}
              isEditMode={isEditMode}
              showPlayer={showPlayer}
              playlistUploading={playlistUpload.uploading}
              addButtonTitle={trackActions.addButtonTitle}
              desktopAvailable={trackActions.desktopAvailable}
              editingId={trackActions.editingId}
              editingTitle={trackActions.editingTitle}
              dragOverTrackId={trackActions.dragOverTrackId}
              preloadStatusById={playback.preloadStatusById}
              onPlayTrack={(track) => void playback.playTrack(track)}
              onAddTracks={() => void trackActions.addTracks()}
              onSetEditingTitle={trackActions.setEditingTitle}
              onStartRename={trackActions.startRename}
              onCancelRename={trackActions.cancelRename}
              onApplyRename={trackActions.applyRename}
              onUpdateFade={trackActions.updateFade}
              onUpdateLoop={trackActions.updateLoop}
              onDeleteTrack={trackActions.deleteTrack}
              onSetDragOverTrackId={trackActions.setDragOverTrackId}
              onReorderTrack={trackActions.reorderTrack}
            />
          </div>
          {showSoundsPanel ? (
            <div className="playlist-sidebar__sounds" aria-label="Звуки сцены">
              <HeaderPlayer
                projectName={projectName}
                sceneName="script"
                sounds={sounds}
                onSoundsSaved={pushPlaybookAfterSoundsSave}
                onRegisterToggleHandler={registerSoundToggle}
                settingsOpen={isEditMode}
                showSettingsToggle={false}
              />
            </div>
          ) : null}
          {playerControls ? (
            <div className="playlist-sidebar__player">{playerControls}</div>
          ) : null}
          <PlaylistSidebarFooter
            isEditMode={isEditMode}
            uiMessage={uiMessage}
            crossfadeEnabled={crossfadeEnabled}
            preloadRunning={playback.preloadRunning}
            preloadDone={playback.preloadDone}
            playlistLength={playlist.length}
            onPreparePlaylist={handlePreparePlaylist}
            onCancelPrepare={playback.cancelPrepare}
          />
        </aside>
      ) : null}
      {!showSidebar ? playerControls : null}
    </>
  );
};
