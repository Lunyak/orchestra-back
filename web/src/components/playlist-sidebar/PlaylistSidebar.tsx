import React, { useCallback, useEffect, useRef, useState } from "react";
import "./style.css";

export interface PlaylistTrack {
  id: number;
  title: string;
  file: string;
  fadeMs?: number;
  loop?: boolean;
  /** URL на сервере (MinIO), если трек уже выгружен с десктопа */
  remoteUrl?: string;
}

interface PlaylistSidebarProps {
  projectName: string;
  tracks?: PlaylistTrack[];
  sceneName?: string;
  onRegisterPlayHandler?: (handler: (trackId: number) => void) => void;
  onPlaylistChange?: (tracks: PlaylistTrack[]) => void;
}

export const PlaylistSidebar: React.FC<PlaylistSidebarProps> = ({
  projectName: _projectName,
  tracks = [],
  sceneName: _sceneName = "script",
  onRegisterPlayHandler,
  onPlaylistChange,
}) => {
  const [currentTrack, setCurrentTrack] = useState<PlaylistTrack | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistTrack[]>(tracks);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isCompact, setIsCompact] = useState(true);
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(false);
  const audioRefA = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);
  const [activeAudioKey, setActiveAudioKey] = useState<"a" | "b">("a");
  const fadeTimers = useRef<{ a: number | null; b: number | null }>({
    a: null,
    b: null,
  });
  const playRequestId = useRef(0);

  useEffect(() => {
    setPlaylist(
      tracks.map((track) => ({
        ...track,
        fadeMs: track.fadeMs ?? 500,
        loop: track.loop ?? false,
      })),
    );
  }, [tracks]);

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

  const resolveTrackSrc = useCallback((file: string, remoteUrl?: string) => {
    // Если трек уже загружен на сервер с десктопа – используем прямой URL
    if (remoteUrl) return remoteUrl;
    // Fallback: локальный путь (старые проекты или когда remoteUrl ещё нет)
    return file;
  }, []);

  const clearFadeTimer = useCallback((key: "a" | "b") => {
    const timer = fadeTimers.current[key];
    if (timer) {
      window.clearInterval(timer);
      fadeTimers.current[key] = null;
    }
  }, []);

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
    if (!track.remoteUrl) {
      console.warn(
        "[PlaylistSidebar] Нельзя проиграть трек без remoteUrl. Загрузите его с десктопа.",
        { id: track.id, title: track.title, file: track.file },
      );
      return;
    }
    const activeAudio = activeAudioKey === "a" ? audioRefA.current : audioRefB.current;
    const inactiveAudio = activeAudioKey === "a" ? audioRefB.current : audioRefA.current;
    const inactiveKey = activeAudioKey === "a" ? "b" : "a";
    if (!activeAudio || !inactiveAudio) return;
    const fadeMs = track.fadeMs ?? 500;
    playRequestId.current += 1;
    const requestId = playRequestId.current;
    const isSameTrack = currentTrack?.id === track.id;
    const isAudioPlaying = !activeAudio.paused;

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
      try {
        await activeAudio.play();
        if (requestId !== playRequestId.current) return;
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
    console.log("[PlaylistSidebar] playTrack src", {
      id: track.id,
      title: track.title,
      file: track.file,
      remoteUrl: track.remoteUrl,
      src,
    });
    if (inactiveAudio.src !== src) {
      inactiveAudio.src = src;
    }
    inactiveAudio.muted = false;
    inactiveAudio.currentTime = 0;
    inactiveAudio.loop = track.loop ?? false;
    inactiveAudio.volume = 0;
    try {
      await inactiveAudio.play();
      if (requestId !== playRequestId.current) return;
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

  const savePlaylist = async (nextTracks: PlaylistTrack[]) => {
    try {
      onPlaylistChange?.(nextTracks);
    } catch (err) {
      console.error("Failed to save playlist:", err);
    }
  };

  const updatePlaylist = async (nextTracks: PlaylistTrack[]) => {
    setPlaylist(nextTracks);
    await savePlaylist(nextTracks);
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
    const nextTracks = playlist.map((item) =>
      item.id === track.id ? { ...item, title: nextTitle } : item,
    );
    await updatePlaylist(nextTracks);
    setEditingId(null);
    setEditingTitle("");
  };

  const updateFade = async (track: PlaylistTrack, nextFade: number) => {
    const nextTracks = playlist.map((item) =>
      item.id === track.id ? { ...item, fadeMs: nextFade } : item,
    );
    await updatePlaylist(nextTracks);
  };

  const updateLoop = async (track: PlaylistTrack, nextLoop: boolean) => {
    const nextTracks = playlist.map((item) =>
      item.id === track.id ? { ...item, loop: nextLoop } : item,
    );
    await updatePlaylist(nextTracks);
  };

  const deleteTrack = async (track: PlaylistTrack) => {
    const nextTracks = playlist.filter((item) => item.id !== track.id);
    await updatePlaylist(nextTracks);
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

  const moveTrack = async (trackId: number, direction: "up" | "down") => {
    const index = playlist.findIndex((item) => item.id === trackId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= playlist.length) return;
    const nextTracks = [...playlist];
    const [moved] = nextTracks.splice(index, 1);
    nextTracks.splice(targetIndex, 0, moved);
    await updatePlaylist(nextTracks);
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
    console.warn("Перетаскивание локальных файлов не поддерживается в веб-версии.");
  };

  return (
    <aside
      className={`playlist-sidebar ${isDragOver ? "drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
        <div className={`playlist-controls ${isCompact ? "compact" : ""}`}>
          <div className="playlist-controls-row">
            <button
              className="playlist-play-btn"
              onClick={togglePlayback}
              disabled={!currentTrack}
            >
              {isPlaying ? "Пауза" : "Играть"}
            </button>
            <button
              className="playlist-toggle-btn"
              onClick={() => setIsCompact((prev) => !prev)}
            >
              {isCompact ? "↕" : "—"}
            </button>
          </div>
          <div className="playlist-progress">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={Math.min(progress, duration || 0)}
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
              onChange={handleVolumeChange}
            />
          </div>
          <label className="playlist-crossfade">
            <input
              type="checkbox"
              checked={crossfadeEnabled}
              onChange={(event) => setCrossfadeEnabled(event.target.checked)}
            />
            Кроссфейд
          </label>
        </div>
      </div>
      <div className="playlist-tracks">
        {playlist.length === 0 ? (
          <div className="playlist-empty">Треки не добавлены</div>
        ) : (
          playlist.map((track) => (
            <div
              key={track.id}
              className={`playlist-track-row ${isCompact ? "compact" : ""} ${currentTrack?.id === track.id ? "active" : ""
                }`}
            >
              {editingId === track.id ? (
                <>
                  <input
                    className="playlist-track-input"
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    placeholder="Название трека"
                  />
                  {!isCompact && (
                    <div className="playlist-track-actions">
                      <button
                        className="playlist-action-btn"
                        onClick={() => applyRename(track)}
                      >
                        Сохранить
                      </button>
                      <button className="playlist-action-btn" onClick={cancelRename}>
                        Отмена
                      </button>
                    </div>
                  )}
                  {!isCompact && (
                    <div className="playlist-track-fade">
                      <span>Fade</span>
                      <input
                        type="range"
                        min={0}
                        max={3000}
                        step={100}
                        value={track.fadeMs ?? 500}
                        onChange={(event) =>
                          updateFade(track, Number(event.target.value))
                        }
                      />
                    </div>
                  )}
                  {!isCompact && (
                    <label className="playlist-track-loop">
                      <input
                        type="checkbox"
                        checked={track.loop ?? false}
                        onChange={(event) => updateLoop(track, event.target.checked)}
                      />
                      Зациклить
                    </label>
                  )}
                </>
              ) : (
                <>
                  <button
                    className="playlist-track-btn"
                    onClick={() => playTrack(track)}
                    title={
                      track.remoteUrl
                        ? track.title
                        : `${track.title} (нужно загрузить с десктопа)`
                    }
                    disabled={!track.remoteUrl}
                  >
                    {track.title}
                    {!track.remoteUrl && " ⏳"}
                  </button>
                  {!isCompact && (
                    <div className="playlist-track-actions">
                      <button
                        className="playlist-action-btn"
                        onClick={() => moveTrack(track.id, "up")}
                        disabled={playlist[0]?.id === track.id}
                      >
                        Вверх
                      </button>
                      <button
                        className="playlist-action-btn"
                        onClick={() => moveTrack(track.id, "down")}
                        disabled={playlist[playlist.length - 1]?.id === track.id}
                      >
                        Вниз
                      </button>
                      <button
                        className="playlist-action-btn"
                        onClick={() => startRename(track)}
                      >
                        Переименовать
                      </button>
                      <button
                        className="playlist-action-btn danger"
                        onClick={() => deleteTrack(track)}
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                  {!isCompact && (
                    <div className="playlist-track-fade">
                      <span>Fade</span>
                      <input
                        type="range"
                        min={0}
                        max={3000}
                        step={100}
                        value={track.fadeMs ?? 500}
                        onChange={(event) =>
                          updateFade(track, Number(event.target.value))
                        }
                      />
                    </div>
                  )}
                  {!isCompact && (
                    <label className="playlist-track-loop">
                      <input
                        type="checkbox"
                        checked={track.loop ?? false}
                        onChange={(event) => updateLoop(track, event.target.checked)}
                      />
                      Зациклить
                    </label>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

