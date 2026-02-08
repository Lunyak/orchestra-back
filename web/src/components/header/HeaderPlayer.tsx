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
  onSoundsChange?: (sounds: HeaderSound[]) => void;
  /** При NotSupportedError (CORS и т.п.) — загрузить по ключу и воспроизвести blob URL */
  onFetchSoundBlobUrl?: (key: string) => Promise<string | null>;
}

export const HeaderPlayer: React.FC<HeaderPlayerProps> = ({
  sounds = [],
  onFetchSoundBlobUrl,
}) => {
  const [tracks, setTracks] = useState<LoadedTrack[]>(
    sounds.map((sound) => ({
      id: sound.id,
      name: sound.title,
      url: sound.file,
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
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setTracks(
      sounds.map((sound) => ({
        id: sound.id,
        name: sound.title,
        url: sound.file,
        icon: sound.icon,
        volume: sound.volume ?? 0.8,
        fadeMs: sound.fadeMs ?? 500,
        loop: sound.loop ?? false,
        isPlaying: false,
      })),
    );
  }, [sounds]);

  useEffect(() => () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const isNotSupportedError = (err: unknown) =>
    err instanceof DOMException && err.name === "NotSupportedError" ||
    (err instanceof Error && /no supported source|Failed to load/i.test(err.message));

  /** Ключ хранилища: из URL (/files/play/KEY, /orchestra-media/...) или сам track.url если это не URL */
  const getKeyFromUrl = (url: string): string | null => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const m = url.match(/\/files\/play\/([^/?#]+)/) || url.match(/\/orchestra-media\/([^?#]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    }
    return url;
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

  /** Сначала по ссылке (как плейлист); при NotSupportedError (CORS) — fallback через blob. */
  const toggleTrack = async (track: LoadedTrack) => {
    const audio = audioRefs.current[track.id];
    if (!audio) return;
    if (audio.paused) {
      if (!track.url) {
        console.warn("[HeaderPlayer] Нет URL у трека", track.id, track.name);
        return;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      let src = track.url;
      if (audio.src !== src) {
        audio.src = src;
      }
      audio.loop = track.loop;
      audio.volume = 0;
      try {
        await audio.play();
      } catch (error) {
        if (isNotSupportedError(error) && onFetchSoundBlobUrl) {
          const key = getKeyFromUrl(track.url) || track.url;
          const blobUrl = await onFetchSoundBlobUrl(key);
          if (blobUrl) {
            blobUrlRef.current = blobUrl;
            audio.src = blobUrl;
            try {
              await audio.play();
            } catch (retryErr) {
              console.error("Ошибка воспроизведения (повтор):", retryErr);
              return;
            }
          } else {
            console.error("Ошибка воспроизведения:", error);
            return;
          }
        } else {
          console.error("Ошибка воспроизведения:", error);
          return;
        }
      }
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

  const handleLoopChange = (track: LoadedTrack, value: boolean) => {
    const audio = audioRefs.current[track.id];
    if (audio) audio.loop = value;
    setTracks((prev) =>
      prev.map((item) =>
        item.id === track.id ? { ...item, loop: value } : item,
      ),
    );
  };

  const resolveIconSrc = (file: string) => file;

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
              </div>
            )}
          </div>
        ))}
        {tracks.length === 0 && (
          <div className="header-player-empty">Нет звуков</div>
        )}
      </div>
    </div>
  );
};

