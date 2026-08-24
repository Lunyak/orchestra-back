import cn from "classnames";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { usePlaybook } from "../../playbook";
import { useAppDispatch } from "../../../shared/store/hooks";
import {
  playbookActions,
  uploadPlaybookHoldImagesWeb,
  uploadPlaybookVideosWeb,
  type PlaybookHoldImage,
  type PlaybookVideo,
} from "../../playbook/model/playbook-slice";
import { useSpectacleRunContext } from "../../spectacle-run/model/spectacle-run-context";
import type { ProjectorMediaContext } from "../model/projector-media";
import { normalizeProjectorTransitionMs } from "../model/projector-video-preview";
import { ProjectorMediaPreview } from "./ProjectorMediaPreview";
import { VideoPreviewFrameModal } from "./VideoPreviewFrameModal";
import { DownloadProjectorMediaButton } from "../../../shared/components/offline/DownloadProjectorMediaButton";
import "@shared/components/media-projector/media-projector.css";

type RenameTarget = { kind: "video" | "hold"; id: number };

function renameKey(target: RenameTarget): string {
  return `${target.kind}:${target.id}`;
}

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
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

type ProjectorTapeCardProps = {
  kind: "hold" | "video";
  id: number;
  title: string;
  isActive: boolean;
  isPaused?: boolean;
  isMuted?: boolean;
  projectorCtx: ProjectorMediaContext;
  previewTimeSec?: number | null;
  titleProps: Omit<ProjectorMediaTitleProps, "label" | "fallback" | "target">;
  onPrimary: () => void;
  onToggleMute?: () => void;
  onPickPreviewFrame?: () => void;
  onDelete: () => void;
  primaryLabel: string;
  activePrimaryLabel: string;
  pausedPrimaryLabel?: string;
};

function ProjectorTapeCard({
  kind,
  id,
  title,
  isActive,
  isPaused = false,
  isMuted = false,
  projectorCtx,
  previewTimeSec = null,
  titleProps,
  onPrimary,
  onToggleMute,
  onPickPreviewFrame,
  onDelete,
  primaryLabel,
  activePrimaryLabel,
  pausedPrimaryLabel,
}: ProjectorTapeCardProps) {
  const primaryText = isActive ? activePrimaryLabel : isPaused ? (pausedPrimaryLabel ?? primaryLabel) : primaryLabel;
  const renameTarget: RenameTarget = { kind, id };
  const showMuteControl = kind === "video" && onToggleMute != null;

  return (
    <article
      className={cn("media-projector__card")}
      data-active={isActive || undefined}
      data-kind={kind}
    >
      <div className="media-projector__card-preview">
        <ProjectorMediaPreview
          ctx={projectorCtx}
          mode={kind === "hold" ? "hold" : "video"}
          videoId={kind === "video" ? id : null}
          holdId={kind === "hold" ? id : null}
          title={title}
          previewTimeSec={previewTimeSec}
          className="media-projector__card-media"
        />
      </div>
      <div className="media-projector__card-body">
        <ProjectorMediaTitle
          {...titleProps}
          label={title}
          fallback={kind === "hold" ? `Заставка ${id}` : `Видео ${id}`}
          target={renameTarget}
        />
        <div className="media-projector__card-actions">
          <div className="media-projector__card-actions-row">
            {showMuteControl ? (
              <button
                type="button"
                className="media-projector__btn media-projector__btn--mute"
                data-active={isMuted || undefined}
                onClick={onToggleMute}
                aria-label={isMuted ? "Включить звук" : "Выключить звук"}
                title={isMuted ? "Включить звук" : "Выключить звук"}
              >
                {isMuted ? "Без звука" : "Со звуком"}
              </button>
            ) : null}
            {kind === "video" && onPickPreviewFrame ? (
              <button
                type="button"
                className="media-projector__btn"
                onClick={onPickPreviewFrame}
                title="Выбрать кадр для превью в ленте"
              >
                Кадр
              </button>
            ) : null}
            <button
              type="button"
              className="media-projector__btn"
              data-active={isActive || isPaused || undefined}
              onClick={onPrimary}
            >
              {primaryText}
            </button>
          </div>
          <button
            type="button"
            className="media-projector__btn media-projector__btn--danger"
            onClick={onDelete}
            aria-label={`Удалить ${title}`}
          >
            Удалить
          </button>
        </div>
      </div>
    </article>
  );
}

export type SpectacleRunProjectorPanelMode = "full" | "video" | "projector";

export function SpectacleRunProjectorPanel({
  mode = "full",
}: {
  mode?: SpectacleRunProjectorPanelMode;
}) {
  const run = useSpectacleRunContext();
  const { saveScenesForLightPlot, playbookData } = usePlaybook();
  const dispatch = useAppDispatch();
  const showVideo = mode === "full" || mode === "video";
  const showProjector = mode === "full" || mode === "projector";
  const panelTitle =
    mode === "video" ? "Видео" : mode === "projector" ? "Проектор" : "Проектор";

  const projectorCtx = useMemo<ProjectorMediaContext>(
    () => ({
      projectSlug: run.projectName,
      videos: run.videos,
      holdImages: run.holdImages,
      projector: playbookData?.projector ?? null,
    }),
    [run.holdImages, run.projectName, run.videos, playbookData?.projector],
  );

  const [editingTarget, setEditingTarget] = useState<RenameTarget | null>(null);
  const [editingName, setEditingName] = useState("");
  const [previewFrameVideoId, setPreviewFrameVideoId] = useState<number | null>(
    null,
  );
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const videos = run.videos;
  const holdImages = run.holdImages;
  const playback = run.projectorPlayback;
  const activeVideoId = playback.mode === "video" ? playback.videoId : null;
  const transportEnabled = run.isProjectorOpen && activeVideoId != null;
  const duration = transportEnabled ? Math.max(0, playback.duration) : 0;
  const currentTime = transportEnabled ? Math.max(0, Math.min(duration, playback.currentTime)) : 0;
  const volumePercent = transportEnabled
    ? Math.round(Math.max(0, Math.min(1, playback.volume)) * 100)
    : activeVideoId != null
      ? Math.round(run.resolveProjectorVideoVolume(activeVideoId) * 100)
      : 100;
  const transitionMs = normalizeProjectorTransitionMs(
    playbookData?.projector?.transitionMs,
  );
  const previewFrameVideo =
    previewFrameVideoId != null
      ? videos.find((video) => Number(video.id) === previewFrameVideoId) ?? null
      : null;

  useEffect(() => {
    if (!editingTarget) return;
    requestAnimationFrame(() => renameInputRef.current?.focus());
  }, [editingTarget]);

  const persistProjectorMedia = async () => {
    try {
      await saveScenesForLightPlot({ force: true });
    } catch (err) {
      run.setLiveStatus(String((err as Error)?.message ?? "Не удалось сохранить медиа в сцену"));
    }
  };

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const holdInputRef = useRef<HTMLInputElement | null>(null);

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
    run.setLiveStatus(`Переименовано: ${nextTitle}`);
  };

  const handleAddVideos = async (files: FileList | null) => {
    if (!files?.length || !run.projectName) return;
    try {
      await dispatch(
        uploadPlaybookVideosWeb({ projectSlug: run.projectName, files: [...files] }),
      ).unwrap();
      await persistProjectorMedia();
      run.setLiveStatus(`Добавлено видео: ${files.length}`);
    } catch (err) {
      run.setLiveStatus(String((err as Error)?.message ?? "Не удалось загрузить видео"));
    }
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleAddHoldImages = async (files: FileList | null) => {
    if (!files?.length || !run.projectName) return;
    try {
      await dispatch(
        uploadPlaybookHoldImagesWeb({ projectSlug: run.projectName, files: [...files] }),
      ).unwrap();
      await persistProjectorMedia();
      run.setLiveStatus(`Добавлено заставок: ${files.length}`);
    } catch (err) {
      run.setLiveStatus(String((err as Error)?.message ?? "Не удалось загрузить заставки"));
    }
    if (holdInputRef.current) holdInputRef.current.value = "";
  };

  const handleRemoveVideo = async (video: PlaybookVideo) => {
    const label = video.title?.trim() || `Видео ${video.id}`;
    if (!window.confirm(`Удалить ролик «${label}» из библиотеки проектора?`)) return;
    run.removeProjectorVideo(video.id);
    await persistProjectorMedia();
    run.setLiveStatus(`Удалено: ${label}`);
  };

  const handleRemoveHold = async (hold: PlaybookHoldImage) => {
    const label = hold.title?.trim() || `Заставка ${hold.id}`;
    if (!window.confirm(`Удалить заставку «${label}»?`)) return;
    run.removeProjectorHold(hold.id);
    await persistProjectorMedia();
    run.setLiveStatus(`Удалено: ${label}`);
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

  const handleSeek = (raw: string) => {
    if (!transportEnabled) return;
    run.seekProjectorVideoTime(Number(raw));
  };

  const handleVolume = (raw: string) => {
    if (activeVideoId == null) return;
    run.setProjectorVideoVolumeLevel(activeVideoId, Number(raw) / 100);
  };

  const handleTransitionMs = (raw: string, persist = false) => {
    const nextMs = normalizeProjectorTransitionMs(Number(raw));
    dispatch(
      playbookActions.setProjectorSettings({
        v: 1,
        ...(playbookData?.projector ?? {}),
        transitionMs: nextMs,
      }),
    );
    if (!persist) return;
    void persistProjectorMedia();
    run.setLiveStatus(
      nextMs > 0
        ? `Переход проектора: ${nextMs} мс`
        : "Переход проектора: жёсткий cut",
    );
  };

  const handleSavePreviewFrame = async (previewTimeSec: number) => {
    if (previewFrameVideoId == null) return;
    dispatch(
      playbookActions.updatePlaybookVideo({
        id: previewFrameVideoId,
        changes: { previewTimeSec },
      }),
    );
    await persistProjectorMedia();
    run.setLiveStatus(`Кадр превью: ${formatPlaybackTime(previewTimeSec)}`);
    setPreviewFrameVideoId(null);
  };

  const videoEmpty = videos.length === 0;
  const holdEmpty = holdImages.length === 0;
  const tapeEmpty =
    mode === "video" ? videoEmpty : mode === "projector" ? holdEmpty : !hasMedia;

  return (
    <section className="media-projector" aria-label={panelTitle}>
      <div className="media-projector__header">
        <span className="media-projector__title">{panelTitle}</span>
        <div className="media-projector__toolbar">
          {showProjector ? (
            <button
              type="button"
              className="media-projector__btn"
              data-active={run.isProjectorOpen || undefined}
              onClick={run.isProjectorOpen ? run.closeProjector : run.openProjector}
            >
              {run.isProjectorOpen ? "Закрыть окно" : "Открыть окно"}
            </button>
          ) : null}
          {showVideo ? (
            <>
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
            </>
          ) : null}
          {showProjector ? (
            <>
              <button
                type="button"
                className="media-projector__btn"
                onClick={() => holdInputRef.current?.click()}
                title="Картинки между роликами и после конца видео"
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
            </>
          ) : null}
          <DownloadProjectorMediaButton
            buttonClassName="media-projector__btn"
            onStatus={(message) => run.setLiveStatus(message)}
          />
        </div>
        {showProjector ? (
          <span
            className={cn(
              "media-projector__status",
              run.isProjectorOpen && "media-projector__status--on",
            )}
          >
            {run.isProjectorOpen ? "выход открыт" : "выход закрыт"}
          </span>
        ) : null}
      </div>

      <div className="media-projector__tape-container">
        <div
          className="media-projector__tape"
          role="list"
          aria-label={mode === "video" ? "Видео" : "Медиа проектора"}
        >
          {tapeEmpty ? (
            <p className="media-projector__tape-empty">
              {mode === "video"
                ? "Добавьте видео"
                : mode === "projector"
                  ? "Добавьте заставку"
                  : "Добавьте видео или заставку"}
            </p>
          ) : null}
          {showProjector
            ? holdImages.map((hold: PlaybookHoldImage) => {
                const isActive =
                  playback.mode === "hold" &&
                  playback.holdId === hold.id &&
                  run.isProjectorOpen;
                const holdTitle = hold.title?.trim() || `Заставка ${hold.id}`;
                return (
                  <ProjectorTapeCard
                    key={`hold-${hold.id}`}
                    kind="hold"
                    id={hold.id}
                    title={holdTitle}
                    isActive={isActive}
                    projectorCtx={projectorCtx}
                    titleProps={titleProps}
                    onPrimary={() => run.showProjectorHold(hold.id)}
                    onDelete={() => void handleRemoveHold(hold)}
                    primaryLabel="Показать"
                    activePrimaryLabel="На экране"
                  />
                );
              })
            : null}
          {showVideo
            ? videos.map((video: PlaybookVideo) => {
                const isActive =
                  playback.videoId === video.id &&
                  playback.playing &&
                  run.isProjectorOpen;
                const isPausedSame =
                  playback.videoId === video.id &&
                  !playback.playing &&
                  run.isProjectorOpen &&
                  playback.mode === "video";
                const videoTitle = video.title?.trim() || `Видео ${video.id}`;
                const isMuted = run.isProjectorVideoMuted(video.id);
                return (
                  <ProjectorTapeCard
                    key={`video-${video.id}`}
                    kind="video"
                    id={video.id}
                    title={videoTitle}
                    isActive={isActive}
                    isPaused={isPausedSame}
                    isMuted={isMuted}
                    projectorCtx={projectorCtx}
                    previewTimeSec={video.previewTimeSec}
                    titleProps={titleProps}
                    onPrimary={() => run.toggleProjectorVideo(video.id)}
                    onToggleMute={() => run.toggleProjectorVideoMute(video.id)}
                    onPickPreviewFrame={() => setPreviewFrameVideoId(video.id)}
                    onDelete={() => void handleRemoveVideo(video)}
                    primaryLabel="Пуск"
                    activePrimaryLabel="Пауза"
                    pausedPrimaryLabel="Продолжить"
                  />
                );
              })
            : null}
        </div>
      </div>

      {showProjector || showVideo ? (
        <div className="media-projector__transport">
          <label className="media-projector__slider-field">
            <span className="media-projector__slider-label">
              Прогресс
              <span className="media-projector__slider-value">
                {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
              </span>
            </span>
            <input
              className="media-projector__slider"
              type="range"
              min={0}
              max={duration > 0 ? duration : 1}
              step={0.1}
              value={currentTime}
              disabled={!transportEnabled || duration <= 0}
              onChange={(e) => handleSeek(e.target.value)}
              aria-label="Прогресс видео"
            />
          </label>
          <label className="media-projector__slider-field">
            <span className="media-projector__slider-label">
              Громкость
              <span className="media-projector__slider-value">{volumePercent}%</span>
            </span>
            <input
              className="media-projector__slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={volumePercent}
              disabled={activeVideoId == null}
              onChange={(e) => handleVolume(e.target.value)}
              aria-label="Громкость видео"
            />
          </label>
          <label className="media-projector__slider-field">
            <span className="media-projector__slider-label">
              Переход шагов
              <span className="media-projector__slider-value">
                {transitionMs > 0 ? `${transitionMs} мс` : "cut"}
              </span>
            </span>
            <input
              className="media-projector__slider"
              type="range"
              min={0}
              max={1500}
              step={50}
              value={transitionMs}
              onChange={(e) => handleTransitionMs(e.target.value)}
              onMouseUp={(e) =>
                handleTransitionMs(
                  (e.target as HTMLInputElement).value,
                  true,
                )
              }
              onTouchEnd={(e) =>
                handleTransitionMs(
                  (e.target as HTMLInputElement).value,
                  true,
                )
              }
              aria-label="Плавность перехода между шагами на проекторе"
              title="0 — жёсткий cut, больше — мягче fade через чёрный"
            />
          </label>
        </div>
      ) : null}

      {previewFrameVideo ? (
        <VideoPreviewFrameModal
          isOpen
          onClose={() => setPreviewFrameVideoId(null)}
          ctx={projectorCtx}
          videoId={previewFrameVideo.id}
          title={previewFrameVideo.title?.trim() || `Видео ${previewFrameVideo.id}`}
          initialPreviewTimeSec={previewFrameVideo.previewTimeSec}
          onConfirm={(previewTimeSec) => {
            void handleSavePreviewFrame(previewTimeSec);
          }}
        />
      ) : null}
    </section>
  );
}
