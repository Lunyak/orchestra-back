import React, { useEffect, useRef, useState } from "react";
import { ensureProject } from "../../../sync/api";
import { getDesktopApi } from "../../platform/desktop-api";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  pickSceneSoundsDesktop,
  sceneActions,
  uploadSceneSoundsWeb,
} from "../../../features/scene/model/scene-slice";
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
    setTracks(
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
        isPlaying: false,
        filePath: sound.filePath,
        remoteKey: sound.remoteKey,
        remoteUrl: sound.remoteUrl,
      })),
    );
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
    if (!accessToken) return soundsToUpload.map((s) => ({ ...s, volume: 0.8, fadeMs: 500, loop: false }));

    const projectIdKey = `projectId:${projectName}`;
    let projectId = typeof window !== "undefined" ? localStorage.getItem(projectIdKey) : null;
    if (!projectId) {
      try {
        const project = await ensureProject(accessToken, projectName, `Проект ${projectName}`);
        projectId = project.id;
        if (typeof window !== "undefined") localStorage.setItem(projectIdKey, projectId);
      } catch (err) {
        console.error("[sounds] ensureProject failed", err);
        return soundsToUpload.map((s) => ({ ...s, volume: 0.8, fadeMs: 500, loop: false }));
      }
    }

    const result: HeaderSound[] = [];
    const api = getDesktopApi();
    if (!api?.invoke) {
      console.warn("[sounds] No desktop API — upload skipped, sounds will have no remoteKey/remoteUrl");
      return soundsToUpload.map((s) => ({ ...s, volume: 0.8, fadeMs: 500, loop: false }));
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
            remoteKey: res.key,
            remoteUrl: res.url,
          });
        } else {
          console.error("[sounds] upload failed (no key/url)", res?.error ?? res);
          result.push({ ...s, volume: 0.8, fadeMs: 500, loop: false });
        }
      } catch (err) {
        console.error("[sounds] upload error", err);
        result.push({ ...s, volume: 0.8, fadeMs: 500, loop: false });
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

  const resolveIconSrc = (file: string) => {
    const url = new URL(`project-sound-icons://${encodeURIComponent(projectName)}/`);
    url.pathname = `/${file}`;
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
      showMessage("Иконки для звуков доступны только в десктоп-версии приложения.");
      return;
    }
    try {
      const res = await desktopApi.pickProjectSoundIcon(projectName);
      if (!res?.ok) {
        if (res?.canceled) return;
        console.error("Failed to pick icon:", res?.error);
        showMessage("Не удалось выбрать иконку. Проверьте консоль.");
        return;
      }
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const projectIdKey = `projectId:${projectName}`;
      let projectId = typeof window !== "undefined" ? localStorage.getItem(projectIdKey) : null;
      if (accessToken && !projectId) {
        try {
          const project = await ensureProject(accessToken, projectName, `Проект ${projectName}`);
          projectId = project.id;
          if (typeof window !== "undefined") localStorage.setItem(projectIdKey, projectId);
        } catch (_) { }
      }
      let iconRemoteKey: string | undefined;
      let iconRemoteUrl: string | undefined;
      const api = getDesktopApi();
      if (api?.invoke && accessToken && projectId) {
        try {
          const up = (await api.invoke("upload-project-sound-icon", {
            projectName,
            file: res.file,
            accessToken,
            projectId,
          })) as { ok?: boolean; key?: string; url?: string };
          if (up?.ok && up?.key && up?.url) {
            iconRemoteKey = up.key;
            iconRemoteUrl = up.url;
          }
        } catch (err) {
          console.error("[sounds] icon upload failed", err);
        }
      }
      const nextTracks = tracks.map((item) =>
        item.id === track.id
          ? { ...item, icon: res.file, iconRemoteKey, iconRemoteUrl }
          : item,
      );
      setTracks(nextTracks);
      dispatch(
        sceneActions.updateSound({
          id: track.id,
          changes: { icon: res.file, iconRemoteKey, iconRemoteUrl },
        }),
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
            {track.icon || track.iconRemoteUrl ? (
              <img
                className="header-player-track-icon"
                src={getIconSrc(track)}
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
            {soundsUpload.uploading ? "Загрузка…" : "Добавить"}
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
