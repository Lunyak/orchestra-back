import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  pickSceneSoundsDesktop,
  playbookActions,
  setSoundIcon,
  uploadSceneSoundsWeb,
} from "../../../features/playbook/model/playbook-slice";
import { registerSoundPlayHandler } from "../../../features/playbook/model/playbook-playback-bridge";
import { createAudioFadeController } from "../../media/audio-fade";
import { getDesktopApi } from "../../platform/desktop-api";
import {
  desktopDeleteProjectSound,
  desktopReadProjectPlaybook,
  desktopSaveProjectPlaybook,
} from "../../platform/desktop-methods";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { playAudioWithSrc } from "./header-player-audio";
import type { HeaderPlayerProps, HeaderSound, LoadedTrack } from "./header-player-types";
import { resolveSoundPlaybackCandidates } from "./resolve-sound-playback-src";

function mapSoundToTrack(sound: HeaderSound, existing?: LoadedTrack | null): LoadedTrack {
  const audioPlaying = existing?.isPlaying ?? false;
  return {
    id: sound.id,
    name: sound.title,
    url: sound.remoteUrl ?? sound.file,
    file: sound.file,
    icon: sound.icon ?? existing?.icon,
    iconRemoteKey: sound.iconRemoteKey ?? existing?.iconRemoteKey,
    iconRemoteUrl: sound.iconRemoteUrl ?? existing?.iconRemoteUrl,
    iconPreviewUrl: existing?.iconPreviewUrl,
    volume: sound.volume ?? existing?.volume ?? 0.8,
    fadeMs: sound.fadeMs ?? existing?.fadeMs ?? 500,
    loop: sound.loop ?? existing?.loop ?? false,
    restartOnStop: sound.restartOnStop ?? existing?.restartOnStop ?? true,
    isPlaying: Boolean(audioPlaying),
    filePath: sound.filePath ?? existing?.filePath,
    remoteKey: sound.remoteKey ?? existing?.remoteKey,
    remoteUrl: sound.remoteUrl ?? existing?.remoteUrl,
  };
}

export function useHeaderPlayer({
  projectName,
  sceneName,
  sounds = [],
  onSoundsSaved,
  onRegisterToggleHandler,
  settingsOpen,
  showSettingsToggle = true,
}: HeaderPlayerProps) {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const soundsUpload = useAppSelector((s) => s.playbook.soundsUpload);
  const [tracks, setTracks] = useState<LoadedTrack[]>(() =>
    sounds.map((sound) => mapSoundToTrack(sound)),
  );
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const isSettingsControlled = settingsOpen !== undefined;
  const showSettings = isSettingsControlled ? Boolean(settingsOpen) : internalSettingsOpen;
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});
  const audioFade = useMemo(() => createAudioFadeController(), []);
  const messageTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const iconTargetIdRef = useRef<number | null>(null);
  const tracksRef = useRef<LoadedTrack[]>(tracks);
  const tracksListRef = useRef<HTMLDivElement | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    if (editingId == null) return;
    requestAnimationFrame(() => renameInputRef.current?.focus());
  }, [editingId]);

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
        const isPlaying = existing?.isPlaying ?? (audio ? !audio.paused : false);
        return { ...mapSoundToTrack(sound, existing), isPlaying: Boolean(isPlaying) };
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

  const saveSounds = async (nextTracks: LoadedTrack[]) => {
    const desktopApi = getDesktopApi();
    if (!desktopApi) {
      showMessage("Сохранение звуков доступно только в десктоп-версии приложения.");
      return;
    }
    try {
      const current = await desktopReadProjectPlaybook(desktopApi, projectName, sceneName);
      const payload = {
        ...(current && typeof current === "object" ? current : {}),
        sounds: nextTracks.map((track) => {
          const orig = sounds.find((s) => s.id === track.id);
          return {
            id: track.id,
            title: track.name,
            file: orig?.file ?? track.file ?? track.url,
            icon: track.icon,
            iconRemoteKey: track.iconRemoteKey ?? orig?.iconRemoteKey,
            iconRemoteUrl: track.iconRemoteUrl ?? orig?.iconRemoteUrl,
            volume: track.volume,
            fadeMs: track.fadeMs,
            loop: track.loop,
            restartOnStop: track.restartOnStop,
            remoteKey: track.remoteKey ?? orig?.remoteKey,
            remoteUrl: track.remoteUrl ?? orig?.remoteUrl,
            filePath: orig?.filePath ?? track.filePath,
          };
        }),
      };
      const result = await desktopSaveProjectPlaybook(
        desktopApi,
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

  const startRename = (track: LoadedTrack) => {
    setEditingId(track.id);
    setEditingName(track.name);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  const applyRename = async (trackId: number) => {
    const nextTitle = editingName.trim();
    if (!nextTitle) {
      cancelRename();
      return;
    }
    const nextTracks = tracksRef.current.map((t) =>
      t.id === trackId ? { ...t, name: nextTitle } : t,
    );
    setTracks(nextTracks);
    dispatch(playbookActions.updateSound({ id: trackId, changes: { title: nextTitle } }));
    setEditingId(null);
    setEditingName("");

    if (getDesktopApi()) {
      try {
        await saveSounds(nextTracks);
      } catch (err) {
        console.error("Failed to save sounds after rename:", err);
      }
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
        const res = await desktopDeleteProjectSound(
          desktopApi,
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
    dispatch(playbookActions.removeSound(track.id));
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
    audioFade.run(audio, trackId, from, to, duration, onDone);
  };

  const toggleTrack = async (track: LoadedTrack) => {
    const audio = audioRefs.current[track.id];
    if (!audio) return;
    if (audio.paused) {
      const candidates = await resolveSoundPlaybackCandidates(
        projectName,
        track,
        accessToken,
      );
      if (candidates.length === 0) {
        showMessage("Нет файла звука");
        return;
      }

      audio.loop = track.loop;
      audio.volume = 0;

      let played = false;
      let lastError: unknown = null;
      for (const src of candidates) {
        try {
          await playAudioWithSrc(audio, src);
          played = true;
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!played) {
        console.error("Ошибка воспроизведения:", lastError);
        showMessage("Не удалось воспроизвести звук");
        setTracks((prev) =>
          prev.map((item) =>
            item.id === track.id ? { ...item, isPlaying: false } : item,
          ),
        );
        return;
      }

      const rawVolume = Number(track.volume);
      const playbackVolume =
        Number.isFinite(rawVolume) && rawVolume > 0
          ? Math.min(1, rawVolume)
          : 0.8;
      runFade(track.id, 0, playbackVolume, track.fadeMs);
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

  useEffect(() => {
    if (!onRegisterToggleHandler) return;
    const handler = (soundId: number) => {
      const id = Number(soundId);
      if (!Number.isFinite(id)) return;
      const target = tracksRef.current.find((t) => Number(t.id) === id) ?? null;
      if (target) void toggleTrack(target);
    };
    onRegisterToggleHandler(handler);
  }, [onRegisterToggleHandler]);

  useEffect(() => {
    registerSoundPlayHandler((soundId: number) => {
      const id = Number(soundId);
      if (!Number.isFinite(id)) return;
      const target = tracksRef.current.find((t) => Number(t.id) === id) ?? null;
      if (!target || target.isPlaying) return;
      void toggleTrack(target);
    });
    return () => registerSoundPlayHandler(undefined);
  }, []);

  const handleVolumeChange = (track: LoadedTrack, value: number) => {
    const audio = audioRefs.current[track.id];
    if (audio) {
      audio.volume = value;
    }
    setTracks((prev) => {
      const next = prev.map((item) =>
        item.id === track.id ? { ...item, volume: value } : item,
      );
      tracksRef.current = next;
      return next;
    });
    dispatch(playbookActions.updateSound({ id: track.id, changes: { volume: value } }));
  };

  const handleVolumeChangeRef = useRef(handleVolumeChange);
  handleVolumeChangeRef.current = handleVolumeChange;

  useEffect(() => {
    const list = tracksListRef.current;
    if (!list) return;

    const onWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest<HTMLElement>("[data-sound-id]");
      if (!row || row.dataset.renaming === "true") return;
      const soundId = Number(row.dataset.soundId);
      if (!Number.isFinite(soundId)) return;
      const track = tracksRef.current.find((item) => item.id === soundId);
      if (!track) return;

      event.preventDefault();
      event.stopPropagation();
      const step = event.deltaY > 0 ? -0.05 : 0.05;
      const nextVolume = Math.min(1, Math.max(0, Math.round((track.volume + step) * 100) / 100));
      if (nextVolume === track.volume) return;
      handleVolumeChangeRef.current(track, nextVolume);
    };

    list.addEventListener("wheel", onWheel, { passive: false });
    return () => list.removeEventListener("wheel", onWheel);
  }, []);

  const handleFadeChange = (track: LoadedTrack, value: number) => {
    setTracks((prev) =>
      prev.map((item) =>
        item.id === track.id ? { ...item, fadeMs: value } : item,
      ),
    );
    dispatch(playbookActions.updateSound({ id: track.id, changes: { fadeMs: value } }));
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
    dispatch(playbookActions.updateSound({ id: track.id, changes: { loop: value } }));
  };

  const handleRestartOnStopChange = (track: LoadedTrack, value: boolean) => {
    setTracks((prev) =>
      prev.map((item) =>
        item.id === track.id ? { ...item, restartOnStop: value } : item,
      ),
    );
    dispatch(playbookActions.updateSound({ id: track.id, changes: { restartOnStop: value } }));
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
      const nextTracks = tracks.map((t) =>
        t.id === track.id ? { ...t, ...res.changes } : t,
      );
      setTracks(nextTracks);
      void saveSounds(nextTracks);
    } catch (err) {
      console.error("Failed to add icon:", err);
      showMessage("Не удалось добавить иконку. Проверьте консоль.");
    }
  };

  const handleAudioFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (list.length === 0) return;
    void dispatch(uploadSceneSoundsWeb({ projectSlug: projectName, files: list }));
  };

  const handleIconFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    const soundId = iconTargetIdRef.current;
    iconTargetIdRef.current = null;
    if (!file || soundId == null) return;

    void (async () => {
      const previewUrl = URL.createObjectURL(file);
      setTracks((prev) =>
        prev.map((t) =>
          t.id === soundId ? { ...t, iconPreviewUrl: previewUrl } : t,
        ),
      );
      try {
        const res = await dispatch(
          setSoundIcon({ projectSlug: projectName, soundId, file }),
        ).unwrap();

        if (!res?.changes || Object.keys(res.changes).length === 0) return;
        setTracks((prev) =>
          prev.map((t) =>
            t.id === soundId ? { ...t, ...res.changes, iconPreviewUrl: previewUrl } : t,
          ),
        );
        onSoundsSaved?.();
      } catch (err) {
        console.error("[sounds] web icon upload failed", err);
        showMessage("Не удалось загрузить иконку. Проверьте консоль.");
        setTracks((prev) =>
          prev.map((t) =>
            t.id === soundId ? { ...t, iconPreviewUrl: undefined } : t,
          ),
        );
        URL.revokeObjectURL(previewUrl);
      }
    })();
  };

  const markTrackEnded = (trackId: number) => {
    setTracks((prev) =>
      prev.map((item) =>
        item.id === trackId ? { ...item, isPlaying: false } : item,
      ),
    );
  };

  const bindAudioRef = (trackId: number, el: HTMLAudioElement | null) => {
    audioRefs.current[trackId] = el;
  };

  const toggleSettings = () => setInternalSettingsOpen((prev) => !prev);

  const desktopAvailable = Boolean(getDesktopApi());
  const loadTileTitle = desktopAvailable
    ? "Добавить звуки"
    : "Добавить звуки (веб)";
  const emptyMessage = uiMessage ?? (tracks.length === 0 ? "Треки не загружены" : null);
  const showEmpty = Boolean(uiMessage || tracks.length === 0);

  return {
    projectName,
    tracks,
    showSettings,
    showSettingsToggle,
    soundsUpload,
    emptyMessage,
    showEmpty,
    loadTileTitle,
    editingId,
    editingName,
    fileInputRef,
    iconInputRef,
    tracksListRef,
    renameInputRef,
    setEditingName,
    toggleSettings,
    addTracks,
    removeTrack,
    toggleTrack,
    handleVolumeChange,
    handleFadeChange,
    handleLoopChange,
    handleRestartOnStopChange,
    startRename,
    cancelRename,
    applyRename,
    addIcon,
    handleAudioFilesChange,
    handleIconFileChange,
    markTrackEnded,
    bindAudioRef,
  };
}

export type HeaderPlayerViewModel = ReturnType<typeof useHeaderPlayer>;
