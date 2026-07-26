import { useCallback, useEffect, useRef, useState } from "react";
import cn from "classnames";
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
    <section className="project-media-source" aria-label="Источники медиа">
      <p className="project-media-source__lead">
        Все файлы проекта хранятся здесь. Суфлер, сценарий и проектор берут медиа из этой
        библиотеки — отдельно по проекту ничего качать не нужно.
      </p>

      <div className="project-media-source__cards">
        <article className="project-media-source__card">
          <h2 className="project-media-source__card-title">С сервера</h2>
          <p className="project-media-source__card-text">
            Подтянуть список и файлы из облака, если проект уже ведётся онлайн.
          </p>
          <button
            type="button"
            className="project-media-source__btn project-media-source__btn--primary"
            disabled={anyBusy}
            onClick={() => void handleSyncFromServer()}
          >
            {syncBusy ? "Синхронизация…" : "Синхронизировать"}
          </button>
        </article>

        <article className="project-media-source__card">
          <h2 className="project-media-source__card-title">Из папки</h2>
          <p className="project-media-source__card-text">
            Указать папку на диске (например на рабочем столе): mp4, mp3, jpg, script.json.
            Файлы читаются напрямую, без копирования в браузер.
          </p>
          <button
            type="button"
            className="project-media-source__btn project-media-source__btn--primary"
            disabled={anyBusy}
            onClick={() => void handleImportFromFolder()}
          >
            {folderBusy ? "Импорт…" : "Выбрать папку…"}
          </button>
        </article>

        <article className="project-media-source__card">
          <h2 className="project-media-source__card-title">Загрузить</h2>
          <p className="project-media-source__card-text">
            Добавить файлы с компьютера в библиотеку проекта (музыка, видео, заставки).
          </p>
          <button
            type="button"
            className="project-media-source__btn"
            disabled={anyBusy}
            onClick={() => uploadInputRef.current?.click()}
          >
            {uploadBusy ? "Загрузка…" : "Выбрать файлы…"}
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            hidden
            accept="audio/*,video/*,image/*"
            onChange={(e) => void handleUploadFiles(e.target.files)}
          />
        </article>
      </div>

      {folderLabel ? (
        <p className={cn("project-media-source__folder-badge")}>
          Локальная папка: <strong className="project-media-source__folder-label">{folderLabel}</strong>
        </p>
      ) : null}
    </section>
  );
}
