import React, { useEffect, useRef, useState } from "react";
import "./style.css";

export interface HeaderSound {
  id: number;
  title: string;
  file: string;
  icon?: string;
  volume?: number;
  fadeMs?: number;
  loop?: boolean;
  remoteUrl?: string;
  remoteKey?: string;
}

interface LoadedTrack {
  id: number;
  name: string;
  url: string;
  icon?: string;
  volume: number;
  fadeMs: number;
  loop: boolean;
  isPlaying: boolean;
}

interface HeaderPlayerProps {
  projectName: string;
  sceneName: string;
  sounds?: HeaderSound[];
  /** Вызывается после успешного сохранения звуков в файл (чтобы пушнуть сцену на сервер) */
  onSoundsSaved?: () => void;
}

export const HeaderPlayer: React.FC<HeaderPlayerProps> = ({
  projectName,
  sceneName,
  sounds = [],
  onSoundsSaved,
}) => {
  const [tracks, setTracks] = useState<LoadedTrack[]>(
    sounds.map((sound) => ({
      id: sound.id,
      name: sound.title,
      url: sound.remoteUrl ?? sound.file,
      icon: sound.icon,
      volume: sound.volume ?? 0.8,
      fadeMs: sound.fadeMs ?? 500,
      loop: sound.loop ?? false,
      isPlaying: false,
    })),
  );
  const [showSettings, setShowSettings] = useState(false);
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});
  const fadeTimers = useRef<Record<number, number | null>>({});

  useEffect(() => {
    setTracks(
      sounds.map((sound) => ({
        id: sound.id,
        name: sound.title,
        url: sound.remoteUrl ?? sound.file,
        icon: sound.icon,
        volume: sound.volume ?? 0.8,
        fadeMs: sound.fadeMs ?? 500,
        loop: sound.loop ?? false,
        isPlaying: false,
      })),
    );
  }, [sounds]);

  const saveSounds = async (nextTracks: LoadedTrack[]) => {
    try {
      const current = await window.api.readProjectScene(projectName, sceneName);
      const payload = {
        ...current,
        sounds: nextTracks.map((track) => {
          const orig = sounds.find((s) => s.id === track.id);
          return {
            id: track.id,
            title: track.name,
            file: orig?.file ?? track.url,
            icon: track.icon,
            volume: track.volume,
            fadeMs: track.fadeMs,
            loop: track.loop,
            remoteKey: orig?.remoteKey,
            remoteUrl: orig?.remoteUrl,
          };
        }),
      };
      const result = await window.api.saveProjectScene(
        projectName,
        sceneName,
        payload,
      );
      if (!result?.ok) {
        console.error("Failed to save sounds:", result?.error);
      } else {
        onSoundsSaved?.();
      }
    } catch (err) {
      console.error("Failed to save sounds:", err);
    }
  };

  const addTracks = async () => {
    try {
      const res = await window.api.pickProjectSound(projectName);
      if (!res?.ok) {
        if (res?.canceled) return;
        console.error("Failed to pick sound:", res?.error);
        return;
      }

      const maxId = tracks.reduce((acc, t) => Math.max(acc, t.id), 0);
      const newTracks: LoadedTrack[] = res.tracks.map(
        (track: { title: string; file: string }, index: number) => ({
          id: maxId + index + 1,
          name: track.title,
          url: track.file,
          icon: undefined,
          volume: 0.8,
          fadeMs: 500,
          loop: false,
          isPlaying: false,
        }),
      );
      const nextTracks = [...tracks, ...newTracks];
      setTracks(nextTracks);
      await saveSounds(nextTracks);
    } catch (err) {
      console.error("Failed to add sounds:", err);
    }
  };

  const removeTrack = async (track: LoadedTrack) => {
    try {
      const res = await window.api.deleteProjectSound(projectName, track.url);
      if (!res?.ok) {
        console.error("Failed to delete sound:", res?.error);
      }
    } catch (err) {
      console.error("Failed to delete sound:", err);
    }

    const audio = audioRefs.current[track.id];
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    const nextTracks = tracks.filter((item) => item.id !== track.id);
    setTracks(nextTracks);
    await saveSounds(nextTracks);
  };

  const clearFadeTimer = (trackId: number) => {
    const timer = fadeTimers.current[trackId];
    if (timer) {
      window.clearInterval(timer);
      fadeTimers.current[trackId] = null;
    }
  };

  const runFade = (
    trackId: number,
    from: number,
    to: number,
    duration: number,
    onDone?: () => void,
  ) => {
    const audio = audioRefs.current[trackId];
    if (!audio) return;
    clearFadeTimer(trackId);
    const safeDuration = Math.max(0, duration);
    if (safeDuration === 0) {
      audio.volume = to;
      onDone?.();
      return;
    }
    const start = Date.now();
    audio.volume = from;
    fadeTimers.current[trackId] = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(1, elapsed / safeDuration);
      audio.volume = from + (to - from) * ratio;
      if (ratio >= 1) {
        clearFadeTimer(trackId);
        onDone?.();
      }
    }, 30);
  };

  const resolveSoundSrc = (file: string) => {
    const url = new URL(`project-sounds://${encodeURIComponent(projectName)}/`);
    url.pathname = `/${file}`;
    return url.toString();
  };

  const toggleTrack = (track: LoadedTrack) => {
    const audio = audioRefs.current[track.id];
    if (!audio) return;
    if (audio.paused) {
      const src = resolveSoundSrc(track.url);
      if (audio.src !== src) {
        audio.src = src;
      }
      audio.loop = track.loop;
      audio.volume = 0;
      audio.play().catch((error) => {
        console.error("Ошибка воспроизведения:", error);
      });
      runFade(track.id, 0, track.volume, track.fadeMs);
      setTracks((prev) =>
        prev.map((item) =>
          item.id === track.id ? { ...item, isPlaying: true } : item,
        ),
      );
    } else {
      const from = audio.volume;
      runFade(track.id, from, 0, track.fadeMs, () => {
        audio.pause();
        setTracks((prev) =>
          prev.map((item) =>
            item.id === track.id ? { ...item, isPlaying: false } : item,
          ),
        );
      });
    }
  };

  const handleVolumeChange = (track: LoadedTrack, value: number) => {
    const audio = audioRefs.current[track.id];
    if (audio) {
      audio.volume = value;
    }
    setTracks((prev) =>
      prev.map((item) =>
        item.id === track.id ? { ...item, volume: value } : item,
      ),
    );
  };

  const handleFadeChange = (track: LoadedTrack, value: number) => {
    setTracks((prev) =>
      prev.map((item) =>
        item.id === track.id ? { ...item, fadeMs: value } : item,
      ),
    );
  };

  const handleLoopChange = async (track: LoadedTrack, value: boolean) => {
    const audio = audioRefs.current[track.id];
    if (audio) {
      audio.loop = value;
    }
    const nextTracks = tracks.map((item) =>
      item.id === track.id ? { ...item, loop: value } : item,
    );
    setTracks(nextTracks);
    await saveSounds(nextTracks);
  };

  const resolveIconSrc = (file: string) => {
    const url = new URL(`project-sound-icons://${encodeURIComponent(projectName)}/`);
    url.pathname = `/${file}`;
    return url.toString();
  };

  const addIcon = async (track: LoadedTrack) => {
    try {
      const res = await window.api.pickProjectSoundIcon(projectName);
      if (!res?.ok) {
        if (res?.canceled) return;
        console.error("Failed to pick icon:", res?.error);
        return;
      }

      const nextTracks = tracks.map((item) =>
        item.id === track.id ? { ...item, icon: res.file } : item,
      );
      setTracks(nextTracks);
      await saveSounds(nextTracks);
    } catch (err) {
      console.error("Failed to add icon:", err);
    }
  };

  return (
    <div className="header-player">
      <button
        className="header-player-settings-toggle"
        onClick={() => setShowSettings((prev) => !prev)}
      >
        {showSettings ? "Скрыть настройки" : "Настройки"}
      </button>

      <div className="header-player-list">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`header-player-track-row ${track.isPlaying ? "playing" : ""
              } ${showSettings ? "settings-open" : ""}`}
            onClick={() => toggleTrack(track)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleTrack(track);
              }
            }}
          >
            <audio
              ref={(el) => {
                audioRefs.current[track.id] = el;
              }}
              onEnded={() =>
                setTracks((prev) =>
                  prev.map((item) =>
                    item.id === track.id ? { ...item, isPlaying: false } : item,
                  ),
                )
              }
            />
            <div
              className="header-player-mixer"
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className="header-player-knob"
                style={{
                  ["--sweep" as keyof React.CSSProperties]: `${Math.round(
                    track.volume * 360,
                  )}deg`,
                  ["--angle" as keyof React.CSSProperties]: `${Math.round(
                    track.volume * 360 - 90,
                  )}deg`,
                }}
              >
                <div className="header-player-knob-indicator" />
                <input
                  className="header-player-knob-input"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.volume}
                  onChange={(event) =>
                    handleVolumeChange(track, Number(event.target.value))
                  }
                />
              </div>
            </div>
            {track.icon ? (
              <img
                className="header-player-track-icon"
                src={resolveIconSrc(track.icon)}
                alt={track.name}
                title={track.name}
              />
            ) : (
              <div className="header-player-track-name" title={track.name}>
                {track.name}
              </div>
            )}
            <button
              className="header-player-remove"
              onClick={(event) => {
                event.stopPropagation();
                removeTrack(track);
              }}
            >
              ×
            </button>
            {showSettings && (
              <div
                className="header-player-settings"
                onClick={(event) => event.stopPropagation()}
              >
                <label className="header-player-setting">
                  <span>Fade</span>
                  <input
                    className="header-player-slider header-player-fade"
                    type="range"
                    min={0}
                    max={3000}
                    step={100}
                    value={track.fadeMs}
                    onChange={(event) =>
                      handleFadeChange(track, Number(event.target.value))
                    }
                    aria-label="Fade duration"
                    title={`Плавность: ${track.fadeMs}мс`}
                  />
                </label>
                <label className="header-player-loop">
                  <input
                    type="checkbox"
                    checked={track.loop}
                    onChange={(event) =>
                      handleLoopChange(track, event.target.checked)
                    }
                  />
                  Зациклить
                </label>
                <button
                  className="header-player-icon-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    addIcon(track);
                  }}
                >
                  Иконка
                </button>
              </div>
            )}
          </div>
        ))}
        <div
          className="header-player-track-row header-player-load-tile"
          onClick={addTracks}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              addTracks();
            }
          }}
        >
          <div className="header-player-track-name">Добавить</div>
          <div className="header-player-load-icon" aria-hidden="true">
            ↑
          </div>
        </div>
        {tracks.length === 0 && (
          <div className="header-player-empty">Треки не загружены</div>
        )}
      </div>
    </div>
  );
};
