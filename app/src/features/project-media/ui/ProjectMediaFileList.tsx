import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/model/auth-context";
import { usePlaybook } from "../../playbook";
import {
  uploadPlaybookHoldImagesWeb,
  uploadPlaybookVideosWeb,
  uploadScenePlaylistWeb,
  uploadSceneSoundsWeb,
} from "../../playbook/model/playbook-slice";
import { useProject } from "../../project/model/project-context";
import { resolveOfflineMediaUrl } from "../../../shared/platform/media-url";
import { useAppDispatch } from "../../../shared/store/hooks";
import type { PlaylistTrack } from "../../../shared/types/playlist";
import { api } from "../../../sync/api/client";
import { probeFileSizeBytes } from "../../../sync/api/files";
import type {
  PlaybookHoldImage,
  PlaybookVideo,
  SceneSound,
} from "../../playbook/model/playbook-types";
import "./project-media-file-list.css";

export type MediaFileKind = "music" | "sound" | "video" | "hold";

export type MediaFileListItem = {
  id: string;
  kind: MediaFileKind;
  title: string;
  file: string;
  extension: string;
  remoteKey: string;
  remoteUrl: string;
  filePath: string;
};

const KIND_LABEL: Record<MediaFileKind, string> = {
  music: "Музыка",
  sound: "Звук",
  video: "Видео",
  hold: "Заставка",
};

const MEDIA_URL_KIND: Record<
  MediaFileKind,
  "playlist" | "sound" | "video" | "image"
> = {
  music: "playlist",
  sound: "sound",
  video: "video",
  hold: "image",
};

function basenameFromPath(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  const parts = withoutQuery.split(/[/\\]/);
  return parts[parts.length - 1] ?? withoutQuery;
}

function extensionFromFile(file: string, title: string): string {
  const fromFile = basenameFromPath(file);
  const fromTitle = basenameFromPath(title);
  const candidate = fromFile || fromTitle;
  const dotIndex = candidate.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === candidate.length - 1) return "—";
  return candidate.slice(dotIndex + 1).toLowerCase();
}

function displayTitle(title: string, file: string): string {
  const named = String(title ?? "").trim();
  if (named) return named;
  const base = basenameFromPath(file);
  if (!base) return "Без названия";
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex > 0) return base.slice(0, dotIndex);
  return base;
}

function downloadFileName(item: MediaFileListItem): string {
  const fromFile = basenameFromPath(item.file);
  if (fromFile && fromFile.includes(".")) return fromFile;
  const fromPath = basenameFromPath(item.filePath);
  if (fromPath && fromPath.includes(".")) return fromPath;
  const safeTitle = item.title.trim() || "file";
  const ext = item.extension !== "—" ? item.extension : "";
  return ext ? `${safeTitle}.${ext}` : safeTitle;
}

function toListItem(
  kind: MediaFileKind,
  id: number,
  title: string,
  file: string,
  remoteKey?: string | null,
  remoteUrl?: string | null,
  filePath?: string | null,
): MediaFileListItem {
  return {
    id: `${kind}:${id}`,
    kind,
    title: displayTitle(title, file),
    file,
    extension: extensionFromFile(file, title),
    remoteKey: String(remoteKey ?? "").trim(),
    remoteUrl: String(remoteUrl ?? "").trim(),
    filePath: String(filePath ?? "").trim(),
  };
}

function mapPlaylist(tracks: PlaylistTrack[]): MediaFileListItem[] {
  return tracks.map((track) =>
    toListItem(
      "music",
      track.id,
      track.title,
      String(track.file ?? track.filePath ?? track.remoteUrl ?? ""),
      track.remoteKey,
      track.remoteUrl,
      track.filePath,
    ),
  );
}

function mapSounds(sounds: SceneSound[]): MediaFileListItem[] {
  return sounds.map((sound) =>
    toListItem(
      "sound",
      sound.id,
      sound.title,
      String(sound.file ?? sound.filePath ?? sound.remoteUrl ?? ""),
      sound.remoteKey,
      sound.remoteUrl,
      sound.filePath,
    ),
  );
}

function mapVideos(videos: PlaybookVideo[]): MediaFileListItem[] {
  return videos.map((video) =>
    toListItem(
      "video",
      video.id,
      video.title,
      String(video.file ?? video.filePath ?? video.remoteUrl ?? ""),
      video.remoteKey,
      video.remoteUrl,
      video.filePath,
    ),
  );
}

function mapHolds(holds: PlaybookHoldImage[]): MediaFileListItem[] {
  return holds.map((hold) =>
    toListItem(
      "hold",
      hold.id,
      hold.title,
      String(hold.file ?? hold.filePath ?? hold.remoteUrl ?? ""),
      hold.remoteKey,
      hold.remoteUrl,
      hold.filePath,
    ),
  );
}

function formatIndex(index: number, total: number): string {
  const digits = Math.max(String(total).length, 1);
  return String(index).padStart(digits, "0");
}

export function formatFileSizeKb(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 10) return `${kb.toFixed(1)} КБ`;
  return `${Math.round(kb)} КБ`;
}

function resolveProbeUrl(projectSlug: string, item: MediaFileListItem): string {
  if (/^https?:\/\//i.test(item.remoteUrl)) return item.remoteUrl;
  const fileName =
    basenameFromPath(item.file) || basenameFromPath(item.filePath);
  return resolveOfflineMediaUrl({
    projectSlug,
    kind: MEDIA_URL_KIND[item.kind],
    fileName,
    filePath: item.filePath || null,
    remoteUrl: item.remoteUrl || null,
    titleHint: item.title,
  });
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

async function downloadMediaFile(args: {
  accessToken: string | null;
  projectSlug: string;
  item: MediaFileListItem;
}): Promise<void> {
  const fileName = downloadFileName(args.item);
  let blob: Blob | null = null;

  if (args.item.remoteKey && args.accessToken) {
    const { data } = await api.get<Blob>("/files/stream", {
      params: { key: args.item.remoteKey },
      responseType: "blob",
      headers: { Authorization: `Bearer ${args.accessToken}` },
    });
    blob = data;
  } else {
    const url = resolveProbeUrl(args.projectSlug, args.item);
    if (!url) throw new Error("Нет ссылки на файл");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Не удалось скачать файл (${response.status})`);
    }
    blob = await response.blob();
  }

  if (!blob || blob.size === 0) {
    throw new Error("Файл пустой или недоступен");
  }
  triggerBrowserDownload(blob, fileName);
}

function useMediaSizes(items: MediaFileListItem[], projectName: string | null) {
  const { accessToken } = useAuth();
  const [sizeById, setSizeById] = useState<Record<string, number | null>>({});
  const itemsSignature = items
    .map(
      (item) =>
        `${item.id}|${item.remoteKey}|${item.remoteUrl}|${item.filePath}|${item.file}`,
    )
    .join(";");

  useEffect(() => {
    let cancelled = false;
    if (!projectName || items.length === 0) {
      setSizeById({});
      return;
    }

    const snapshot = items;
    const run = async () => {
      const next: Record<string, number | null> = {};
      await Promise.all(
        snapshot.map(async (item) => {
          const url = resolveProbeUrl(projectName, item);
          const bytes = await probeFileSizeBytes({
            accessToken,
            remoteKey: item.remoteKey || null,
            url,
          });
          next[item.id] = bytes;
        }),
      );
      if (!cancelled) setSizeById(next);
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, itemsSignature, projectName]);

  return sizeById;
}

type MediaTabId = "playlist" | "sounds" | "video";

const MEDIA_TABS: Array<{ id: MediaTabId; label: string }> = [
  { id: "playlist", label: "Плейлист" },
  { id: "sounds", label: "Звуки" },
  { id: "video", label: "Видео" },
];

type MediaSectionProps = {
  hint: string;
  items: MediaFileListItem[];
  sizeById: Record<string, number | null>;
  showKind?: boolean;
  addLabel: string;
  accept: string;
  busy: boolean;
  downloadingId: string | null;
  onPickFiles: (files: File[]) => void;
  onDownload: (item: MediaFileListItem) => void;
};

function MediaSection({
  hint,
  items,
  sizeById,
  showKind = false,
  addLabel,
  accept,
  busy,
  downloadingId,
  onPickFiles,
  onDownload,
}: MediaSectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const total = items.length;
  const isEmpty = total === 0;

  return (
    <section className="project-media-file-section">
      <header className="project-media-file-section__header">
        <p className="project-media-file-section__hint">{hint}</p>
        <div className="project-media-file-section__actions">
          <input
            ref={inputRef}
            type="file"
            className="project-media-file-section__input"
            accept={accept}
            multiple
            onChange={(event) => {
              const list = event.target.files
                ? Array.from(event.target.files)
                : [];
              if (list.length > 0) onPickFiles(list);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Загрузка…" : addLabel}
          </Button>
        </div>
      </header>

      {isEmpty ? (
        <p className="project-media-file-list__empty">Пока пусто — добавьте файл.</p>
      ) : (
        <div
          className={cn(
            "project-media-file-list__table",
            showKind && "project-media-file-list__table--with-kind",
          )}
        >
          <div className="project-media-file-list__head" aria-hidden>
            <span className="project-media-file-list__col-index">№</span>
            <span className="project-media-file-list__col-ext">Тип</span>
            <span className="project-media-file-list__col-name">Файл</span>
            <span className="project-media-file-list__col-action"> </span>
          </div>
          <ul className="project-media-file-list__rows">
            {items.map((item, index) => {
              const indexLabel = formatIndex(index + 1, total);
              const bytes = sizeById[item.id];
              const sizeKnown = typeof bytes === "number";
              const sizePending = !(item.id in sizeById);
              const sizeLabel = sizeKnown
                ? formatFileSizeKb(bytes)
                : sizePending
                  ? "…"
                  : "—";
              const isDownloading = downloadingId === item.id;
              return (
                <li key={item.id} className="project-media-file-list__row">
                  <span className="project-media-file-list__col-index">
                    {indexLabel}
                  </span>
                  <span
                    className={cn(
                      "project-media-file-list__ext",
                      item.kind === "music" &&
                        "project-media-file-list__ext--music",
                      item.kind === "sound" &&
                        "project-media-file-list__ext--sound",
                      item.kind === "video" &&
                        "project-media-file-list__ext--video",
                      item.kind === "hold" &&
                        "project-media-file-list__ext--hold",
                    )}
                    title={item.file || undefined}
                  >
                    {item.extension}
                  </span>
                  <span
                    className="project-media-file-list__col-name"
                    title={item.file || item.title}
                  >
                    <span className="project-media-file-list__name">
                      {item.title}
                    </span>
                    <span
                      className={cn(
                        "project-media-file-list__size",
                        sizeKnown && "project-media-file-list__size--known",
                      )}
                      title={
                        sizeKnown ? `${bytes} байт` : "Размер пока неизвестен"
                      }
                    >
                      {sizeLabel}
                    </span>
                    {showKind ? (
                      <span className="project-media-file-list__kind">
                        {KIND_LABEL[item.kind]}
                      </span>
                    ) : null}
                  </span>
                  <span className="project-media-file-list__col-action">
                    <button
                      type="button"
                      className="project-media-file-list__download"
                      disabled={Boolean(downloadingId)}
                      title="Скачать файл"
                      aria-label={`Скачать «${item.title}»`}
                      onClick={() => onDownload(item)}
                    >
                      {isDownloading ? "…" : "Скачать"}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

type ProjectMediaFileListProps = {
  playlist?: PlaylistTrack[] | null;
  sounds?: SceneSound[] | null;
  videos?: PlaybookVideo[] | null;
  holdImages?: PlaybookHoldImage[] | null;
  onStatus?: (message: string) => void;
  className?: string;
};

export function ProjectMediaFileList({
  playlist,
  sounds,
  videos,
  holdImages,
  onStatus,
  className,
}: ProjectMediaFileListProps) {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const { saveScenesForLightPlot, pushPlaybookAfterSoundsSave } = usePlaybook();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaTabId>("playlist");

  const musicItems = mapPlaylist(playlist ?? []);
  const soundItems = mapSounds(sounds ?? []);
  const videoItems = [...mapVideos(videos ?? []), ...mapHolds(holdImages ?? [])];
  const allItems = [...musicItems, ...soundItems, ...videoItems];
  const sizeById = useMediaSizes(allItems, projectName);

  const setStatus = (message: string) => {
    onStatus?.(message);
  };

  const handleDownload = async (item: MediaFileListItem) => {
    if (!projectName || downloadingId) return;
    setDownloadingId(item.id);
    try {
      await downloadMediaFile({
        accessToken,
        projectSlug: projectName,
        item,
      });
      setStatus(`Скачан: ${downloadFileName(item)}`);
    } catch (err) {
      setStatus(String((err as Error)?.message ?? "Не удалось скачать файл"));
    } finally {
      setDownloadingId(null);
    }
  };

  const uploadMusic = async (files: File[]) => {
    if (!projectName || files.length === 0) return;
    setBusyKey("music");
    try {
      await dispatch(
        uploadScenePlaylistWeb({ projectSlug: projectName, files }),
      ).unwrap();
      setStatus(`В плейлист добавлено: ${files.length}`);
    } catch (err) {
      setStatus(String((err as Error)?.message ?? "Не удалось добавить в плейлист"));
    } finally {
      setBusyKey(null);
    }
  };

  const uploadSounds = async (files: File[]) => {
    if (!projectName || files.length === 0) return;
    setBusyKey("sound");
    try {
      await dispatch(
        uploadSceneSoundsWeb({ projectSlug: projectName, files }),
      ).unwrap();
      await pushPlaybookAfterSoundsSave();
      setStatus(`Звуков добавлено: ${files.length}`);
    } catch (err) {
      setStatus(String((err as Error)?.message ?? "Не удалось добавить звуки"));
    } finally {
      setBusyKey(null);
    }
  };

  const uploadVideoMaterials = async (files: File[]) => {
    if (!projectName || files.length === 0) return;
    setBusyKey("video");
    const videoFiles: File[] = [];
    const imageFiles: File[] = [];
    for (const file of files) {
      const name = file.name.toLowerCase();
      if (/\.(mp4|webm|mov|mkv)$/i.test(name) || file.type.startsWith("video/")) {
        videoFiles.push(file);
      } else if (
        /\.(jpe?g|png|gif|webp)$/i.test(name) ||
        file.type.startsWith("image/")
      ) {
        imageFiles.push(file);
      }
    }
    try {
      if (videoFiles.length > 0) {
        await dispatch(
          uploadPlaybookVideosWeb({
            projectSlug: projectName,
            files: videoFiles,
          }),
        ).unwrap();
      }
      if (imageFiles.length > 0) {
        await dispatch(
          uploadPlaybookHoldImagesWeb({
            projectSlug: projectName,
            files: imageFiles,
          }),
        ).unwrap();
      }
      if (videoFiles.length === 0 && imageFiles.length === 0) {
        setStatus("Выберите видео или изображение");
        return;
      }
      await saveScenesForLightPlot({ force: true });
      setStatus(
        `Видеоматериалов добавлено: ${videoFiles.length + imageFiles.length}`,
      );
    } catch (err) {
      setStatus(
        String((err as Error)?.message ?? "Не удалось добавить видеоматериалы"),
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className={cn("project-media-file-list", className)}>
      <div
        className="project-media-tabs"
        role="tablist"
        aria-label="Разделы медиа"
      >
        {MEDIA_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count =
            tab.id === "playlist"
              ? musicItems.length
              : tab.id === "sounds"
                ? soundItems.length
                : tab.id === "video"
                  ? videoItems.length
                  : null;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn(
                "project-media-tabs__btn",
                isActive && "project-media-tabs__btn--active",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {count != null ? (
                <span className="project-media-tabs__count">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="project-media-tabs__panel" role="tabpanel">
        {activeTab === "playlist" ? (
          <MediaSection
            hint="Музыка для прогона и сценария."
            items={musicItems}
            sizeById={sizeById}
            addLabel="Добавить"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
            busy={busyKey === "music"}
            downloadingId={downloadingId}
            onDownload={(item) => {
              void handleDownload(item);
            }}
            onPickFiles={(files) => {
              void uploadMusic(files);
            }}
          />
        ) : null}
        {activeTab === "sounds" ? (
          <MediaSection
            hint="Короткие эффекты для сценария."
            items={soundItems}
            sizeById={sizeById}
            addLabel="Добавить"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
            busy={busyKey === "sound"}
            downloadingId={downloadingId}
            onDownload={(item) => {
              void handleDownload(item);
            }}
            onPickFiles={(files) => {
              void uploadSounds(files);
            }}
          />
        ) : null}
        {activeTab === "video" ? (
          <MediaSection
            hint="Видео и заставки для проектора."
            items={videoItems}
            sizeById={sizeById}
            showKind
            addLabel="Добавить"
            accept="video/*,image/*,.mp4,.webm,.mov,.mkv,.jpg,.jpeg,.png,.gif,.webp"
            busy={busyKey === "video"}
            downloadingId={downloadingId}
            onDownload={(item) => {
              void handleDownload(item);
            }}
            onPickFiles={(files) => {
              void uploadVideoMaterials(files);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
