import React, { useEffect, useRef, useState } from "react";
import {
  pickSceneSoundsDesktop,
  sceneActions,
  setSoundIcon,
  uploadSceneSoundsWeb,
} from "../../../features/scene/model/scene-slice";
import { ensureProject } from "../../../sync/api";
import { getDesktopApi } from "../../platform/desktop-api";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import "./style.css";

export interface HeaderSound {
  id: number;
  title: string;
  file: string;
  icon?: string;
  /** URL иконки в MinIO — для отображения на вебе */
  iconRemoteKey?: string;
  iconRemoteUrl?: string;
  volume?: number;
  fadeMs?: number;
  loop?: boolean;
  /** If true, stopping the sound resets playback position to the start. */
  restartOnStop?: boolean;
  remoteUrl?: string;
  remoteKey?: string;
  /** Полный путь к файлу на диске (только локально, для загрузки на сервер) */
  filePath?: string;
}

interface LoadedTrack {
  id: number;
  name: string;
  /** URL для воспроизведения (remoteUrl или локальный file) */
  url: string;
  /** Короткое имя файла для сохранения в сцене (как в плейлисте) */
  file?: string;
  icon?: string;
  iconRemoteKey?: string;
  iconRemoteUrl?: string;
  volume: number;
  fadeMs: number;
  loop: boolean;
  restartOnStop: boolean;
  isPlaying: boolean;
  filePath?: string;
  remoteKey?: string;
  remoteUrl?: string;
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
  const dispatch = useAppDispatch();
  const soundsUpload = useAppSelector((s) => s.scene.soundsUpload);
  const [tracks, setTracks] = useState<LoadedTrack[]>(
    sounds.map((sound) => ({
      id: sound.id,
      name: sound.title,
      url: sound.remoteUrl ?? sound.file,
      file: sound.file,
      icon: sound.icon,
      iconRemoteKey: sound.iconRemoteKey,
      iconRemoteUrl: sound.iconRemoteUrl,
      volume: sound.volume ?? 0.8,
      fadeMs: sound.fadeMs ?? 500,
      loop: sound.loop ?? false,
      restartOnStop: sound.restartOnStop ?? true,
      isPlaying: false,
      filePath: sound.filePath,
      remoteKey: sound.remoteKey,
      remoteUrl: sound.remoteUrl,
    })),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});
  const fadeTimers = useRef<Record<number, number | null>>({});
  const messageTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const iconTargetIdRef = useRef<number | null>(null);

  const getLocalProjectId = () => {
    const key = `projectId:${projectName}`;
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

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
    setTracks((prev) => {
      const prevById = new Map(prev.map((t) => [t.id, t]));
      return sounds.map((sound) => {
        const existing = prevById.get(sound.id) ?? null;
        const audio = audioRefs.current?.[sound.id] ?? null;
        const isPlaying =
          existing?.isPlaying ??
          (audio ? !audio.paused : false);
        return {
          id: sound.id,
          name: sound.title,
          url: sound.remoteUrl ?? sound.file,
          file: sound.file,
          icon: sound.icon,
          iconRemoteKey: sound.iconRemoteKey,
          iconRemoteUrl: sound.iconRemoteUrl,
          // Preserve previous values if backend payload doesn't include them yet.
          volume: sound.volume ?? existing?.volume ?? 0.8,
          fadeMs: sound.fadeMs ?? existing?.fadeMs ?? 500,
          loop: sound.loop ?? existing?.loop ?? false,
          restartOnStop: sound.restartOnStop ?? existing?.restartOnStop ?? true,
          isPlaying: Boolean(isPlaying),
          filePath: sound.filePath ?? existing?.filePath,
          remoteKey: sound.remoteKey ?? existing?.remoteKey,
          remoteUrl: sound.remoteUrl ?? existing?.remoteUrl,
        };
      });
    });
  }, [sounds]);

  useEffect(() => {
    if (soundsUpload.error) {
      showMessage(soundsUpload.error);
    }
  }, [soundsUpload.error]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  /** Как в плейлисте: загружаем файлы на сервер сразу и получаем remoteKey/remoteUrl. */
  const uploadSoundsToServer = async (
    soundsToUpload: Array<{ id: number; title: string; file: string; filePath?: string }>,
  ): Promise<HeaderSound[]> => {
    const accessToken =
      typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!accessToken)
      return soundsToUpload.map((s) => ({
        ...s,
        volume: 0.8,
        fadeMs: 500,
        loop: false,
        restartOnStop: true,
      }));

    const projectIdKey = `projectId:${projectName}`;
    let projectId = typeof window !== "undefined" ? localStorage.getItem(projectIdKey) : null;
    if (!projectId) {
      try {
        const project = await ensureProject(accessToken, projectName, `Проект ${projectName}`);
        projectId = project.id;
        if (typeof window !== "undefined") localStorage.setItem(projectIdKey, projectId);
      } catch (err) {
        console.error("[sounds] ensureProject failed", err);
        return soundsToUpload.map((s) => ({
          ...s,
          volume: 0.8,
          fadeMs: 500,
          loop: false,
          restartOnStop: true,
        }));
      }
    }

    const result: HeaderSound[] = [];
    const api = getDesktopApi();
    if (!api?.invoke) {
      console.warn("[sounds] No desktop API — upload skipped, sounds will have no remoteKey/remoteUrl");
      return soundsToUpload.map((s) => ({
        ...s,
        volume: 0.8,
        fadeMs: 500,
        loop: false,
        restartOnStop: true,
      }));
    }
    for (const s of soundsToUpload) {
      try {
        const res = (await api.invoke("upload-project-sound", {
          projectName,
          file: s.filePath || s.file,
          accessToken,
          projectId: projectId!,
        })) as { ok?: boolean; key?: string; url?: string; error?: string };
        if (res?.ok && res?.key && res?.url) {
          result.push({
            id: s.id,
            title: s.title,
            file: s.file,
            volume: 0.8,
            fadeMs: 500,
            loop: false,
            restartOnStop: true,
            remoteKey: res.key,
            remoteUrl: res.url,
          });
        } else {
          console.error("[sounds] upload failed (no key/url)", res?.error ?? res);
          result.push({ ...s, volume: 0.8, fadeMs: 500, loop: false, restartOnStop: true });
        }
      } catch (err) {
        console.error("[sounds] upload error", err);
        result.push({ ...s, volume: 0.8, fadeMs: 500, loop: false, restartOnStop: true });
      }
    }
    return result;
  };

  const saveSounds = async (nextTracks: LoadedTrack[]) => {
    const desktopApi = getDesktopApi();
    if (!desktopApi) {
      showMessage("Сохранение звуков доступно только в десктоп-версии приложения.");
      return;
    }
    try {
      const current = await desktopApi.readProjectScene(projectName, sceneName);
      const payload = {
        ...current,
        sounds: nextTracks.map((track) => {
          const orig = sounds.find((s) => s.id === track.id);
          return {
            id: track.id,
            title: track.name,
            file: orig?.file ?? track.file ?? track.url,
            icon: track.icon,
            // Приоритет у новых значений (track), чтобы при повторном добавлении обновлялись ссылки
            iconRemoteKey: track.iconRemoteKey ?? orig?.iconRemoteKey,
            iconRemoteUrl: track.iconRemoteUrl ?? orig?.iconRemoteUrl,
            volume: track.volume,
            fadeMs: track.fadeMs,
            loop: track.loop,
            restartOnStop: track.restartOnStop,
            // Приоритет у новых значений (track), чтобы при повторном добавлении обновлялись ссылки
            remoteKey: track.remoteKey ?? orig?.remoteKey,
            remoteUrl: track.remoteUrl ?? orig?.remoteUrl,
            filePath: orig?.filePath ?? track.filePath,
          };
        }),
      };
      const result = await desktopApi.saveProjectScene(
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
      if (soundsUpload.uploading) return;
      const desktopApi = getDesktopApi();
      if (desktopApi) {
        await dispatch(pickSceneSoundsDesktop({ projectSlug: projectName }));
        return;
      }
      fileInputRef.current?.click();
    } catch (err) {
      console.error("Failed to add sounds:", err);
      showMessage("Не удалось добавить звуки. Проверьте консоль.");
    }
  };

  const removeTrack = async (track: LoadedTrack) => {
    const desktopApi = getDesktopApi();
    if (desktopApi) {
      try {
        const res = await desktopApi.deleteProjectSound(
          projectName,
          track.file ?? track.filePath ?? track.url,
        );
        if (!res?.ok) {
          console.error("Failed to delete sound:", res?.error);
          showMessage("Не удалось удалить файл звука. Проверьте консоль.");
        }
      } catch (err) {
        console.error("Failed to delete sound:", err);
        showMessage("Не удалось удалить файл звука. Проверьте консоль.");
      }
    }

    const audio = audioRefs.current[track.id];
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    const nextTracks = tracks.filter((item) => item.id !== track.id);
    setTracks(nextTracks);
    dispatch(sceneActions.removeSound(track.id));
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

  /** URL для воспроизведения: при filePath — локальный файл (project-sounds), иначе remoteUrl или project-sounds по имени. */
  const getPlaybackSrc = (track: LoadedTrack) => {
    const localName = track.file ?? (track.filePath ? track.filePath.replace(/^.*[/\\]/, "") : null);
    if (track.filePath && localName) return resolveSoundSrc(localName);
    if (track.remoteUrl && /^https?:\/\//i.test(track.remoteUrl)) return track.remoteUrl;
    return resolveSoundSrc(track.file ?? track.url);
  };

  const toggleTrack = (track: LoadedTrack) => {
    const audio = audioRefs.current[track.id];
    if (!audio) return;
    if (audio.paused) {
      const src = getPlaybackSrc(track);
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
        if (track.restartOnStop) {
          try {
            audio.currentTime = 0;
          } catch {
            // ignore (best-effort)
          }
        }
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
    dispatch(sceneActions.updateSound({ id: track.id, changes: { volume: value } }));
  };

  const handleFadeChange = (track: LoadedTrack, value: number) => {
    setTracks((prev) =>
      prev.map((item) =>
        item.id === track.id ? { ...item, fadeMs: value } : item,
      ),
    );
    dispatch(sceneActions.updateSound({ id: track.id, changes: { fadeMs: value } }));
  };

  const handleLoopChange = async (track: LoadedTrack, value: boolean) => {
    const audio = audioRefs.current[track.id];
    if (audio) {
      audio.loop = value;
    }
    setTracks((prev) =>
      prev.map((item) =>
        item.id === track.id ? { ...item, loop: value } : item,
      ),
    );
    dispatch(sceneActions.updateSound({ id: track.id, changes: { loop: value } }));
  };

  const handleRestartOnStopChange = (track: LoadedTrack, value: boolean) => {
    setTracks((prev) =>
      prev.map((item) =>
        item.id === track.id ? { ...item, restartOnStop: value } : item,
      ),
    );
    dispatch(sceneActions.updateSound({ id: track.id, changes: { restartOnStop: value } }));
  };

  const resolveIconSrc = (file: string) => {
    const projectId = getLocalProjectId();
    const url = new URL(`project-sound-icons://${encodeURIComponent(projectName)}/`);
    const encodedFile = encodeURIComponent(file);
    url.pathname = projectId
      ? `/${encodeURIComponent(projectId)}/${encodedFile}`
      : `/${encodedFile}`;
    return url.toString();
  };

  /** URL для отображения иконки: remoteUrl на вебе, иначе project-sound-icons на десктопе. */
  const getIconSrc = (track: LoadedTrack) => {
    if (track.iconRemoteUrl && /^https?:\/\//i.test(track.iconRemoteUrl)) return track.iconRemoteUrl;
    if (track.icon) return resolveIconSrc(track.icon);
    return "";
  };

  const addIcon = async (track: LoadedTrack) => {
    const desktopApi = getDesktopApi();
    if (!desktopApi) {
      iconTargetIdRef.current = track.id;
      iconInputRef.current?.click();
      return;
    }

    try {
      const res = await dispatch(
        setSoundIcon({ projectSlug: projectName, soundId: track.id }),
      ).unwrap();
      if (!res?.changes || Object.keys(res.changes).length === 0) return;
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, ...res.changes } : t)),
      );
    } catch (err) {
      console.error("Failed to add icon:", err);
      showMessage("Не удалось добавить иконку. Проверьте консоль.");
    }
  };

  const desktopAvailable = Boolean(getDesktopApi());
  const loadTileTitle = desktopAvailable
    ? "Добавить звуки"
    : "Добавить звуки (веб)";

  return (
    <div className="header-player">
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
          void dispatch(uploadSceneSoundsWeb({ projectSlug: projectName, files: list }));
        }}
      />
      <input
        ref={iconInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          const soundId = iconTargetIdRef.current;
          iconTargetIdRef.current = null;
          if (!file || soundId == null) return;

          void (async () => {
            try {
              const res = await dispatch(
                setSoundIcon({ projectSlug: projectName, soundId, file }),
              ).unwrap();

              if (!res?.changes || Object.keys(res.changes).length === 0) return;
              setTracks((prev) =>
                prev.map((t) => (t.id === soundId ? { ...t, ...res.changes } : t)),
              );
            } catch (err) {
              console.error("[sounds] web icon upload failed", err);
              showMessage("Не удалось загрузить иконку. Проверьте консоль.");
            }
          })();
        }}
      />
      <button
        className="header-player-settings-toggle"
        onClick={() => setShowSettings((prev) => !prev)}
        type="button"
        aria-pressed={showSettings}
        aria-label={showSettings ? "Скрыть настройки звуков" : "Показать настройки звуков"}
        title={showSettings ? "Скрыть настройки звуков" : "Настройки звуков"}
      >
        <svg
          className="header-player-settings-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.51.4 1.05.71 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
          />
        </svg>
      </button>

      <div className="header-player-list">
        {tracks.map((track) => {
          return (
            <div
              key={track.id}
              className={`header-player-track-row ${track.isPlaying ? "playing" : ""} ${showSettings ? "settings-open" : ""}`}
              onClick={() => toggleTrack(track)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleTrack(track);
                }
              } }
            >
              <audio
                ref={(el) => {
                  audioRefs.current[track.id] = el;
                } }
                onEnded={() => setTracks((prev) => prev.map((item) => item.id === track.id ? { ...item, isPlaying: false } : item
                )
                )} />
              <div
                className="header-player-hover-slider header-player-hover-slider--left"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  className="header-player-slider header-player-volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.volume}
                  style={{
                    ["--range-fill" as unknown as string]: `${Math.min(
                      100,
                      Math.max(0, Number(track.volume) * 100)
                    )}%`,
                  }}
                  onChange={(event) => handleVolumeChange(track, Number(event.target.value))}
                  aria-label="Track volume"
                  title={`Громкость: ${Math.round(track.volume * 100)}%`} />
              </div>

              <div
                className="header-player-hover-slider header-player-hover-slider--right"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  className="header-player-slider header-player-fade"
                  type="range"
                  min={0}
                  max={3000}
                  step={100}
                  value={track.fadeMs}
                  style={{
                    ["--range-fill" as unknown as string]: `${Math.min(
                      100,
                      Math.max(0, (Number(track.fadeMs) / 3000) * 100)
                    )}%`,
                  }}
                  onChange={(event) => handleFadeChange(track, Number(event.target.value))}
                  aria-label="Fade duration"
                  title={`Плавность: ${track.fadeMs}мс`} />
              </div>
              {track.icon || track.iconRemoteUrl ? (
                <img
                  className="header-player-track-icon"
                  src={getIconSrc(track)}
                  alt={track.name}
                  title={track.name} />
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
                } }
              >
                ×
              </button>
              {showSettings && (
                <div
                  className="header-player-settings"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    className="header-player-mini-toggle"
                    type="button"
                    aria-pressed={track.restartOnStop}
                    data-active={track.restartOnStop ? "true" : "false"}
                    title="После стопа — с начала"
                    aria-label="После стопа — с начала"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRestartOnStopChange(track, !track.restartOnStop);
                    } }
                  >
                    ↺
                  </button>
                  <button
                    className="header-player-mini-toggle"
                    type="button"
                    aria-pressed={track.loop}
                    data-active={track.loop ? "true" : "false"}
                    title="Цикл"
                    aria-label="Цикл"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleLoopChange(track, !track.loop);
                    } }
                  >
                    ∞
                  </button>
                  <button
                    className="header-player-icon-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      addIcon(track);
                    } }
                    type="button"
                    title="Иконка"
                    aria-label="Иконка"
                  >
                    🏞️
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div
          className="header-player-track-row header-player-load-tile"
          onClick={addTracks}
          role="button"
          tabIndex={0}
          title={loadTileTitle}
          aria-disabled={soundsUpload.uploading}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              addTracks();
            }
          }}
        >
          <div className="header-player-track-name">
            {soundsUpload.uploading ? "Загрузка…" : "+"}
          </div>
          <div className="header-player-load-icon" aria-hidden="true">
            ↑
          </div>
        </div>
        {(uiMessage || tracks.length === 0) && (
          <div className="header-player-empty">
            {uiMessage ?? "Треки не загружены"}
          </div>
        )}
      </div>
    </div>
  );
};
