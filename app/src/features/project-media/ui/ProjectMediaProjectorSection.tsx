import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { usePlaybook } from "../../playbook";
import { useProject } from "../../project/model/project-context";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  playbookActions,
  uploadPlaybookHoldImagesWeb,
  uploadPlaybookVideosWeb,
  type PlaybookHoldImage,
  type PlaybookVideo,
} from "../../playbook/model/playbook-slice";
import { normalizeHoldImages } from "../../projector/model/playbook-projector-persist";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import { ProjectorMediaPreview } from "../../projector/ui/ProjectorMediaPreview";
import { DownloadProjectorMediaButton } from "../../../shared/components/offline/DownloadProjectorMediaButton";
import "@shared/components/media-projector/media-projector.css";

type RenameTarget = { kind: "video" | "hold"; id: number };

function renameKey(target: RenameTarget): string {
  return `${target.kind}:${target.id}`;
}

type ProjectorMediaTitleProps = {
  label: string;
  fallback: string;
  target: RenameTarget;
  editingKey: string | null;
  editingName: string;
  onStartRename: (target: RenameTarget, currentTitle: string) => void;
  onEditingNameChange: (value: string) => void;
  onApplyRename: (target: RenameTarget) => void;
  onCancelRename: () => void;
  renameInputRef: RefObject<HTMLInputElement>;
};

function ProjectorMediaTitle({
  label,
  fallback,
  target,
  editingKey,
  editingName,
  onStartRename,
  onEditingNameChange,
  onApplyRename,
  onCancelRename,
  renameInputRef,
}: ProjectorMediaTitleProps) {
  const isEditing = editingKey === renameKey(target);
  const display = label.trim() || fallback;

  if (isEditing) {
    return (
      <input
        ref={renameInputRef}
        className="media-projector__rename-input"
        value={editingName}
        onChange={(e) => onEditingNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void onApplyRename(target);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancelRename();
          }
        }}
        onBlur={() => void onApplyRename(target)}
        aria-label="Переименовать"
      />
    );
  }

  return (
    <span
      className="media-projector__card-title"
      title={`${display} — двойной клик, чтобы переименовать`}
      onDoubleClick={() => onStartRename(target, display)}
    >
      {display}
    </span>
  );
}

type ProjectMediaProjectorSectionProps = {
  onStatus?: (message: string) => void;
};

export function ProjectMediaProjectorSection({ onStatus }: ProjectMediaProjectorSectionProps) {
  const { projectName } = useProject();
  const { saveScenesForLightPlot, playbookData } = usePlaybook();
  const dispatch = useAppDispatch();
  const videos = useAppSelector((s) => s.playbook.playbookData?.videos ?? []);
  const holdImages = useMemo(
    () =>
      normalizeHoldImages(
        playbookData?.holdImages,
        playbookData?.projector ?? undefined,
      ),
    [playbookData?.holdImages, playbookData?.projector],
  );

  const projectorCtx = useMemo<ProjectorMediaContext>(
    () => ({
      projectSlug: projectName ?? "",
      videos,
      holdImages,
      projector: playbookData?.projector ?? null,
    }),
    [holdImages, playbookData?.projector, projectName, videos],
  );

  const [editingTarget, setEditingTarget] = useState<RenameTarget | null>(null);
  const [editingName, setEditingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const holdInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingTarget) return;
    requestAnimationFrame(() => renameInputRef.current?.focus());
  }, [editingTarget]);

  const setStatus = (message: string) => {
    onStatus?.(message);
  };

  const persistProjectorMedia = async () => {
    try {
      await saveScenesForLightPlot({ force: true });
    } catch (err) {
      setStatus(String((err as Error)?.message ?? "Не удалось сохранить медиа"));
    }
  };

  const startRename = (target: RenameTarget, currentTitle: string) => {
    setEditingTarget(target);
    setEditingName(currentTitle);
  };

  const cancelRename = () => {
    setEditingTarget(null);
    setEditingName("");
  };

  const applyRename = async (target: RenameTarget) => {
    const nextTitle = editingName.trim();
    if (!nextTitle) {
      cancelRename();
      return;
    }
    const prevTitle =
      target.kind === "video"
        ? videos.find((v) => v.id === target.id)?.title?.trim()
        : holdImages.find((h) => h.id === target.id)?.title?.trim();
    if (prevTitle === nextTitle) {
      cancelRename();
      return;
    }

    if (target.kind === "video") {
      dispatch(playbookActions.updatePlaybookVideo({ id: target.id, changes: { title: nextTitle } }));
    } else {
      dispatch(playbookActions.updatePlaybookHoldImage({ id: target.id, changes: { title: nextTitle } }));
    }
    cancelRename();
    await persistProjectorMedia();
    setStatus(`Переименовано: ${nextTitle}`);
  };

  const handleAddVideos = async (files: FileList | null) => {
    if (!files?.length || !projectName) return;
    try {
      await dispatch(
        uploadPlaybookVideosWeb({ projectSlug: projectName, files: [...files] }),
      ).unwrap();
      await persistProjectorMedia();
      setStatus(`Добавлено видео: ${files.length}`);
    } catch (err) {
      setStatus(String((err as Error)?.message ?? "Не удалось загрузить видео"));
    }
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleAddHoldImages = async (files: FileList | null) => {
    if (!files?.length || !projectName) return;
    try {
      await dispatch(
        uploadPlaybookHoldImagesWeb({ projectSlug: projectName, files: [...files] }),
      ).unwrap();
      await persistProjectorMedia();
      setStatus(`Добавлено заставок: ${files.length}`);
    } catch (err) {
      setStatus(String((err as Error)?.message ?? "Не удалось загрузить заставки"));
    }
    if (holdInputRef.current) holdInputRef.current.value = "";
  };

  const handleRemoveVideo = async (video: PlaybookVideo) => {
    const label = video.title?.trim() || `Видео ${video.id}`;
    if (!window.confirm(`Удалить ролик «${label}»?`)) return;
    dispatch(playbookActions.removePlaybookVideo(video.id));
    await persistProjectorMedia();
    setStatus(`Удалено: ${label}`);
  };

  const handleRemoveHold = async (hold: PlaybookHoldImage) => {
    const label = hold.title?.trim() || `Заставка ${hold.id}`;
    if (!window.confirm(`Удалить заставку «${label}»?`)) return;
    dispatch(playbookActions.removePlaybookHoldImage(hold.id));
    await persistProjectorMedia();
    setStatus(`Удалено: ${label}`);
  };

  const editingKey = editingTarget ? renameKey(editingTarget) : null;
  const titleProps = {
    editingKey,
    editingName,
    onStartRename: startRename,
    onEditingNameChange: setEditingName,
    onApplyRename: applyRename,
    onCancelRename: cancelRename,
    renameInputRef,
  };

  const hasMedia = holdImages.length > 0 || videos.length > 0;

  return (
    <section className="media-projector project-media-projector" aria-label="Видео и заставки">
      <div className="media-projector__header">
        <span className="media-projector__title">Проектор</span>
        <div className="media-projector__toolbar">
          <button
            type="button"
            className="media-projector__btn"
            onClick={() => videoInputRef.current?.click()}
          >
            + Видео
          </button>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            multiple
            hidden
            onChange={(e) => void handleAddVideos(e.target.files)}
          />
          <button
            type="button"
            className="media-projector__btn"
            onClick={() => holdInputRef.current?.click()}
          >
            + Заставка
          </button>
          <input
            ref={holdInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void handleAddHoldImages(e.target.files)}
          />
          <DownloadProjectorMediaButton
            buttonClassName="media-projector__btn"
            onStatus={setStatus}
          />
        </div>
      </div>

      <div className="media-projector__tape-container">
        <div className="media-projector__tape" role="list" aria-label="Медиа проектора">
          {!hasMedia ? (
            <p className="media-projector__tape-empty">Добавьте видео или заставку</p>
          ) : null}
          {holdImages.map((hold) => {
            const holdTitle = hold.title?.trim() || `Заставка ${hold.id}`;
            return (
              <article
                key={`hold-${hold.id}`}
                className="media-projector__card"
                data-kind="hold"
              >
                <div className="media-projector__card-preview">
                  <ProjectorMediaPreview
                    ctx={projectorCtx}
                    mode="hold"
                    holdId={hold.id}
                    title={holdTitle}
                    className="media-projector__card-media"
                  />
                </div>
                <div className="media-projector__card-body">
                  <ProjectorMediaTitle
                    {...titleProps}
                    label={holdTitle}
                    fallback={`Заставка ${hold.id}`}
                    target={{ kind: "hold", id: hold.id }}
                  />
                  <div className="media-projector__card-actions">
                    <button
                      type="button"
                      className="media-projector__btn media-projector__btn--danger"
                      onClick={() => void handleRemoveHold(hold)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {videos.map((video) => {
            const videoTitle = video.title?.trim() || `Видео ${video.id}`;
            return (
              <article
                key={`video-${video.id}`}
                className="media-projector__card"
                data-kind="video"
              >
                <div className="media-projector__card-preview">
                  <ProjectorMediaPreview
                    ctx={projectorCtx}
                    mode="video"
                    videoId={video.id}
                    title={videoTitle}
                    className="media-projector__card-media"
                  />
                </div>
                <div className="media-projector__card-body">
                  <ProjectorMediaTitle
                    {...titleProps}
                    label={videoTitle}
                    fallback={`Видео ${video.id}`}
                    target={{ kind: "video", id: video.id }}
                  />
                  <div className="media-projector__card-actions">
                    <button
                      type="button"
                      className="media-projector__btn media-projector__btn--danger"
                      onClick={() => void handleRemoveVideo(video)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
