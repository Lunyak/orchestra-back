import { useEffect, type MutableRefObject, type RefObject } from "react";
import { updatePlaylistProgress } from "../../../features/playbook/model/playbook-playback-bridge";
import type { PlaylistTrack } from "../../types/playlist";
import {
  pickAudioByKey,
  type PlaylistAudioKey,
} from "./playlist-playback-helpers";

type UsePlaylistAudioListenersArgs = {
  activeAudioKey: PlaylistAudioKey;
  audioRefA: RefObject<HTMLAudioElement | null>;
  audioRefB: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  volume: number;
  currentTrack: PlaylistTrack | null;
  durationRef: MutableRefObject<number>;
  setProgress: (value: number) => void;
  setDuration: (value: number) => void;
  setIsPlaying: (value: boolean) => void;
};

export function usePlaylistAudioListeners({
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
}: UsePlaylistAudioListenersArgs) {
  useEffect(() => {
    const audio = pickAudioByKey(activeAudioKey, audioRefA.current, audioRefB.current);
    if (audio && !isPlaying) {
      audio.volume = volume;
    }
  }, [activeAudioKey, audioRefA, audioRefB, isPlaying, volume]);

  useEffect(() => {
    const audio = pickAudioByKey(activeAudioKey, audioRefA.current, audioRefB.current);
    if (!audio) return;
    const handleTimeUpdate = () => {
      const nextProgress = audio.currentTime || 0;
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setProgress(nextProgress);
      setDuration(nextDuration);
      updatePlaylistProgress(nextProgress, nextDuration);
    };
    const handleLoaded = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const nextProgress = audio.currentTime || 0;
      setDuration(nextDuration);
      setProgress(nextProgress);
      updatePlaylistProgress(nextProgress, nextDuration);
    };
    const handleEnded = () => {
      setProgress(0);
      setIsPlaying(false);
      updatePlaylistProgress(0, durationRef.current);
    };
    const handlePlay = () => {
      setIsPlaying(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("durationchange", handleLoaded);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("durationchange", handleLoaded);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [
    activeAudioKey,
    audioRefA,
    audioRefB,
    durationRef,
    setDuration,
    setIsPlaying,
    setProgress,
  ]);

  useEffect(() => {
    const audio = pickAudioByKey(activeAudioKey, audioRefA.current, audioRefB.current);
    if (audio) {
      audio.loop = currentTrack?.loop ?? false;
    }
  }, [activeAudioKey, audioRefA, audioRefB, currentTrack]);
}
