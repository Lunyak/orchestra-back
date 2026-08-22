import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  invokePlaylistPlay,
  getPlaylistActiveTrackId,
  registerPlaylistNextHandler,
  registerPlaylistPauseHandler,
  registerPlaylistPrevHandler,
  registerPlaylistSeekHandler,
  registerPlaylistSnapshotProvider,
  registerPlaylistToggleHandler,
  subscribePlaylistActiveTrack,
  updatePlaylistProgress,
  updatePlaylistVisualPlayback,
  type PlaylistPlayOptions,
} from "../../../features/playbook/model/playbook-playback-bridge";
import { createAudioFadeController } from "../../media/audio-fade";
import {
  buildPlaylistCacheKey,
  fetchAndCachePlaylistTrack,
  getCachedObjectUrl,
  isWebMediaCacheEnabled,
  isWebMediaCached,
  resolveWebPlaylistPlaybackUrl,
} from "../../media/web-media-cache";
import type { PlaylistTrack } from "../../types/playlist";
import { tagPlaylistAudioPlayRequest } from "./playlist-audio-utils";
import {
  clearPlaylistCarryover,
  disposePlaylistCarryover,
  readPlaylistCarryover,
  registerPlaylistCarryover,
  writePlaylistCarryover,
} from "./playlist-carryover";
import { resolvePlaylistTrackPlaybackSrc } from "./resolve-playlist-track-src";

type UsePlaylistPlaybackArgs = {
  projectName: string;
  sceneName: string;
  playlist: PlaylistTrack[];
  accessToken: string | null;
  crossfadeEnabled: boolean;
  volume: number;
  setVolume: (value: number) => void;
  onRegisterPlayHandler?: (handler: (trackId: number, options?: PlaylistPlayOptions) => void) => void;
  showPlayer: boolean;
};

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
  const [activeAudioKey, setActiveAudioKey] = useState<"a" | "b">("a");
  const audioFade = useMemo(() => createAudioFadeController(), []);
  const playRequestId = useRef(0);
  const currentTrackRef = useRef<PlaylistTrack | null>(currentTrack);
  const activeAudioKeyRef = useRef<"a" | "b">(activeAudioKey);
  const volumeRef = useRef(volume);
  const progressRef = useRef(progress);
  const durationRef = useRef(duration);
  const projectNameRef = useRef(projectName);
  const sceneNameRef = useRef(sceneName);

  const [preloadRunning, setPreloadRunning] = useState(false);
  const [preloadDone, setPreloadDone] = useState(0);
  const [preloadStatusById, setPreloadStatusById] = useState<
    Record<number, "idle" | "loading" | "ready" | "error">
  >({});
  const preloadRunIdRef = useRef(0);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
  const volumePercent = Math.min(100, Math.max(0, volume * 100));

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
    const stillExists = playlist.some(
      (track) => Number(track.id) === Number(currentTrack.id),
    );
    if (stillExists) return;

    const audioA = audioRefA.current;
    const audioB = audioRefB.current;
    audioA?.pause();
    audioB?.pause();
    setCurrentTrack(playlist[0] ?? null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
  }, [currentTrack, playlist]);

  useEffect(() => {
    const audio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
    if (audio && !isPlaying) {
      audio.volume = volume;
    }
  }, [activeAudioKey, isPlaying, volume]);

  useEffect(() => {
    const audio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
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
  }, [activeAudioKey]);

  useEffect(() => {
    const audio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
    if (audio) {
      audio.loop = currentTrack?.loop ?? false;
    }
  }, [activeAudioKey, currentTrack]);

  const resolveTrackPlaybackSrc = useCallback(
    (track: PlaylistTrack) => resolvePlaylistTrackPlaybackSrc(projectName, track, accessToken),
    [accessToken, projectName],
  );

  useEffect(() => {
    if (!isWebMediaCacheEnabled() || playlist.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<number, "idle" | "loading" | "ready" | "error"> = {};
      for (const track of playlist) {
        const key = buildPlaylistCacheKey(projectName, track);
        next[track.id] = (await isWebMediaCached(key)) ? "ready" : "idle";
      }
      if (cancelled) return;
      setPreloadStatusById((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [playlist, projectName]);

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
    [projectName, sceneName, setVolume],
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
  }, []);

  const clearFadeTimer = useCallback(
    (key: "a" | "b") => {
      audioFade.clear(key);
    },
    [audioFade],
  );

  const preloadOne = useCallback(
    async (track: PlaylistTrack, runId: number) => {
      if (isWebMediaCacheEnabled()) {
        await fetchAndCachePlaylistTrack(projectName, track, accessToken);
        if (runId !== preloadRunIdRef.current) {
          throw new Error("cancelled");
        }
        const src = await resolveWebPlaylistPlaybackUrl(projectName, track, accessToken);
        if (!src) throw new Error("cache miss");
        const audio = preloadAudioRef.current ?? new Audio();
        preloadAudioRef.current = audio;
        audio.preload = "auto";
        audio.muted = true;
        audio.volume = 0;
        if (audio.src !== src) audio.src = src;
        audio.load();
        await new Promise<"ready">((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error("preload timeout"));
          }, 20000);
          const onReady = () => {
            cleanup();
            resolve("ready");
          };
          const onErr = () => {
            cleanup();
            reject(new Error("preload error"));
          };
          const cleanup = () => {
            window.clearTimeout(timeout);
            audio.removeEventListener("canplay", onReady);
            audio.removeEventListener("loadeddata", onReady);
            audio.removeEventListener("error", onErr);
          };
          audio.addEventListener("canplay", onReady);
          audio.addEventListener("loadeddata", onReady);
          audio.addEventListener("error", onErr);
        });
        if (runId !== preloadRunIdRef.current) throw new Error("cancelled");
        return;
      }

      const src = await resolveTrackPlaybackSrc(track);
      const audio = preloadAudioRef.current ?? new Audio();
      preloadAudioRef.current = audio;
      audio.preload = "auto";
      audio.muted = true;
      audio.volume = 0;
      if (audio.src !== src) audio.src = src;
      audio.load();

      await new Promise<"ready">((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error("preload timeout"));
        }, 20000);
        const onReady = () => {
          cleanup();
          resolve("ready");
        };
        const onErr = () => {
          cleanup();
          reject(new Error("preload error"));
        };
        const cleanup = () => {
          window.clearTimeout(timeout);
          audio.removeEventListener("canplay", onReady);
          audio.removeEventListener("loadeddata", onReady);
          audio.removeEventListener("loadedmetadata", onReady);
          audio.removeEventListener("error", onErr);
        };
        audio.addEventListener("canplay", onReady);
        audio.addEventListener("loadeddata", onReady);
        audio.addEventListener("loadedmetadata", onReady);
        audio.addEventListener("error", onErr);
      });

      if (runId !== preloadRunIdRef.current) throw new Error("cancelled");
    },
    [accessToken, projectName, resolveTrackPlaybackSrc],
  );

  const preparePlaylist = useCallback(async () => {
    if (playlist.length === 0) return;
    preloadRunIdRef.current += 1;
    const runId = preloadRunIdRef.current;
    setPreloadRunning(true);
    setPreloadDone(0);
    setPreloadStatusById(() => {
      const next: Record<number, "idle" | "loading" | "ready" | "error"> = {};
      playlist.forEach((t) => (next[t.id] = "idle"));
      return next;
    });

    for (let i = 0; i < playlist.length; i += 1) {
      const t = playlist[i];
      if (runId !== preloadRunIdRef.current) break;
      setPreloadStatusById((prev) => ({ ...prev, [t.id]: "loading" }));
      try {
        await preloadOne(t, runId);
        if (runId !== preloadRunIdRef.current) break;
        setPreloadStatusById((prev) => ({ ...prev, [t.id]: "ready" }));
      } catch {
        if (runId !== preloadRunIdRef.current) break;
        setPreloadStatusById((prev) => ({ ...prev, [t.id]: "error" }));
      }
      setPreloadDone((d) => d + 1);
      await new Promise((r) => window.setTimeout(r, 0));
    }

    if (runId === preloadRunIdRef.current) {
      setPreloadRunning(false);
    }
  }, [playlist, preloadOne]);

  const cancelPrepare = useCallback(() => {
    preloadRunIdRef.current += 1;
    setPreloadRunning(false);
  }, []);

  useEffect(() => {
    const audioA = audioRefA.current;
    const audioB = audioRefB.current;
    if (!audioA || !audioB) return;

    const handlePlay = (audio: HTMLAudioElement, other: HTMLAudioElement, key: "a" | "b") => {
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
  }, [clearFadeTimer, crossfadeEnabled]);

  const runFade = useCallback(
    (
      audio: HTMLAudioElement,
      key: "a" | "b",
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
      playOptions?: { continueIfPlaying?: boolean },
    ) => {
      const fadeTarget =
        playbackVolume != null && Number.isFinite(playbackVolume)
          ? Math.min(1, Math.max(0, playbackVolume))
          : volumeRef.current;
      const activeAudio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
      const inactiveAudio = activeAudioKey === "a" ? audioRefB.current : audioRefA.current;
      const inactiveKey = activeAudioKey === "a" ? "b" : "a";
      if (!activeAudio || !inactiveAudio) return;
      clearPlaylistCarryover();
      playRequestId.current += 1;
      const requestId = playRequestId.current;
      const isSameTrack = currentTrack?.id === track.id;
      const isAudioPlaying = !activeAudio.paused;
      const continueIfPlaying = playOptions?.continueIfPlaying === true;
      const fadeInMs = track.fadeMs ?? 500;
      const fadeOutMs =
        !isSameTrack && currentTrack ? (currentTrack.fadeMs ?? 500) : fadeInMs;

      if (!crossfadeEnabled && !isSameTrack) {
        clearFadeTimer("a");
        clearFadeTimer("b");
        try {
          activeAudio.pause();
          inactiveAudio.pause();
          activeAudio.volume = 0;
          inactiveAudio.volume = 0;
        } catch {
          // ignore
        }
        setIsPlaying(false);
      }

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
      clearFadeTimer,
      crossfadeEnabled,
      currentTrack,
      projectName,
      resolveTrackPlaybackSrc,
      runFade,
    ],
  );

  const playById = useCallback(
    (trackId: number, options?: PlaylistPlayOptions) => {
      let playbackVolume: number | undefined;
      if (options?.volume != null && Number.isFinite(options.volume)) {
        const nextVolume = Math.min(1, Math.max(0, options.volume));
        setVolume(nextVolume);
        volumeRef.current = nextVolume;
        playbackVolume = nextVolume;
      }
      const target = playlist.find((track) => Number(track.id) === Number(trackId));
      const continueIfPlaying = options?.continueIfPlaying !== false;
      if (target) {
        void playTrack(target, playbackVolume, { continueIfPlaying });
        return;
      }
      const byIndex = playlist[Number(trackId) - 1];
      if (byIndex) {
        void playTrack(byIndex, playbackVolume, { continueIfPlaying });
        return;
      }
      console.warn("[playlist] track not found", {
        trackId,
        playlistIds: playlist.map((track) => track.id),
        playlistTitles: playlist.map((track) => track.title),
      });
    },
    [playlist, playTrack, setVolume],
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
  }, [clearFadeTimer, currentTrack]);

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
  }, [isPlaying, pausePlayback, playTrack]);

  useEffect(() => {
    registerPlaylistToggleHandler(togglePlayback);
    return () => registerPlaylistToggleHandler(undefined);
  }, [togglePlayback]);

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
    const audio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
    if (audio && !audio.paused) {
      audio.volume = nextValue;
    }
  };

  const seekPlayer = (nextValue: number) => {
    const audio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
    if (!audio || !Number.isFinite(nextValue)) return;
    audio.currentTime = nextValue;
    setProgress(nextValue);
    updatePlaylistProgress(nextValue, durationRef.current);
  };

  const seekPlayerRef = useRef(seekPlayer);
  seekPlayerRef.current = seekPlayer;

  useEffect(() => {
    registerPlaylistSeekHandler((value) => seekPlayerRef.current(value));
    return () => registerPlaylistSeekHandler(undefined);
  }, []);

  const sharedActiveTrackId = useSyncExternalStore(
    subscribePlaylistActiveTrack,
    getPlaylistActiveTrackId,
    getPlaylistActiveTrackId,
  );

  const highlightedTrack = useMemo(() => {
    if (sharedActiveTrackId != null) {
      const fromShared = playlist.find(
        (track) => Number(track.id) === Number(sharedActiveTrackId),
      );
      if (fromShared) return fromShared;
    }
    return currentTrack;
  }, [sharedActiveTrackId, playlist, currentTrack]);

  useEffect(() => {
    updatePlaylistVisualPlayback(currentTrack?.id ?? null, isPlaying);
  }, [currentTrack, isPlaying]);

  const currentTrackIndex = highlightedTrack
    ? playlist.findIndex((track) => Number(track.id) === Number(highlightedTrack.id))
    : -1;
  const canGoPrevTrack = currentTrackIndex > 0;
  const canGoNextTrack =
    currentTrackIndex >= 0 && currentTrackIndex < playlist.length - 1;

  const playTrackAt = (index: number) => {
    const track = playlist[index];
    if (!track) return;
    if (showPlayer) {
      void playTrack(track);
      return;
    }
    invokePlaylistPlay(track.id);
  };

  const playPreviousTrack = () => {
    if (!canGoPrevTrack) return;
    playTrackAt(currentTrackIndex - 1);
  };

  const playNextTrack = () => {
    if (!canGoNextTrack) return;
    playTrackAt(currentTrackIndex + 1);
  };

  const playPreviousTrackRef = useRef(playPreviousTrack);
  playPreviousTrackRef.current = playPreviousTrack;
  const playNextTrackRef = useRef(playNextTrack);
  playNextTrackRef.current = playNextTrack;

  useEffect(() => {
    registerPlaylistPrevHandler(() => playPreviousTrackRef.current());
    registerPlaylistNextHandler(() => playNextTrackRef.current());
    return () => {
      registerPlaylistPrevHandler(undefined);
      registerPlaylistNextHandler(undefined);
    };
  }, []);

  const stopAudioForTrack = useCallback((trackId: number) => {
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
  }, []);

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
