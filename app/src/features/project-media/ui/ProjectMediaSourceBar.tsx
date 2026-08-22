import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/model/auth-context";
import { usePlaybook } from "../../playbook";
import { useProject } from "../../project/model/project-context";
import { hydratePlaybookFromLocalPack } from "../../playbook/model/playbook-local-hydration";
import {
  uploadPlaybookHoldImagesWeb,
  uploadPlaybookVideosWeb,
  uploadScenePlaylistWeb,
} from "../../playbook/model/playbook-slice";
import { useAppDispatch } from "../../../shared/store/hooks";
import {
  getProjectMediaFolderInfo,
  pickProjectMediaFolder,
} from "../../../shared/platform/project-media-folder";

const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".mkv"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac"]);

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function splitUploadFiles(files: FileList): {
  videos: File[];
  images: File[];
  audio: File[];
  skipped: number;
} {
  const videos: File[] = [];
  const images: File[] = [];
  const audio: File[] = [];
  let skipped = 0;
  for (const file of files) {
    const ext = fileExt(file.name);
    if (VIDEO_EXT.has(ext)) videos.push(file);
    else if (IMAGE_EXT.has(ext)) images.push(file);
    else if (AUDIO_EXT.has(ext)) audio.push(file);
    else skipped += 1;
  }
  return { videos, images, audio, skipped };
}

type ProjectMediaSourceBarProps = {
  onStatus?: (message: string) => void;
  onLibraryChanged?: () => void | Promise<void>;
};

export function ProjectMediaSourceBar({
  onStatus,
  onLibraryChanged,
}: ProjectMediaSourceBarProps) {
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const { accessToken } = useAuth();
  const { syncFromServer, importDevMediaFolder, saveScenesForLightPlot } = usePlaybook();
  const [syncBusy, setSyncBusy] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [folderLabel, setFolderLabel] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const setStatus = useCallback(
    (message: string) => {
      onStatus?.(message);
    },
    [onStatus],
  );

  useEffect(() => {
    if (!projectName) {
      setFolderLabel(null);
      return;
    }
    void getProjectMediaFolderInfo(projectName).then((info) => {
      setFolderLabel(info.label);
    });
  }, [projectName]);

  const handleSyncFromServer = useCallback(async () => {
    if (!projectName) {
      setStatus("Выберите проект");
      return;
    }
    if (!accessToken) {
      setStatus("Войдите в аккаунт для синхронизации");
      return;
    }
    setSyncBusy(true);
    try {
      setStatus("Синхронизация с сервером…");
      await syncFromServer(accessToken, projectName);
      await onLibraryChanged?.();
      setStatus("Библиотека обновлена с сервера");
    } catch (err) {
      setStatus(String((err as Error)?.message ?? "Ошибка синхронизации"));
    } finally {
      setSyncBusy(false);
    }
  }, [accessToken, onLibraryChanged, projectName, setStatus, syncFromServer]);

  const handleImportFromFolder = useCallback(async () => {
    if (!projectName) {
      setStatus("Выберите проект");
      return;
    }
    setFolderBusy(true);
    try {
      setStatus("Выберите папку на диске (рабочий стол, флешка…)…");
      const picked = await pickProjectMediaFolder(projectName);
      if (!picked.ok) {
        setStatus(picked.error ?? "Папка не выбрана");
        return;
      }
      await hydratePlaybookFromLocalPack(projectName, dispatch);
      const imported = await importDevMediaFolder({ scanned: picked, pickIfMissing: false });
      await onLibraryChanged?.();
      setFolderLabel(picked.folderName ?? picked.mediaRoot?.replace(/^.*[/\\]/, "") ?? null);
      setStatus(imported.message);
    } catch (err) {
      setStatus(String((err as Error)?.message ?? "Ошибка импорта"));
    } finally {
      setFolderBusy(false);
    }
  }, [dispatch, importDevMediaFolder, onLibraryChanged, projectName, setStatus]);

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !projectName) return;
      const { videos, images, audio, skipped } = splitUploadFiles(files);
      if (videos.length === 0 && images.length === 0 && audio.length === 0) {
        setStatus("Нет подходящих файлов (mp3, mp4, jpg…)");
        return;
      }
      setUploadBusy(true);
      try {
        const parts: string[] = [];
        if (audio.length > 0) {
          await dispatch(
            uploadScenePlaylistWeb({ projectSlug: projectName, files: audio }),
          ).unwrap();
          parts.push(`${audio.length} треков`);
        }
        if (videos.length > 0) {
          await dispatch(
            uploadPlaybookVideosWeb({ projectSlug: projectName, files: videos }),
          ).unwrap();
          parts.push(`${videos.length} видео`);
        }
        if (images.length > 0) {
          await dispatch(
            uploadPlaybookHoldImagesWeb({ projectSlug: projectName, files: images }),
          ).unwrap();
          parts.push(`${images.length} заставок`);
        }
        await saveScenesForLightPlot({ force: true });
        await onLibraryChanged?.();
        const skippedNote = skipped > 0 ? `, пропущено ${skipped}` : "";
        setStatus(`Загружено: ${parts.join(", ")}${skippedNote}`);
      } catch (err) {
        setStatus(String((err as Error)?.message ?? "Не удалось загрузить"));
      } finally {
        setUploadBusy(false);
        if (uploadInputRef.current) uploadInputRef.current.value = "";
      }
    },
    [dispatch, onLibraryChanged, projectName, saveScenesForLightPlot, setStatus],
  );

  const anyBusy = syncBusy || folderBusy || uploadBusy;

  return (
    <section className="project-media-source" aria-label="Хранилище проекта">
      <div className="project-media-source__row">
        <span className="project-media-source__label">Хранилище</span>
        <div className="project-media-source__actions">
          <button
            type="button"
            className="project-media-source__btn project-media-source__btn--primary"
            disabled={anyBusy}
            onClick={() => void handleSyncFromServer()}
          >
            {syncBusy ? "Синхронизация…" : "С сервера"}
          </button>
          <button
            type="button"
            className="project-media-source__btn project-media-source__btn--primary"
            disabled={anyBusy}
            onClick={() => void handleImportFromFolder()}
          >
            {folderBusy ? "Импорт…" : "Из папки"}
          </button>
          <button
            type="button"
            className="project-media-source__btn"
            disabled={anyBusy}
            onClick={() => uploadInputRef.current?.click()}
          >
            {uploadBusy ? "Загрузка…" : "Файлы…"}
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            hidden
            accept="audio/*,video/*,image/*"
            onChange={(e) => void handleUploadFiles(e.target.files)}
          />
        </div>
        {folderLabel ? (
          <span className="project-media-source__folder-badge">
            Папка:{" "}
            <strong className="project-media-source__folder-label">
              {folderLabel}
            </strong>
          </span>
        ) : null}
      </div>
    </section>
  );
}
