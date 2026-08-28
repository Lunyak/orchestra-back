import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  registerPlaylistSnapshotProvider,
  updatePlaylistVisualPlayback,
} from "../../../features/playbook/model/playbook-playback-bridge";
import { createAudioFadeController } from "../../media/audio-fade";
import type { PlaylistTrack } from "../../types/playlist";
import {
  pickAudioByKey,
  playlistContainsTrack,
  progressToPercent,
  type PlaylistAudioKey,
  volumeToPercent,
} from "./playlist-playback-helpers";
import type { UsePlaylistPlaybackArgs } from "./playlist-playback-types";
import { resolvePlaylistTrackPlaybackSrc } from "./resolve-playlist-track-src";
import { usePlaylistAudioListeners } from "./usePlaylistAudioListeners";
import { usePlaylistCarryover } from "./usePlaylistCarryover";
import { usePlaylistPlayTrack } from "./usePlaylistPlayTrack";
import { usePlaylistPreload } from "./usePlaylistPreload";
import { usePlaylistQueueNav } from "./usePlaylistQueueNav";

export function usePlaylistPlayback({
  projectName,
  sceneName,
  playlist,
  accessToken,
  crossfadeEnabled,
  volume,
  setVolume,
  onRegisterPlayHandler,
  showPlayer,
}: UsePlaylistPlaybackArgs) {
  const [currentTrack, setCurrentTrack] = useState<PlaylistTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRefA = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);
  const [activeAudioKey, setActiveAudioKey] = useState<PlaylistAudioKey>("a");
  const audioFade = useMemo(() => createAudioFadeController(), []);
  const playRequestId = useRef(0);
  const currentTrackRef = useRef<PlaylistTrack | null>(currentTrack);
  const activeAudioKeyRef = useRef<PlaylistAudioKey>(activeAudioKey);
  const volumeRef = useRef(volume);
  const progressRef = useRef(progress);
  const durationRef = useRef(duration);
  const projectNameRef = useRef(projectName);
  const sceneNameRef = useRef(sceneName);

  const progressPercent = progressToPercent(progress, duration);
  const volumePercent = volumeToPercent(volume);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    activeAudioKeyRef.current = activeAudioKey;
  }, [activeAudioKey]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    projectNameRef.current = projectName;
  }, [projectName]);

  useEffect(() => {
    sceneNameRef.current = sceneName;
  }, [sceneName]);

  useEffect(() => {
    if (currentTrack || playlist.length === 0) return;
    setCurrentTrack(playlist[0]);
  }, [currentTrack, playlist]);

  useEffect(() => {
    if (!currentTrack) return;
    if (playlistContainsTrack(playlist, currentTrack)) return;

    const audioA = audioRefA.current;
    const audioB = audioRefB.current;
    audioA?.pause();
    audioB?.pause();
    setCurrentTrack(playlist[0] ?? null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
  }, [currentTrack, playlist]);

  usePlaylistAudioListeners({
    activeAudioKey,
    audioRefA,
    audioRefB,
    isPlaying,
    volume,
    currentTrack,
    durationRef,
    setProgress,
    setDuration,
    setIsPlaying,
  });

  const resolveTrackPlaybackSrc = useCallback(
    (track: PlaylistTrack) => resolvePlaylistTrackPlaybackSrc(projectName, track, accessToken),
    [accessToken, projectName],
  );

  usePlaylistCarryover({
    projectName,
    sceneName,
    playlist,
    audioRefA,
    audioRefB,
    playRequestId,
    currentTrackRef,
    activeAudioKeyRef,
    progressRef,
    durationRef,
    volumeRef,
    projectNameRef,
    sceneNameRef,
    setActiveAudioKey,
    setCurrentTrack,
    setVolume,
    setProgress,
    setDuration,
    setIsPlaying,
  });

  const { preloadRunning, preloadDone, preloadStatusById, preparePlaylist, cancelPrepare } =
    usePlaylistPreload({
      projectName,
      playlist,
      accessToken,
      resolveTrackPlaybackSrc,
    });

  const { playTrack, togglePlayback, stopAudioForTrack } = usePlaylistPlayTrack({
    projectName,
    accessToken,
    playlist,
    crossfadeEnabled,
    currentTrack,
    activeAudioKey,
    isPlaying,
    audioRefA,
    audioRefB,
    playRequestId,
    currentTrackRef,
    volumeRef,
    audioFade,
    resolveTrackPlaybackSrc,
    setVolume,
    setCurrentTrack,
    setActiveAudioKey,
    setIsPlaying,
    onRegisterPlayHandler,
  });

  useEffect(() => {
    registerPlaylistSnapshotProvider(() => ({
      trackId: currentTrack?.id ?? null,
      trackTitle: currentTrack?.title,
      fadeMs: currentTrack?.fadeMs,
      volume: volumeRef.current,
      progress: progressRef.current,
      duration: durationRef.current,
    }));
    return () => registerPlaylistSnapshotProvider(undefined);
  }, [currentTrack]);

  const setPlayerVolume = (nextValue: number) => {
    setVolume(nextValue);
    const audio = pickAudioByKey(activeAudioKey, audioRefA.current, audioRefB.current);
    if (audio && !audio.paused) {
      audio.volume = nextValue;
    }
  };

  const {
    seekPlayer,
    highlightedTrack,
    canGoPrevTrack,
    canGoNextTrack,
    playPreviousTrack,
    playNextTrack,
  } = usePlaylistQueueNav({
    playlist,
    currentTrack,
    activeAudioKey,
    showPlayer,
    audioRefA,
    audioRefB,
    durationRef,
    setProgress,
    playTrack,
  });

  useEffect(() => {
    updatePlaylistVisualPlayback(currentTrack?.id ?? null, isPlaying);
  }, [currentTrack, isPlaying]);

  return {
    audioRefA,
    audioRefB,
    currentTrack,
    isPlaying,
    progress,
    duration,
    progressPercent,
    volumePercent,
    highlightedTrack,
    canGoPrevTrack,
    canGoNextTrack,
    preloadRunning,
    preloadDone,
    preloadStatusById,
    preparePlaylist,
    cancelPrepare,
    playTrack,
    togglePlayback,
    setPlayerVolume,
    seekPlayer,
    playPreviousTrack,
    playNextTrack,
    stopAudioForTrack,
  };
}
