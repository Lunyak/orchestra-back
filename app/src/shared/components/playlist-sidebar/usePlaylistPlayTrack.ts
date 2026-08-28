import { useCallback, useEffect, type MutableRefObject, type RefObject } from "react";
import {
  registerPlaylistPauseHandler,
  registerPlaylistToggleHandler,
  updatePlaylistVisualPlayback,
  type PlaylistPlayOptions,
} from "../../../features/playbook/model/playbook-playback-bridge";
import type { FadeTimerId } from "../../media/audio-fade";
import {
  buildPlaylistCacheKey,
  fetchAndCachePlaylistTrack,
  getCachedObjectUrl,
  isWebMediaCacheEnabled,
} from "../../media/web-media-cache";
import type { PlaylistTrack } from "../../types/playlist";
import { tagPlaylistAudioPlayRequest } from "./playlist-audio-utils";
import { clearPlaylistCarryover } from "./playlist-carryover";
import {
  clampUnit,
  findPlaylistTrack,
  oppositeAudioKey,
  pickAudioByKey,
  type PlaylistAudioKey,
} from "./playlist-playback-helpers";

type AudioFadeController = {
  clear: (timerId: FadeTimerId) => void;
  run: (
    audio: HTMLAudioElement,
    timerId: FadeTimerId,
    from: number,
    to: number,
    durationMs: number,
    onDone?: () => void,
  ) => void;
};

type UsePlaylistPlayTrackArgs = {
  projectName: string;
  accessToken: string | null;
  playlist: PlaylistTrack[];
  crossfadeEnabled: boolean;
  currentTrack: PlaylistTrack | null;
  activeAudioKey: PlaylistAudioKey;
  isPlaying: boolean;
  audioRefA: RefObject<HTMLAudioElement | null>;
  audioRefB: RefObject<HTMLAudioElement | null>;
  playRequestId: MutableRefObject<number>;
  currentTrackRef: MutableRefObject<PlaylistTrack | null>;
  volumeRef: MutableRefObject<number>;
  audioFade: AudioFadeController;
  resolveTrackPlaybackSrc: (track: PlaylistTrack) => Promise<string>;
  setVolume: (value: number) => void;
  setCurrentTrack: (track: PlaylistTrack | null) => void;
  setActiveAudioKey: (key: PlaylistAudioKey) => void;
  setIsPlaying: (value: boolean) => void;
  onRegisterPlayHandler?: (handler: (trackId: number, options?: PlaylistPlayOptions) => void) => void;
};

export function usePlaylistPlayTrack({
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
}: UsePlaylistPlayTrackArgs) {
  const clearFadeTimer = useCallback(
    (key: PlaylistAudioKey) => {
      audioFade.clear(key);
    },
    [audioFade],
  );

  useEffect(() => {
    const audioA = audioRefA.current;
    const audioB = audioRefB.current;
    if (!audioA || !audioB) return;

    const handlePlay = (audio: HTMLAudioElement, other: HTMLAudioElement, key: PlaylistAudioKey) => {
      const reqRaw = audio.dataset.playRequestId ?? "";
      const req = Number(reqRaw);
      const current = playRequestId.current;
      const expectedSrc = audio.dataset.playExpectedSrc ?? "";

      const isCurrent =
        Number.isFinite(req) && req === current && (!expectedSrc || audio.src === expectedSrc);
      if (isCurrent) {
        if (!crossfadeEnabled && !other.paused) {
          other.pause();
        }
        return;
      }

      try {
        audio.volume = 0;
      } catch {
        // ignore
      }
      audio.pause();
      clearFadeTimer(key);
    };

    const onPlayA = () => handlePlay(audioA, audioB, "a");
    const onPlayB = () => handlePlay(audioB, audioA, "b");
    audioA.addEventListener("play", onPlayA);
    audioB.addEventListener("play", onPlayB);
    return () => {
      audioA.removeEventListener("play", onPlayA);
      audioB.removeEventListener("play", onPlayB);
    };
  }, [audioRefA, audioRefB, clearFadeTimer, crossfadeEnabled, playRequestId]);

  const runFade = useCallback(
    (
      audio: HTMLAudioElement,
      key: PlaylistAudioKey,
      from: number,
      to: number,
      fadeDuration: number,
      onDone?: () => void,
    ) => {
      if (!audio) return;
      audioFade.run(audio, key, from, to, fadeDuration, onDone);
    },
    [audioFade],
  );

  const playTrack = useCallback(
    async (
      track: PlaylistTrack,
      playbackVolume?: number,
      playOptions?: { continueIfPlaying?: boolean; fadeMs?: number },
    ) => {
      const fadeTarget =
        playbackVolume != null && Number.isFinite(playbackVolume)
          ? clampUnit(playbackVolume)
          : volumeRef.current;
      const activeAudio = pickAudioByKey(activeAudioKey, audioRefA.current, audioRefB.current);
      const inactiveAudio = pickAudioByKey(
        oppositeAudioKey(activeAudioKey),
        audioRefA.current,
        audioRefB.current,
      );
      const inactiveKey = oppositeAudioKey(activeAudioKey);
      if (!activeAudio || !inactiveAudio) return;
      clearPlaylistCarryover();
      playRequestId.current += 1;
      const requestId = playRequestId.current;
      const isSameTrack = currentTrack?.id === track.id;
      const isAudioPlaying = !activeAudio.paused;
      const continueIfPlaying = playOptions?.continueIfPlaying === true;
      const cueFadeMs =
        playOptions?.fadeMs != null && Number.isFinite(playOptions.fadeMs) && playOptions.fadeMs > 0
          ? playOptions.fadeMs
          : undefined;
      const fadeInMs = cueFadeMs ?? track.fadeMs ?? 500;
      const fadeOutMs =
        !isSameTrack && currentTrack
          ? cueFadeMs ?? currentTrack.fadeMs ?? 500
          : fadeInMs;

      if (!isSameTrack) {
        setCurrentTrack(track);
      }

      if (isSameTrack && isAudioPlaying) {
        if (continueIfPlaying) {
          if (playbackVolume != null && Number.isFinite(playbackVolume)) {
            const from = activeAudio.volume;
            runFade(activeAudio, activeAudioKey, from, fadeTarget, fadeInMs);
          }
          return;
        }
        const from = activeAudio.volume;
        runFade(activeAudio, activeAudioKey, from, 0, fadeOutMs, () => {
          activeAudio.pause();
          setIsPlaying(false);
        });
        return;
      }

      if (isSameTrack && activeAudio.paused) {
        clearFadeTimer(activeAudioKey);
        const src = await resolveTrackPlaybackSrc(track);
        if (activeAudio.src !== src) {
          activeAudio.src = src;
        }
        activeAudio.muted = false;
        tagPlaylistAudioPlayRequest(activeAudio, requestId, activeAudio.src);
        try {
          await activeAudio.play();
          if (requestId !== playRequestId.current) {
            activeAudio.pause();
            return;
          }
          runFade(activeAudio, activeAudioKey, activeAudio.volume, fadeTarget, fadeInMs);
          setIsPlaying(true);
        } catch (error) {
          if (requestId !== playRequestId.current) return;
          console.error("Ошибка воспроизведения:", error);
        }
        return;
      }

      if (isAudioPlaying) {
        const from = activeAudio.volume;
        if (crossfadeEnabled) {
          runFade(activeAudio, activeAudioKey, from, 0, fadeOutMs, () => {
            activeAudio.pause();
          });
        } else {
          await new Promise<void>((resolve) => {
            runFade(activeAudio, activeAudioKey, from, 0, fadeOutMs, () => {
              activeAudio.pause();
              resolve();
            });
          });
          if (requestId !== playRequestId.current) return;
          setIsPlaying(false);
        }
      } else {
        clearFadeTimer(activeAudioKey);
      }

      const src = await resolveTrackPlaybackSrc(track);
      if (inactiveAudio.src !== src) {
        inactiveAudio.src = src;
      }
      inactiveAudio.muted = false;
      inactiveAudio.currentTime = 0;
      inactiveAudio.loop = track.loop ?? false;
      inactiveAudio.volume = 0;
      tagPlaylistAudioPlayRequest(inactiveAudio, requestId, inactiveAudio.src);
      try {
        await inactiveAudio.play();
        if (requestId !== playRequestId.current) {
          inactiveAudio.pause();
          return;
        }
        setActiveAudioKey(inactiveKey);
        runFade(inactiveAudio, inactiveKey, 0, fadeTarget, fadeInMs);
        setIsPlaying(true);
      } catch (error) {
        if (requestId !== playRequestId.current) return;
        if (
          isWebMediaCacheEnabled() &&
          accessToken &&
          typeof navigator !== "undefined" &&
          navigator.onLine
        ) {
          try {
            await fetchAndCachePlaylistTrack(projectName, track, accessToken);
            const retrySrc = await getCachedObjectUrl(buildPlaylistCacheKey(projectName, track));
            if (retrySrc) {
              inactiveAudio.src = retrySrc;
              await inactiveAudio.play();
              if (requestId !== playRequestId.current) {
                inactiveAudio.pause();
                return;
              }
              setActiveAudioKey(inactiveKey);
              runFade(inactiveAudio, inactiveKey, 0, fadeTarget, fadeInMs);
              setIsPlaying(true);
              return;
            }
          } catch {
            /* fall through */
          }
        }
        console.error("Ошибка воспроизведения:", error);
      }
    },
    [
      accessToken,
      activeAudioKey,
      audioRefA,
      audioRefB,
      clearFadeTimer,
      crossfadeEnabled,
      currentTrack,
      playRequestId,
      projectName,
      resolveTrackPlaybackSrc,
      runFade,
      setActiveAudioKey,
      setCurrentTrack,
      setIsPlaying,
      volumeRef,
    ],
  );

  const playById = useCallback(
    (trackId: number, options?: PlaylistPlayOptions) => {
      let playbackVolume: number | undefined;
      if (options?.volume != null && Number.isFinite(options.volume)) {
        const nextVolume = clampUnit(options.volume);
        setVolume(nextVolume);
        volumeRef.current = nextVolume;
        playbackVolume = nextVolume;
      }
      const target = findPlaylistTrack(playlist, trackId);
      const continueIfPlaying = options?.continueIfPlaying !== false;
      if (target) {
        void playTrack(target, playbackVolume, {
          continueIfPlaying,
          fadeMs: options?.fadeMs,
        });
        return;
      }
      console.warn("[playlist] track not found", {
        trackId,
        playlistIds: playlist.map((track) => track.id),
        playlistTitles: playlist.map((track) => track.title),
      });
    },
    [playlist, playTrack, setVolume, volumeRef],
  );

  useEffect(() => {
    if (!onRegisterPlayHandler) return;
    onRegisterPlayHandler(playById);
  }, [onRegisterPlayHandler, playById]);

  const pausePlayback = useCallback(() => {
    clearFadeTimer("a");
    clearFadeTimer("b");
    const audioA = audioRefA.current;
    const audioB = audioRefB.current;
    try {
      audioA?.pause();
      audioB?.pause();
      if (audioA) audioA.volume = 0;
      if (audioB) audioB.volume = 0;
    } catch {
      // ignore
    }
    setIsPlaying(false);
    updatePlaylistVisualPlayback(currentTrack?.id ?? null, false);
  }, [audioRefA, audioRefB, clearFadeTimer, currentTrack, setIsPlaying]);

  useEffect(() => {
    registerPlaylistPauseHandler(pausePlayback);
    return () => registerPlaylistPauseHandler(undefined);
  }, [pausePlayback]);

  const togglePlayback = useCallback(() => {
    if (!currentTrackRef.current) return;
    if (isPlaying) {
      pausePlayback();
      return;
    }
    void playTrack(currentTrackRef.current);
  }, [currentTrackRef, isPlaying, pausePlayback, playTrack]);

  useEffect(() => {
    registerPlaylistToggleHandler(togglePlayback);
    return () => registerPlaylistToggleHandler(undefined);
  }, [togglePlayback]);

  const stopAudioForTrack = useCallback(
    (trackId: number) => {
      if (currentTrackRef.current?.id !== trackId) return;
      const audioA = audioRefA.current;
      const audioB = audioRefB.current;
      if (audioA) {
        audioA.pause();
        audioA.removeAttribute("src");
        audioA.load();
      }
      if (audioB) {
        audioB.pause();
        audioB.removeAttribute("src");
        audioB.load();
      }
      setCurrentTrack(null);
    },
    [audioRefA, audioRefB, currentTrackRef, setCurrentTrack],
  );

  return {
    playTrack,
    togglePlayback,
    pausePlayback,
    stopAudioForTrack,
  };
}
