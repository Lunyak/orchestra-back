import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  addScenePlaylistTracksFromPathsDesktop,
  deleteScenePlaylistTrackDesktop,
  persistScenePlaylistDesktop,
  pickScenePlaylistTracksDesktop,
  sceneActions,
  uploadScenePlaylistWeb,
} from "../../../features/scene/model/scene-slice";
import { getDesktopApi } from "../../platform/desktop-api";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import type { PlaylistTrack } from "../../types/playlist";
import { ListItem } from "../list-item/ListItem";
import "./style.css";

interface PlaylistSidebarProps {
  projectName: string;
  sceneName?: string;
  onRegisterPlayHandler?: (handler: (trackId: number) => void) => void;
}

const EMPTY_PLAYLIST: PlaylistTrack[] = [];

export const PlaylistSidebar: React.FC<PlaylistSidebarProps> = ({
  projectName,
  sceneName = "script",
  onRegisterPlayHandler,
}) => {
  const dispatch = useAppDispatch();
  const playlist = useAppSelector(
    (s) => (s.scene.sceneData?.playlist as PlaylistTrack[] | undefined) ?? EMPTY_PLAYLIST,
  );
  const playlistUpload = useAppSelector((s) => s.scene.playlistUpload);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<PlaylistTrack | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(false);
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const audioRefA = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);
  const [activeAudioKey, setActiveAudioKey] = useState<"a" | "b">("a");
  const fadeTimers = useRef<{ a: number | null; b: number | null }>({
    a: null,
    b: null,
  });
  const playRequestId = useRef(0);
  const messageTimerRef = useRef<number | null>(null);

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

  const resolveTrackSrc = useCallback(
    (file: string, remoteUrl?: string) => {
      // Desktop should prefer local files to avoid network delays during show.
      if (getDesktopApi()) {
        const url = new URL(
          `project-audio://${encodeURIComponent(projectName)}/`,
        );
        url.pathname = `/${file}`;
        return url.toString();
      }
      if (remoteUrl) return remoteUrl;
      const url = new URL(
        `project-audio://${encodeURIComponent(projectName)}/`,
      );
      url.pathname = `/${file}`;
      return url.toString();
    },
    [projectName],
  );

  const clearFadeTimer = useCallback((key: "a" | "b") => {
    const timer = fadeTimers.current[key];
    if (timer) {
      window.clearInterval(timer);
      fadeTimers.current[key] = null;
    }
  }, []);

  const preloadOne = useCallback(async (src: string, runId: number) => {
    const audio = preloadAudioRef.current ?? new Audio();
    preloadAudioRef.current = audio;
    // Do not interfere with the main player.
    audio.preload = "auto";
    audio.muted = true;
    audio.volume = 0;
    if (audio.src !== src) {
      audio.src = src;
    }
    // Start request.
    audio.load();

    // We only need "enough to start", not the full download.
    const ready = await new Promise<"ready">((resolve, reject) => {
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

    if (runId !== preloadRunIdRef.current) {
      // cancelled
      throw new Error("cancelled");
    }
    return ready;
  }, []);

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
      const src = resolveTrackSrc(t.file, t.remoteUrl);
      try {
        await preloadOne(src, runId);
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
  }, [playlist, preloadOne, resolveTrackSrc]);

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

  const runFade = useCallback((
    audio: HTMLAudioElement,
    key: "a" | "b",
    from: number,
    to: number,
    duration: number,
    onDone?: () => void,
  ) => {
    if (!audio) return;
    clearFadeTimer(key);
    const safeDuration = Math.max(0, duration);
    if (safeDuration === 0) {
      audio.volume = to;
      onDone?.();
      return;
    }
    const start = Date.now();
    audio.volume = from;
    fadeTimers.current[key] = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(1, elapsed / safeDuration);
      audio.volume = from + (to - from) * ratio;
      if (ratio >= 1) {
        clearFadeTimer(key);
        onDone?.();
      }
    }, 30);
  }, [clearFadeTimer]);


  const playTrack = useCallback(async (track: PlaylistTrack) => {
    const activeAudio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
    const inactiveAudio = activeAudioKey === "a" ? audioRefB.current : audioRefA.current;
    const inactiveKey = activeAudioKey === "a" ? "b" : "a";
    if (!activeAudio || !inactiveAudio) return;
    const fadeMs = track.fadeMs ?? 500;
    playRequestId.current += 1;
    const requestId = playRequestId.current;
    const isSameTrack = currentTrack?.id === track.id;
    const isAudioPlaying = !activeAudio.paused;

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
      runFade(activeAudio, activeAudioKey, from, 0, fadeMs, () => {
        activeAudio.pause();
        setIsPlaying(false);
      });
      return;
    }

    if (isSameTrack && activeAudio.paused) {
      clearFadeTimer(activeAudioKey);
      const src = resolveTrackSrc(track.file, track.remoteUrl);
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
        runFade(activeAudio, activeAudioKey, activeAudio.volume, volume, fadeMs);
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
        runFade(activeAudio, activeAudioKey, from, 0, fadeMs, () => {
          activeAudio.pause();
        });
      } else {
        await new Promise<void>((resolve) => {
          runFade(activeAudio, activeAudioKey, from, 0, fadeMs, () => {
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

    const src = resolveTrackSrc(track.file, track.remoteUrl);
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
      runFade(inactiveAudio, inactiveKey, 0, volume, fadeMs);
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
    resolveTrackSrc,
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

  const togglePlayback = () => {
    const audio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
    if (!audio) return;
    if (!currentTrack) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => {
          runFade(audio, activeAudioKey, audio.volume, volume, currentTrack.fadeMs ?? 500);
          setIsPlaying(true);
        })
        .catch((error) => {
          console.error("Ошибка воспроизведения:", error);
        });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    setVolume(nextValue);
    const audio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
    if (audio && !audio.paused) {
      audio.volume = nextValue;
    }
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
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

  return (
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
        <audio ref={audioRefA} />
        <audio ref={audioRefB} />
        {currentTrack && (
          <div
            className={`playlist-current ${isPlaying ? "playing" : ""}`}
          >
            <div className="playlist-current-title">{currentTrack.title}</div>
            <div className="playlist-eq" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div className="playlist-controls compact">
          <div className="playlist-controls-row">
            <button
              className="playlist-play-btn"
              onClick={togglePlayback}
              disabled={!currentTrack}
            >
              {isPlaying ? "Пауза" : "Играть"}
            </button>
            <button
              type="button"
              className="playlist-toggle-btn"
              onClick={() => setIsEditMode((p) => !p)}
              aria-pressed={isEditMode}
              title={isEditMode ? "Закрыть настройки плейлиста" : "Настройки плейлиста"}
              aria-label={isEditMode ? "Закрыть настройки плейлиста" : "Настройки плейлиста"}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.54V22a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.54V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.54 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.7 1.7 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
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
          <div className="playlist-progress">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={Math.min(progress, duration || 0)}
              style={
                {
                  ["--range-fill" as unknown as string]: `${progressPercent}%`,
                } as React.CSSProperties
              }
              onChange={handleSeek}
              disabled={!currentTrack || duration <= 0}
            />
            <div className="playlist-timecode">
              {formatTime(progress)} / {formatTime(duration)}
            </div>
          </div>
          <div className="playlist-volume">
            <span>Громкость</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              style={
                {
                  ["--range-fill" as unknown as string]: `${volumePercent}%`,
                } as React.CSSProperties
              }
              onChange={handleVolumeChange}
            />
          </div>
          {isEditMode && (
            <label className="playlist-crossfade">
              <input
                type="checkbox"
                checked={crossfadeEnabled}
                onChange={(event) => setCrossfadeEnabled(event.target.checked)}
              />
              <span className="playlist-crossfade__switch" aria-hidden="true" />
              <span className="playlist-crossfade__text">Кроссфейд</span>
            </label>
          )}
        </div>

      </div>
      <div className="playlist-tracks">
        {playlist.length === 0 ? (
          <div className="playlist-empty">Треки не добавлены</div>
        ) : (
          playlist.map((track, index) => (
            <ListItem
              key={track.id}
              className={`playlist-track-row ${currentTrack?.id === track.id ? "active" : ""} ${isEditMode ? "edit-mode" : ""} ${dragOverTrackId === track.id ? "drag-over" : ""}`}
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
                  onClick={() => playTrack(track)}
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

                  <button
                    type="button"
                    className="playlist-track-remove"
                    onClick={() => void deleteTrack(track)}
                    title="Удалить трек"
                    aria-label="Удалить трек"
                  >
                    ×
                  </button>
                </div>
              ) : null}
            </ListItem>
          ))
        )}
        <button
          type="button"
          className="playlist-add-btn"
          onClick={addTracks}
          disabled={playlistUpload.uploading}
          title={addButtonTitle}
          aria-disabled={!desktopAvailable || playlistUpload.uploading}
        >
          +
        </button>
      </div>
    </aside>
  );
};
