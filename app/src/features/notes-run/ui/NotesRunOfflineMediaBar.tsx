import { useCallback, useEffect, useState } from "react";
import { useScene } from "../../scene";
import { useProject } from "../../project/model/project-context";
import { useAuth } from "../../auth/model/auth-context";
import { isDesktopApp } from "../../../shared/platform/media-url";
import { hydrateSceneFromLocalPack } from "../../scene/model/scene-local-hydration";
import { downloadPlaylistTracksOffline } from "../../../shared/media/web-media-cache";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  getProjectMediaFolderInfo,
  pickProjectMediaFolder,
} from "../../../shared/platform/project-media-folder";
import { useNotesRunContext } from "../model/notes-run-context";

export function NotesRunOfflineMediaBar() {
  const run = useNotesRunContext();
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const { accessToken } = useAuth();
  const { syncAndDownloadProjectorMediaForOffline, importDevMediaFolder } = useScene();
  const playlist = useAppSelector((s) => s.scene.sceneData?.playlist ?? []);
  const [busy, setBusy] = useState(false);
  const [musicBusy, setMusicBusy] = useState(false);
  const [folderLabel, setFolderLabel] = useState<string | null>(null);
  const desktop = isDesktopApp();
  const videoCount = run.videos.length;
  const holdCount = run.holdImages.length;
  const trackCount = playlist.length;

  useEffect(() => {
    if (!projectName) {
      setFolderLabel(null);
      return;
    }
    void getProjectMediaFolderInfo(projectName).then((info) => {
      setFolderLabel(info.label);
    });
  }, [projectName]);

  const handlePickFolder = useCallback(async () => {
    if (!projectName) {
      run.setLiveStatus("Выберите проект");
      return;
    }
    setBusy(true);
    try {
      run.setLiveStatus("Выберите папку с видео и музыкой…");
      const picked = await pickProjectMediaFolder(projectName);
      if (!picked.ok) {
        run.setLiveStatus(picked.error ?? "Папка не выбрана");
        return;
      }
      const imported = await importDevMediaFolder({ scanned: picked, pickIfMissing: false });
      setFolderLabel(picked.folderName ?? picked.mediaRoot?.replace(/^.*[/\\]/, "") ?? null);
      run.setLiveStatus(imported.message);
    } catch (err) {
      run.setLiveStatus(String((err as Error)?.message ?? "Ошибка"));
    } finally {
      setBusy(false);
    }
  }, [importDevMediaFolder, projectName, run]);

  const handleReloadLocal = useCallback(async () => {
    if (!projectName) {
      run.setLiveStatus("Выберите проект");
      return;
    }
    setBusy(true);
    try {
      if (desktop) {
        const info = await getProjectMediaFolderInfo(projectName);
        if (info.path) {
          const imported = await importDevMediaFolder({ pickIfMissing: false });
          setFolderLabel(info.label);
          run.setLiveStatus(imported.message);
          return;
        }
        run.setLiveStatus("Синхронизация и скачивание…");
        const result = await syncAndDownloadProjectorMediaForOffline({
          onProgress: (_current, _total, label) => {
            run.setLiveStatus(`Скачивание: ${label}`);
          },
        });
        run.setLiveStatus(result.message);
        return;
      }

      run.setLiveStatus("Подключаем папку с медиа…");
      await hydrateSceneFromLocalPack(projectName, dispatch);
      const imported = await importDevMediaFolder({ pickIfMissing: false });
      const label =
        imported.folderLabel ??
        imported.message.split("(").pop()?.replace(")", "").trim() ??
        null;
      setFolderLabel(label);
      run.setLiveStatus(imported.message);
    } catch (err) {
      run.setLiveStatus(String((err as Error)?.message ?? "Ошибка"));
    } finally {
      setBusy(false);
    }
  }, [
    desktop,
    dispatch,
    importDevMediaFolder,
    projectName,
    run,
    syncAndDownloadProjectorMediaForOffline,
  ]);

  const handleDownloadMusic = useCallback(async () => {
    if (!projectName) {
      run.setLiveStatus("Выберите проект");
      return;
    }
    if (trackCount === 0) {
      run.setLiveStatus("Плейлист пуст — нужен интернет для синхронизации");
      return;
    }
    if (!accessToken) {
      run.setLiveStatus("Войдите в аккаунт, чтобы скачать музыку");
      return;
    }
    setMusicBusy(true);
    try {
      const result = await downloadPlaylistTracksOffline(projectName, playlist, accessToken, {
        onProgress: (current, total, label) => {
          run.setLiveStatus(`Музыка ${current}/${total}: ${label}`);
        },
      });
      run.setLiveStatus(result.message);
    } catch (err) {
      run.setLiveStatus(String((err as Error)?.message ?? "Не удалось скачать музыку"));
    } finally {
      setMusicBusy(false);
    }
  }, [accessToken, playlist, projectName, run, trackCount]);

  const folderHint = folderLabel ?? "не выбрана";
  const hint = desktop
    ? folderLabel
      ? `Папка: ${folderLabel}`
      : "Electron: папка или синхронизация с сервером"
    : folderLabel
      ? `Папка: ${folderLabel}`
      : "Выберите папку с mp4/mp3";

  return (
    <div className="notes-run__offline-bar" role="region" aria-label="Офлайн-медиа">
      <div className="notes-run__offline-bar-text">
        <strong>Офлайн</strong>
        <span>
          {videoCount} видео, {holdCount} заставок, {trackCount} треков · {hint}
        </span>
      </div>
      <div className="notes-run__offline-bar-actions">
        <button
          type="button"
          className="notes-run__btn notes-run__btn--primary notes-run__offline-bar-btn"
          disabled={busy || musicBusy}
          onClick={() => void handlePickFolder()}
        >
          {busy ? "Загрузка…" : "Выбрать папку…"}
        </button>
        <button
          type="button"
          className="notes-run__btn notes-run__offline-bar-btn"
          disabled={busy || musicBusy}
          onClick={() => void handleReloadLocal()}
          title={folderHint}
        >
          {busy ? "…" : desktop ? "Обновить медиа" : "Подключить"}
        </button>
        {!desktop ? (
          <button
            type="button"
            className="notes-run__btn notes-run__offline-bar-btn"
            disabled={busy || musicBusy || trackCount === 0}
            onClick={() => void handleDownloadMusic()}
          >
            {musicBusy ? "Скачивание…" : "Скачать музыку"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
