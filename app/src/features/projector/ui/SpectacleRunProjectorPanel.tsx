import cn from "classnames";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useScene } from "../../scene";
import { useAppDispatch } from "../../../shared/store/hooks";
import {
  sceneActions,
  uploadSceneHoldImagesWeb,
  uploadSceneVideosWeb,
  type SceneHoldImage,
  type SceneVideo,
} from "../../scene/model/scene-slice";
import { useSpectacleRunContext } from "../../spectacle-run/model/spectacle-run-context";
import type { ProjectorMediaContext } from "../model/projector-media";
import { ProjectorMediaPreview } from "./ProjectorMediaPreview";
import "./spectacle-run-projector.css";

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
        className="spectacle-run-projector__rename-input"
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
      className="spectacle-run-projector__card-title"
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
  titleProps: Omit<ProjectorMediaTitleProps, "label" | "fallback" | "target">;
  onPrimary: () => void;
  onToggleMute?: () => void;
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
  titleProps,
  onPrimary,
  onToggleMute,
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
      className={cn("spectacle-run-projector__card")}
      data-active={isActive || undefined}
      data-kind={kind}
    >
      <div className="spectacle-run-projector__card-preview">
        <ProjectorMediaPreview
          ctx={projectorCtx}
          mode={kind === "hold" ? "hold" : "video"}
          videoId={kind === "video" ? id : null}
          holdId={kind === "hold" ? id : null}
          title={title}
          className="spectacle-run-projector__card-media"
        />
      </div>
      <div className="spectacle-run-projector__card-body">
        <ProjectorMediaTitle
          {...titleProps}
          label={title}
          fallback={kind === "hold" ? `Заставка ${id}` : `Видео ${id}`}
          target={renameTarget}
        />
        <div className="spectacle-run-projector__card-actions">
          <div className="spectacle-run-projector__card-actions-row">
            {showMuteControl ? (
              <button
                type="button"
                className="spectacle-run-projector__btn spectacle-run-projector__btn--mute"
                data-active={isMuted || undefined}
                onClick={onToggleMute}
                aria-label={isMuted ? "Включить звук" : "Выключить звук"}
                title={isMuted ? "Включить звук" : "Выключить звук"}
              >
                {isMuted ? "Без звука" : "Со звуком"}
              </button>
            ) : null}
            <button
              type="button"
              className="spectacle-run-projector__btn"
              data-active={isActive || isPaused || undefined}
              onClick={onPrimary}
            >
              {primaryText}
            </button>
          </div>
          <button
            type="button"
            className="spectacle-run-projector__btn spectacle-run-projector__btn--danger"
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

export function SpectacleRunProjectorPanel() {
  const run = useSpectacleRunContext();
  const { saveStepsForLightPlot, sceneData } = useScene();
  const dispatch = useAppDispatch();

  const projectorCtx = useMemo<ProjectorMediaContext>(
    () => ({
      projectSlug: run.projectName,
      videos: run.videos,
      holdImages: run.holdImages,
      projector: sceneData?.projector ?? null,
    }),
    [run.holdImages, run.projectName, run.videos, sceneData?.projector],
  );

  const [editingTarget, setEditingTarget] = useState<RenameTarget | null>(null);
  const [editingName, setEditingName] = useState("");
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

  useEffect(() => {
    if (!editingTarget) return;
    requestAnimationFrame(() => renameInputRef.current?.focus());
  }, [editingTarget]);

  const persistProjectorMedia = async () => {
    try {
      await saveStepsForLightPlot({ force: true });
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
      dispatch(sceneActions.updateSceneVideo({ id: target.id, changes: { title: nextTitle } }));
    } else {
      dispatch(sceneActions.updateSceneHoldImage({ id: target.id, changes: { title: nextTitle } }));
    }
    cancelRename();
    await persistProjectorMedia();
    run.setLiveStatus(`Переименовано: ${nextTitle}`);
  };

  const handleAddVideos = async (files: FileList | null) => {
    if (!files?.length || !run.projectName) return;
    try {
      await dispatch(
        uploadSceneVideosWeb({ projectSlug: run.projectName, files: [...files] }),
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
        uploadSceneHoldImagesWeb({ projectSlug: run.projectName, files: [...files] }),
      ).unwrap();
      await persistProjectorMedia();
      run.setLiveStatus(`Добавлено заставок: ${files.length}`);
    } catch (err) {
      run.setLiveStatus(String((err as Error)?.message ?? "Не удалось загрузить заставки"));
    }
    if (holdInputRef.current) holdInputRef.current.value = "";
  };

  const handleRemoveVideo = async (video: SceneVideo) => {
    const label = video.title?.trim() || `Видео ${video.id}`;
    if (!window.confirm(`Удалить ролик «${label}» из библиотеки проектора?`)) return;
    run.removeProjectorVideo(video.id);
    await persistProjectorMedia();
    run.setLiveStatus(`Удалено: ${label}`);
  };

  const handleRemoveHold = async (hold: SceneHoldImage) => {
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

  return (
    <section className="spectacle-run-projector" aria-label="Проектор">
      <div className="spectacle-run-projector__head">
        <span className="spectacle-run-projector__title">Проектор</span>
        <div className="spectacle-run-projector__toolbar">
          <button
            type="button"
            className="spectacle-run-projector__btn"
            data-active={run.isProjectorOpen || undefined}
            onClick={run.isProjectorOpen ? run.closeProjector : run.openProjector}
          >
            {run.isProjectorOpen ? "Закрыть окно" : "Открыть окно"}
          </button>
          <button
            type="button"
            className="spectacle-run-projector__btn"
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
            className="spectacle-run-projector__btn"
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
        </div>
        <span
          className={cn(
            "spectacle-run-projector__status",
            run.isProjectorOpen && "spectacle-run-projector__status--on",
          )}
        >
          {run.isProjectorOpen ? "выход открыт" : "выход закрыт"}
        </span>
      </div>

      <div className="spectacle-run-projector__tape-wrap">
        <div className="spectacle-run-projector__tape" role="list" aria-label="Медиа проектора">
          {!hasMedia ? (
            <p className="spectacle-run-projector__tape-empty">Добавьте видео или заставку</p>
          ) : null}
          {holdImages.map((hold: SceneHoldImage) => {
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
          })}
          {videos.map((video: SceneVideo) => {
            const isActive =
              playback.videoId === video.id && playback.playing && run.isProjectorOpen;
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
                titleProps={titleProps}
                onPrimary={() => run.toggleProjectorVideo(video.id)}
                onToggleMute={() => run.toggleProjectorVideoMute(video.id)}
                onDelete={() => void handleRemoveVideo(video)}
                primaryLabel="Пуск"
                activePrimaryLabel="Пауза"
                pausedPrimaryLabel="Продолжить"
              />
            );
          })}
        </div>
      </div>

      <div className="spectacle-run-projector__transport">
        <label className="spectacle-run-projector__slider-field">
          <span className="spectacle-run-projector__slider-label">
            Прогресс
            <span className="spectacle-run-projector__slider-value">
              {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
            </span>
          </span>
          <input
            className="spectacle-run-projector__slider"
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
        <label className="spectacle-run-projector__slider-field">
          <span className="spectacle-run-projector__slider-label">
            Громкость
            <span className="spectacle-run-projector__slider-value">{volumePercent}%</span>
          </span>
          <input
            className="spectacle-run-projector__slider"
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
      </div>
    </section>
  );
}
