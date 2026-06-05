import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  addScenePlaylistTracksFromPathsDesktop,
  deleteScenePlaylistTrackDesktop,
  persistScenePlaylistDesktop,
  pickScenePlaylistTracksDesktop,
  sceneActions,
  uploadScenePlaylistWeb,
} from "../../../features/scene/model/scene-slice";
import {
  invokePlaylistPlay,
  getPlaylistActiveTrackId,
  registerPlaylistSnapshotProvider,
  setPlaylistActiveTrackId,
  subscribePlaylistActiveTrack,
} from "../../../features/scene/model/scene-playback-bridge";
import { scriptUiActions } from "../../../features/script-ui/model/script-ui-slice";
import { getDesktopApi } from "../../platform/desktop-api";
import { createAudioFadeController } from "../../media/audio-fade";
import {
  buildPlaylistCacheKey,
  fetchAndCachePlaylistTrack,
  isWebMediaCacheEnabled,
  isWebMediaCached,
  resolveWebPlaylistPlaybackUrl,
} from "../../media/web-media-cache";
import { resolveOfflineMediaUrl } from "../../platform/media-url";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import type { PlaylistTrack } from "../../types/playlist";
import { Buttons } from "../buttons/Buttons";
import { ListItem } from "../list-item/ListItem";
import { usePlayerVolume } from "../../player/usePlayerVolume";
import { PlaylistBottomControls } from "./PlaylistBottomControls";
import "./style.css";

interface PlaylistSidebarProps {
  projectName: string;
  sceneName?: string;
  onRegisterPlayHandler?: (handler: (trackId: number) => void) => void;
  mode?: "full" | "player" | "list";
}

const EMPTY_PLAYLIST: PlaylistTrack[] = [];

type PlaylistCarryover = {
  audio: HTMLAudioElement;
  track: PlaylistTrack;
  projectName: string;
  sceneName: string;
  progress: number;
  duration: number;
  volume: number;
};

let playlistCarryover: PlaylistCarryover | null = null;

function getCarryoverRegistry() {
  const root = window as typeof window & {
    __orchestraPlaylistCarryovers?: Set<HTMLAudioElement>;
  };
  if (!root.__orchestraPlaylistCarryovers) {
    root.__orchestraPlaylistCarryovers = new Set<HTMLAudioElement>();
  }
  return root.__orchestraPlaylistCarryovers;
}

function stopCarryoverAudio(audio: HTMLAudioElement) {
  try {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  } catch {
    // Best-effort cleanup only.
  }
}

function clearPlaylistCarryover() {
  const registry = getCarryoverRegistry();
  if (playlistCarryover) {
    stopCarryoverAudio(playlistCarryover.audio);
    registry.delete(playlistCarryover.audio);
    playlistCarryover = null;
  }
  registry.forEach((audio) => {
    stopCarryoverAudio(audio);
    registry.delete(audio);
  });
}

function registerPlaylistCarryover(audio: HTMLAudioElement) {
  getCarryoverRegistry().add(audio);
}

function unregisterPlaylistCarryover(audio: HTMLAudioElement) {
  getCarryoverRegistry().delete(audio);
}

function disposePlaylistCarryover(audio: HTMLAudioElement) {
  unregisterPlaylistCarryover(audio);
  stopCarryoverAudio(audio);
}

export const PlaylistSidebar: React.FC<PlaylistSidebarProps> = ({
  projectName,
  sceneName = "script",
  onRegisterPlayHandler,
  mode = "full",
}) => {
  const dispatch = useAppDispatch();
  const playlist = useAppSelector(
    (s) => (s.scene.sceneData?.playlist as PlaylistTrack[] | undefined) ?? EMPTY_PLAYLIST,
  );
  const playlistUpload = useAppSelector((s) => s.scene.playlistUpload);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<PlaylistTrack | null>(null);
  const isEditMode = useAppSelector((s) => s.scriptUi.playlistEditMode);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const { volume, setVolume } = usePlayerVolume();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const crossfadeEnabled = useAppSelector((s) => s.scriptUi.playlistCrossfadeEnabled);
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const audioRefA = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);
  const [activeAudioKey, setActiveAudioKey] = useState<"a" | "b">("a");
  const audioFade = useMemo(() => createAudioFadeController(), []);
  const playRequestId = useRef(0);
  const messageTimerRef = useRef<number | null>(null);
  const currentTrackRef = useRef<PlaylistTrack | null>(currentTrack);
  const activeAudioKeyRef = useRef<"a" | "b">(activeAudioKey);
  const volumeRef = useRef(volume);
  const progressRef = useRef(progress);
  const durationRef = useRef(duration);
  const projectNameRef = useRef(projectName);
  const sceneNameRef = useRef(sceneName);

  const [preloadRunning, setPreloadRunning] = useState(false);
  const [preloadDone, setPreloadDone] = useState(0);
  const [preloadStatusById, setPreloadStatusById] = useState<Record<number, "idle" | "loading" | "ready" | "error">>({});
  const preloadRunIdRef = useRef(0);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<number | null>(null);

  const REORDER_MIME = "text/x-orchestra-playlist-reorder";

  const tagPlayRequest = (audio: HTMLAudioElement, requestId: number, expectedSrc: string) => {
    try {
      audio.dataset.playRequestId = String(requestId);
      audio.dataset.playExpectedSrc = expectedSrc;
    } catch {
      // ignore
    }
  };

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

  const showMessage = (message: string) => {
    setUiMessage(message);
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = window.setTimeout(() => {
      setUiMessage(null);
      messageTimerRef.current = null;
    }, 3500);
  };

  useEffect(() => {
    if (playlistUpload.error) {
      showMessage(playlistUpload.error);
    }
  }, [playlistUpload.error]);

  useEffect(() => {
    if (!isEditMode) {
      setEditingId(null);
      setEditingTitle("");
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode) {
      setDragOverTrackId(null);
      return;
    }
    const clear = () => setDragOverTrackId(null);
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, [isEditMode]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

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
    if (audio) {
      if (!isPlaying) {
        audio.volume = volume;
      }
    }
  }, [activeAudioKey, isPlaying, volume]);

  useEffect(() => {
    const audio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      setProgress(audio.currentTime || 0);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const handleLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setProgress(audio.currentTime || 0);
    };
    const handleEnded = () => {
      setProgress(0);
      setIsPlaying(false);
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
    async (track: PlaylistTrack) => {
      if (getDesktopApi() || track.filePath) {
        return resolveOfflineMediaUrl({
          projectSlug: projectName,
          kind: "playlist",
          fileName: track.file,
          filePath: track.filePath,
          remoteUrl: track.remoteUrl,
        });
      }
      if (isWebMediaCacheEnabled()) {
        return resolveWebPlaylistPlaybackUrl(projectName, track, accessToken);
      }
      const remote = String(track.remoteUrl ?? "").trim();
      if (remote) return remote;
      return track.file;
    },
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
      const carryover = playlistCarryover;
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
      tagPlayRequest(targetAudio, requestId, targetAudio.src);

      playlistCarryover = null;

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
        playlistCarryover = carryover;
        registerPlaylistCarryover(sourceAudio);
      }
    },
    [projectName, sceneName],
  );

  useEffect(() => {
    const carryover = playlistCarryover;
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

      playlistCarryover = {
        audio: carryoverAudio,
        track,
        projectName: projectNameRef.current,
        sceneName: sceneNameRef.current,
        progress: progressValue,
        duration: durationValue,
        volume: volumeValue,
      };
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

    // Sequential warm-up: avoids saturating bandwidth and keeps UI responsive.
    for (let i = 0; i < playlist.length; i += 1) {
      const t = playlist[i];
      if (runId !== preloadRunIdRef.current) break;
      setPreloadStatusById((prev) => ({ ...prev, [t.id]: "loading" }));
      try {
        await preloadOne(t, runId);
        if (runId !== preloadRunIdRef.current) break;
        setPreloadStatusById((prev) => ({ ...prev, [t.id]: "ready" }));
      } catch (e) {
        if (runId !== preloadRunIdRef.current) break;
        setPreloadStatusById((prev) => ({ ...prev, [t.id]: "error" }));
      }
      setPreloadDone((d) => d + 1);
      // Yield to keep the page interactive.
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

  // Guard against race conditions: if an old pending play resolves late,
  // immediately stop it so we never end up with two tracks playing.
  useEffect(() => {
    const audioA = audioRefA.current;
    const audioB = audioRefB.current;
    if (!audioA || !audioB) return;

    const handlePlay = (audio: HTMLAudioElement, other: HTMLAudioElement, key: "a" | "b") => {
      const reqRaw = audio.dataset.playRequestId ?? "";
      const req = Number(reqRaw);
      const current = playRequestId.current;
      const expectedSrc = audio.dataset.playExpectedSrc ?? "";

      // Only accept the latest request id AND the expected src.
      // This prevents an old play() promise from affecting a newer src swap.
      const isCurrent = Number.isFinite(req) && req === current && (!expectedSrc || audio.src === expectedSrc);
      if (isCurrent) {
        // Ensure only one audio plays when crossfade is disabled.
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
      duration: number,
      onDone?: () => void,
    ) => {
      if (!audio) return;
      audioFade.run(audio, key, from, to, duration, onDone);
    },
    [audioFade],
  );


  const playTrack = useCallback(async (track: PlaylistTrack) => {
    const activeAudio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
    const inactiveAudio = activeAudioKey === "a" ? audioRefB.current : audioRefA.current;
    const inactiveKey = activeAudioKey === "a" ? "b" : "a";
    if (!activeAudio || !inactiveAudio) return;
    clearPlaylistCarryover();
    playRequestId.current += 1;
    const requestId = playRequestId.current;
    const isSameTrack = currentTrack?.id === track.id;
    const isAudioPlaying = !activeAudio.paused;
    const fadeInMs = track.fadeMs ?? 500;
    const fadeOutMs =
      !isSameTrack && currentTrack ? (currentTrack.fadeMs ?? 500) : fadeInMs;

    // Cancel any pending play on the other element when crossfade is disabled.
    // This closes the "two tracks playing" race when switching tracks quickly.
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
      tagPlayRequest(activeAudio, requestId, activeAudio.src);
      try {
        await activeAudio.play();
        if (requestId !== playRequestId.current) {
          activeAudio.pause();
          return;
        }
        runFade(activeAudio, activeAudioKey, activeAudio.volume, volume, fadeInMs);
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
    tagPlayRequest(inactiveAudio, requestId, inactiveAudio.src);
    try {
      await inactiveAudio.play();
      if (requestId !== playRequestId.current) {
        // Stale request: stop immediately to avoid overlapping playback.
        inactiveAudio.pause();
        return;
      }
      setActiveAudioKey(inactiveKey);
      runFade(inactiveAudio, inactiveKey, 0, volume, fadeInMs);
      setIsPlaying(true);
    } catch (error) {
      if (requestId !== playRequestId.current) return;
      console.error("Ошибка воспроизведения:", error);
    }
  }, [
    activeAudioKey,
    clearFadeTimer,
    crossfadeEnabled,
    currentTrack,
    resolveTrackPlaybackSrc,
    runFade,
    volume,
  ]);

  const playById = useCallback(
    (trackId: number) => {
      const target = playlist.find(
        (track) => Number(track.id) === Number(trackId),
      );
      if (target) {
        playTrack(target);
        return;
      }
      const byIndex = playlist[Number(trackId) - 1];
      if (byIndex) {
        playTrack(byIndex);
      }
    },
    [playlist, playTrack],
  );

  useEffect(() => {
    if (!onRegisterPlayHandler) return;
    onRegisterPlayHandler(playById);
  }, [onRegisterPlayHandler, playById]);

  useEffect(() => {
    registerPlaylistSnapshotProvider(() => ({
      trackId: currentTrack?.id ?? null,
      trackTitle: currentTrack?.title,
      fadeMs: currentTrack?.fadeMs,
      volume: volumeRef.current,
    }));
    return () => registerPlaylistSnapshotProvider(undefined);
  }, [currentTrack]);

  const togglePlayback = () => {
    if (!currentTrack) return;
    void playTrack(currentTrack);
  };

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
  };

  const formatTime = (value: number) => {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const total = Math.floor(value);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const addTracks = async () => {
    if (playlistUpload.uploading) return;
    const desktopApi = getDesktopApi();
    try {
      if (desktopApi) {
        await dispatch(
          pickScenePlaylistTracksDesktop({ projectSlug: projectName, sceneName }),
        ).unwrap();
        return;
      }
      fileInputRef.current?.click();
    } catch (err) {
      console.error("Failed to add tracks:", err);
      showMessage("Не удалось добавить аудио. Проверьте консоль.");
    }
  };

  const addTracksFromPaths = async (filePaths: string[]) => {
    if (playlistUpload.uploading) return;
    const desktopApi = getDesktopApi();
    if (!desktopApi) {
      showMessage("Drag-and-drop с путями файлов доступен только в десктоп-версии приложения.");
      return;
    }
    try {
      await dispatch(
        addScenePlaylistTracksFromPathsDesktop({
          projectSlug: projectName,
          sceneName,
          filePaths,
        }),
      ).unwrap();
    } catch (err) {
      console.error("Failed to add audio:", err);
      showMessage("Не удалось добавить аудио. Проверьте консоль.");
    }
  };

  const startRename = (track: PlaylistTrack) => {
    setEditingId(track.id);
    setEditingTitle(track.title);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const applyRename = async (track: PlaylistTrack) => {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) return;
    dispatch(sceneActions.updatePlaylistTrack({ id: track.id, changes: { title: nextTitle } }));
    if (getDesktopApi()) {
      try {
        await dispatch(
          persistScenePlaylistDesktop({ projectSlug: projectName, sceneName }),
        ).unwrap();
      } catch (err) {
        console.error("Failed to save playlist:", err);
        showMessage("Не удалось сохранить плейлист. Проверьте консоль.");
      }
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const updateFade = async (track: PlaylistTrack, nextFade: number) => {
    dispatch(sceneActions.updatePlaylistTrack({ id: track.id, changes: { fadeMs: nextFade } }));
    if (getDesktopApi()) {
      try {
        await dispatch(
          persistScenePlaylistDesktop({ projectSlug: projectName, sceneName }),
        ).unwrap();
      } catch (err) {
        console.error("Failed to save playlist:", err);
        showMessage("Не удалось сохранить плейлист. Проверьте консоль.");
      }
    }
  };

  const updateLoop = async (track: PlaylistTrack, nextLoop: boolean) => {
    dispatch(sceneActions.updatePlaylistTrack({ id: track.id, changes: { loop: nextLoop } }));
    if (getDesktopApi()) {
      try {
        await dispatch(
          persistScenePlaylistDesktop({ projectSlug: projectName, sceneName }),
        ).unwrap();
      } catch (err) {
        console.error("Failed to save playlist:", err);
        showMessage("Не удалось сохранить плейлист. Проверьте консоль.");
      }
    }
  };

  const deleteTrack = async (track: PlaylistTrack) => {
    const desktopApi = getDesktopApi();
    try {
      if (desktopApi) {
        await dispatch(
          deleteScenePlaylistTrackDesktop({
            projectSlug: projectName,
            sceneName,
            id: track.id,
            file: track.file,
          }),
        ).unwrap();
      } else {
        dispatch(sceneActions.setPlaylist(playlist.filter((t) => Number(t.id) !== Number(track.id))));
      }
    } catch (err) {
      console.error("Failed to delete audio:", err);
      showMessage("Не удалось удалить аудио. Проверьте консоль.");
    }
    if (currentTrack?.id === track.id) {
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
    }
  };

  const persistPlaylistIfDesktop = async () => {
    if (!getDesktopApi()) return;
    try {
      await dispatch(persistScenePlaylistDesktop({ projectSlug: projectName, sceneName })).unwrap();
    } catch (err) {
      console.error("Failed to save playlist:", err);
      showMessage("Не удалось сохранить плейлист. Проверьте консоль.");
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;

    const desktopApi = getDesktopApi();
    if (!desktopApi) {
      void dispatch(uploadScenePlaylistWeb({ projectSlug: projectName, files }))
        .unwrap()
        .catch((err) => {
          console.error("Failed to upload playlist tracks (web):", err);
          showMessage("Не удалось загрузить аудио. Проверьте авторизацию/консоль.");
        });
      return;
    }
    const filePaths = files
      .map((file) => (file as { path?: string }).path)
      .filter((path): path is string => Boolean(path));
    if (filePaths.length === 0) {
      console.warn("No file paths provided by drag-and-drop.");
      return;
    }
    void addTracksFromPaths(filePaths);
  };

  const desktopAvailable = Boolean(getDesktopApi());
  const addButtonTitle = desktopAvailable
    ? "Добавить аудио"
    : "Добавить аудио (веб)";
  const showPlayer = mode !== "list";
  const showSidebar = mode !== "player";

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
    if (!showPlayer) return;
    setPlaylistActiveTrackId(currentTrack?.id ?? null);
  }, [currentTrack, showPlayer]);

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

  return (
    <>
      {showPlayer ? (
        <div className="playlist-audio-host" aria-hidden="true">
          <audio ref={audioRefA} />
          <audio ref={audioRefB} />
        </div>
      ) : null}
      {showSidebar ? (
        <aside
          className={`playlist-sidebar ${isDragOver ? "drag-over" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        style={{ display: "none" }}
        onChange={(event) => {
          const list = event.target.files ? Array.from(event.target.files) : [];
          event.target.value = "";
          if (list.length === 0) return;
          void dispatch(uploadScenePlaylistWeb({ projectSlug: projectName, files: list }))
            .unwrap()
            .catch((err) => {
              console.error("Failed to upload playlist tracks (web):", err);
              showMessage("Не удалось загрузить аудио. Проверьте авторизацию/консоль.");
            });
        }}
      />
      <div className="playlist-player">
        {(isEditMode || uiMessage) ? (
          <div className="playlist-controls compact">
          {isEditMode ? (
            <div className="playlist-controls-row">
              <button
                type="button"
                className="playlist-action-btn playlist-prepare-btn"
                onClick={() => void preparePlaylist()}
                disabled={preloadRunning || playlist.length === 0}
                title="Фоновая подготовка треков (буферизация), чтобы в спектакле запускалось без ожидания"
              >
                {preloadRunning ? "Готовлю…" : "Подготовить"}
                {playlist.length > 0 ? ` (${preloadDone}/${playlist.length})` : ""}
              </button>
              {preloadRunning ? (
                <button
                  type="button"
                  className="playlist-action-btn danger playlist-prepare-stop-btn"
                  onClick={cancelPrepare}
                  title="Остановить подготовку"
                >
                  Стоп
                </button>
              ) : null}
            </div>
          ) : null}
          {uiMessage && <div className="playlist-empty">{uiMessage}</div>}
          {isEditMode && (
            <label className="playlist-crossfade">
              <input
                type="checkbox"
                checked={crossfadeEnabled}
                onChange={(event) =>
                  dispatch(
                    scriptUiActions.setPlaylistCrossfadeEnabled({
                      value: event.target.checked,
                    }),
                  )
                }
              />
              <span className="playlist-crossfade__switch" aria-hidden="true" />
              <span className="playlist-crossfade__text">Кроссфейд</span>
            </label>
          )}
          </div>
        ) : null}

      </div>
      <div className="playlist-tracks">
        {playlist.length === 0 ? (
          <div className="playlist-empty">Треки не добавлены</div>
        ) : (
          playlist.map((track, index) => (
            <ListItem
              key={track.id}
              className={`playlist-track-row ${Number(highlightedTrack?.id) === Number(track.id) ? "active" : ""} ${isEditMode ? "edit-mode" : ""} ${dragOverTrackId === track.id ? "drag-over" : ""}`}
              draggable={isEditMode}
              onDragStart={(event) => {
                if (!isEditMode) return;
                if (!event.dataTransfer) return;
                setDragOverTrackId(null);
                try {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(REORDER_MIME, String(index));
                } catch {
                  // ignore
                }
              }}
              onDragOver={(event) => {
                if (!isEditMode) return;
                const types = Array.from(event.dataTransfer?.types ?? []);
                if (!types.includes(REORDER_MIME)) return;
                event.preventDefault();
                setDragOverTrackId(track.id);
              }}
              onDragLeave={() => {
                setDragOverTrackId((prev) => (prev === track.id ? null : prev));
              }}
              onDrop={(event) => {
                if (!isEditMode) return;
                const types = Array.from(event.dataTransfer?.types ?? []);
                if (!types.includes(REORDER_MIME)) return;
                event.preventDefault();
                event.stopPropagation();
                const raw = event.dataTransfer.getData(REORDER_MIME);
                const fromIndex = Number(raw);
                const toIndex = index;
                setDragOverTrackId(null);
                if (!Number.isFinite(fromIndex) || fromIndex < 0) return;
                if (fromIndex === toIndex) return;
                if (toIndex < 0 || toIndex >= playlist.length) return;
                dispatch(sceneActions.reorderPlaylist({ fromIndex, toIndex }));
                void persistPlaylistIfDesktop();
              }}
              onDragEnd={() => setDragOverTrackId(null)}
            >
              <div className="playlist-track-row-top">
                <button
                  className="playlist-track-btn"
                  onClick={() => {
                    if (showPlayer) {
                      void playTrack(track);
                      return;
                    }
                    invokePlaylistPlay(track.id);
                  }}
                  title={track.title}
                >
                  {editingId === track.id ? (
                    <input
                      className="playlist-track-input"
                      value={editingTitle}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyRename(track);
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelRename();
                        }
                      }}
                      onBlur={() => applyRename(track)}
                      placeholder="Название трека"
                      autoFocus
                    />
                  ) : (
                    <span
                      className={`playlist-track-title ${isEditMode ? "editable" : ""}`}
                      onClick={(e) => {
                        if (!isEditMode) return;
                        e.preventDefault();
                        e.stopPropagation();
                        startRename(track);
                      }}
                      title={isEditMode ? "Переименовать" : track.title}
                    >
                      {track.title}
                    </span>
                  )}
                  <span
                    className="playlist-preload-dot"
                    data-state={preloadStatusById[track.id] ?? "idle"}
                    aria-hidden="true"
                    title={
                      (preloadStatusById[track.id] ?? "idle") === "ready"
                        ? "Готов"
                        : (preloadStatusById[track.id] ?? "idle") === "loading"
                          ? "Грузится…"
                          : (preloadStatusById[track.id] ?? "idle") === "error"
                            ? "Ошибка загрузки"
                            : "Не готов"
                    }
                  />
                </button>
              </div>

              {isEditMode ? (
                <div
                  className="playlist-track-settings"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    className="playlist-track-icon-btn"
                    data-active={track.loop ?? false}
                    aria-pressed={track.loop ?? false}
                    onClick={() => updateLoop(track, !(track.loop ?? false))}
                    title={(track.loop ?? false) ? "Зацикливание включено" : "Зацикливание выключено"}
                    aria-label="Зацикливание"
                  >
                    ∞
                  </button>

                  <div className="playlist-track-fade">
                    <span>Fade</span>
                    <input
                      type="range"
                      min={0}
                      max={3000}
                      step={100}
                      value={track.fadeMs ?? 500}
                      style={
                        {
                          ["--range-fill" as unknown as string]: `${Math.min(
                            100,
                            Math.max(0, ((track.fadeMs ?? 500) / 3000) * 100),
                          )}%`,
                        } as React.CSSProperties
                      }
                      onChange={(event) => updateFade(track, Number(event.target.value))}
                    />
                  </div>

                  <Buttons.DeleteButton
                    variant="playlist"
                    onClick={() => void deleteTrack(track)}
                    title="Удалить трек"
                    aria-label="Удалить трек"
                  />
                </div>
              ) : null}
            </ListItem>
          ))
        )}
        <Buttons.AddButton
          onClick={addTracks}
          disabled={playlistUpload.uploading}
          title={addButtonTitle}
          aria-disabled={!desktopAvailable || playlistUpload.uploading}
          aria-label={addButtonTitle}
        />
      </div>
        </aside>
      ) : null}
      {showPlayer ? (
        <PlaylistBottomControls
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          volume={volume}
          progressPercent={progressPercent}
          volumePercent={volumePercent}
          canGoPrev={canGoPrevTrack}
          canGoNext={canGoNextTrack}
          onPrevTrack={playPreviousTrack}
          onNextTrack={playNextTrack}
          onTogglePlayback={togglePlayback}
          onSeek={seekPlayer}
          onVolumeChange={setPlayerVolume}
          formatTime={formatTime}
        />
      ) : null}
    </>
  );
};
