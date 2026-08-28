import { useCallback, useEffect, type MutableRefObject, type RefObject } from "react";
import type { PlaylistTrack } from "../../types/playlist";
import { tagPlaylistAudioPlayRequest } from "./playlist-audio-utils";
import {
  clearPlaylistCarryover,
  disposePlaylistCarryover,
  readPlaylistCarryover,
  registerPlaylistCarryover,
  writePlaylistCarryover,
} from "./playlist-carryover";
import type { PlaylistAudioKey } from "./playlist-playback-helpers";

type UsePlaylistCarryoverArgs = {
  projectName: string;
  sceneName: string;
  playlist: PlaylistTrack[];
  audioRefA: RefObject<HTMLAudioElement | null>;
  audioRefB: RefObject<HTMLAudioElement | null>;
  playRequestId: MutableRefObject<number>;
  currentTrackRef: MutableRefObject<PlaylistTrack | null>;
  activeAudioKeyRef: MutableRefObject<PlaylistAudioKey>;
  progressRef: MutableRefObject<number>;
  durationRef: MutableRefObject<number>;
  volumeRef: MutableRefObject<number>;
  projectNameRef: MutableRefObject<string>;
  sceneNameRef: MutableRefObject<string>;
  setActiveAudioKey: (key: PlaylistAudioKey) => void;
  setCurrentTrack: (track: PlaylistTrack | null) => void;
  setVolume: (value: number) => void;
  setProgress: (value: number) => void;
  setDuration: (value: number) => void;
  setIsPlaying: (value: boolean) => void;
};

export function usePlaylistCarryover({
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
}: UsePlaylistCarryoverArgs) {
  const restoreCarryover = useCallback(
    async (track: PlaylistTrack) => {
      const carryover = readPlaylistCarryover();
      const targetAudio = audioRefA.current;
      if (!carryover || !targetAudio) return;
      if (carryover.projectName !== projectName || carryover.sceneName !== sceneName) {
        return;
      }
      if (Number(carryover.track.id) !== Number(track.id)) return;

      playRequestId.current += 1;
      const requestId = playRequestId.current;
      const sourceAudio = carryover.audio;
      const sourceTime = sourceAudio.currentTime || carryover.progress || 0;
      const sourceDuration = Number.isFinite(sourceAudio.duration)
        ? sourceAudio.duration
        : carryover.duration;
      const sourceVolume = Number.isFinite(sourceAudio.volume)
        ? sourceAudio.volume
        : carryover.volume;
      const sourceWasPlaying = !sourceAudio.paused && !sourceAudio.ended;

      setActiveAudioKey("a");
      setCurrentTrack(track);
      setVolume(sourceVolume);
      setProgress(sourceTime);
      setDuration(Number.isFinite(sourceDuration) ? sourceDuration : 0);
      setIsPlaying(sourceWasPlaying);

      targetAudio.src = sourceAudio.src;
      targetAudio.currentTime = sourceTime;
      targetAudio.volume = sourceVolume;
      targetAudio.loop = sourceAudio.loop;
      targetAudio.muted = false;
      tagPlaylistAudioPlayRequest(targetAudio, requestId, targetAudio.src);

      writePlaylistCarryover(null);

      if (!sourceWasPlaying) {
        disposePlaylistCarryover(sourceAudio);
        return;
      }

      try {
        await targetAudio.play();
        if (requestId !== playRequestId.current) {
          targetAudio.pause();
          disposePlaylistCarryover(sourceAudio);
          return;
        }
        disposePlaylistCarryover(sourceAudio);
      } catch (error) {
        console.error("Ошибка восстановления воспроизведения:", error);
        writePlaylistCarryover(carryover);
        registerPlaylistCarryover(sourceAudio);
      }
    },
    [
      audioRefA,
      playRequestId,
      projectName,
      sceneName,
      setActiveAudioKey,
      setCurrentTrack,
      setDuration,
      setIsPlaying,
      setProgress,
      setVolume,
    ],
  );

  useEffect(() => {
    const carryover = readPlaylistCarryover();
    if (!carryover) return;
    if (carryover.projectName !== projectName || carryover.sceneName !== sceneName) {
      clearPlaylistCarryover();
      return;
    }
    const track = playlist.find(
      (item) => Number(item.id) === Number(carryover.track.id),
    );
    if (!track) {
      clearPlaylistCarryover();
      return;
    }
    void restoreCarryover(track);
  }, [playlist, projectName, sceneName, restoreCarryover]);

  useEffect(() => {
    return () => {
      const track = currentTrackRef.current;
      const activeAudio =
        activeAudioKeyRef.current === "a" ? audioRefA.current : audioRefB.current;
      if (!track || !activeAudio || activeAudio.paused || !activeAudio.src) return;

      clearPlaylistCarryover();

      const carryoverAudio = new Audio(activeAudio.src);
      const progressValue = activeAudio.currentTime || progressRef.current || 0;
      const durationValue = Number.isFinite(activeAudio.duration)
        ? activeAudio.duration
        : durationRef.current;
      const volumeValue = Number.isFinite(activeAudio.volume)
        ? activeAudio.volume
        : volumeRef.current;

      carryoverAudio.currentTime = progressValue;
      carryoverAudio.volume = volumeValue;
      carryoverAudio.loop = activeAudio.loop;
      carryoverAudio.muted = false;

      writePlaylistCarryover({
        audio: carryoverAudio,
        track,
        projectName: projectNameRef.current,
        sceneName: sceneNameRef.current,
        progress: progressValue,
        duration: durationValue,
        volume: volumeValue,
      });
      registerPlaylistCarryover(carryoverAudio);

      carryoverAudio.play().catch((error) => {
        console.error("Ошибка продолжения воспроизведения:", error);
        clearPlaylistCarryover();
      });
    };
  }, [
    activeAudioKeyRef,
    audioRefA,
    audioRefB,
    currentTrackRef,
    durationRef,
    progressRef,
    projectNameRef,
    sceneNameRef,
    volumeRef,
  ]);
}
