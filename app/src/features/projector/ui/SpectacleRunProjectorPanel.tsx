import { useEffect, useRef, useState, type RefObject } from "react";
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
import "./spectacle-run-projector.css";

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
  renameInputRef: RefObject<HTMLInputElement | null>;
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
      className="spectacle-run-projector__video-title"
      title={`${display} — двойной клик, чтобы переименовать`}
      onDoubleClick={() => onStartRename(target, display)}
    >
      {display}
    </span>
  );
}

export function SpectacleRunProjectorPanel() {
  const run = useSpectacleRunContext();
  const { saveStepsForLightPlot } = useScene();
  const dispatch = useAppDispatch();

  const [editingTarget, setEditingTarget] = useState<RenameTarget | null>(null);
  const [editingName, setEditingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

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

  const videos = run.videos;
  const holdImages = run.holdImages;

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
      run.setLiveStatus(`Добавлено видео: ${files.length}. Нажмите ▶ у ролика для проверки`);
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
      run.setLiveStatus(`Добавлено заставок: ${files.length}. Нажмите ▶ у картинки для проверки`);
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

  const draftSelectValue =
    run.projectorDraft.mode === "hold"
      ? run.projectorDraft.holdId != null
        ? `hold:${run.projectorDraft.holdId}`
        : "hold"
      : String(run.projectorDraft.videoId);

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

  return (
    <section className="spectacle-run-projector" aria-label="Проектор">
      <div className="spectacle-run-projector__head">
        <span className="spectacle-run-projector__title">Проектор</span>
        <span
          className={[
            "spectacle-run-projector__status",
            run.isProjectorOpen ? "spectacle-run-projector__status--on" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {run.isProjectorOpen ? "выход открыт" : "выход закрыт"}
        </span>
      </div>

      <p className="spectacle-run-projector__hint">
        <strong>Как смотреть:</strong> у ролика или заставки — <strong>▶ Показать</strong> (откроется
        окно для зала). На втором мониторе — F11. <strong>Двойной клик по названию</strong> —
        переименовать. Для спектакля — «Записать в картину», потом ◀ ▶ в ленте.
      </p>

      <div className="spectacle-run-projector__actions">
        <button
          type="button"
          className="spectacle-run__add-kadr-btn"
          onClick={run.isProjectorOpen ? run.closeProjector : run.openProjector}
        >
          {run.isProjectorOpen ? "Закрыть окно" : "Открыть окно"}
        </button>

        <button
          type="button"
          className="spectacle-run__add-kadr-btn"
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
          className="spectacle-run__add-kadr-btn"
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

      {holdImages.length > 0 ? (
        <ul className="spectacle-run-projector__videos" aria-label="Заставки проектора">
          {holdImages.map((hold: SceneHoldImage) => {
            const isActive =
              run.projectorPlayback.mode === "hold" &&
              run.projectorPlayback.holdId === hold.id &&
              run.isProjectorOpen;
            return (
              <li key={hold.id} className="spectacle-run-projector__video-item">
                <ProjectorMediaTitle
                  {...titleProps}
                  label={hold.title}
                  fallback={`Заставка ${hold.id}`}
                  target={{ kind: "hold", id: hold.id }}
                />
                <div className="spectacle-run-projector__item-actions">
                  <button
                    type="button"
                    className="spectacle-run-projector__play-btn"
                    data-primary={isActive ? true : undefined}
                    onClick={() => run.showProjectorHold(hold.id)}
                    title="Показать заставку на окне проектора"
                  >
                    {isActive ? "● Показана" : "▶ Показать"}
                  </button>
                  <button
                    type="button"
                    className="spectacle-run-projector__delete-btn"
                    onClick={() => void handleRemoveHold(hold)}
                    title="Удалить заставку"
                    aria-label={`Удалить заставку ${hold.title?.trim() || hold.id}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {videos.length > 0 ? (
        <ul className="spectacle-run-projector__videos" aria-label="Загруженные ролики">
          {videos.map((video: SceneVideo) => {
            const isActive =
              run.projectorPlayback.videoId === video.id &&
              run.projectorPlayback.playing;
            const isPausedSame =
              run.projectorPlayback.videoId === video.id &&
              !run.projectorPlayback.playing &&
              run.isProjectorOpen;
            const isMuted = run.isProjectorVideoMuted(video.id);
            return (
              <li key={video.id} className="spectacle-run-projector__video-item">
                <ProjectorMediaTitle
                  {...titleProps}
                  label={video.title}
                  fallback={`Видео ${video.id}`}
                  target={{ kind: "video", id: video.id }}
                />
                <div className="spectacle-run-projector__item-actions">
                  <button
                    type="button"
                    className="spectacle-run-projector__mute-btn"
                    data-muted={isMuted ? true : undefined}
                    onClick={() => run.toggleProjectorVideoMute(video.id)}
                    title={isMuted ? "Включить звук на проекторе" : "Выключить звук на проекторе"}
                    aria-label={isMuted ? "Включить звук" : "Выключить звук"}
                  >
                    {isMuted ? "🔇" : "🔊"}
                  </button>
                  <button
                    type="button"
                    className="spectacle-run-projector__play-btn"
                    data-primary={isActive ? undefined : true}
                    data-paused={isPausedSame ? true : undefined}
                    onClick={() => run.toggleProjectorVideo(video.id)}
                    title={
                      isActive
                        ? "Пауза на проекторе"
                        : isPausedSame
                          ? "Продолжить на проекторе"
                          : "Запустить на окне проектора"
                    }
                  >
                    {isActive ? "⏸ Пауза" : isPausedSame ? "▶ Продолжить" : "▶ Пуск"}
                  </button>
                  <button
                    type="button"
                    className="spectacle-run-projector__delete-btn"
                    onClick={() => void handleRemoveVideo(video)}
                    title="Удалить ролик"
                    aria-label={`Удалить ролик ${video.title?.trim() || video.id}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="spectacle-run-projector__cue">
        <span className="spectacle-run-projector__cue-label">В картину репетиции:</span>
        <select
          id="spectacle-projector-cue"
          className="spectacle-run-projector__select"
          value={draftSelectValue}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "hold") {
              run.setProjectorDraft({ mode: "hold" });
              return;
            }
            if (val.startsWith("hold:")) {
              const id = Math.trunc(Number(val.slice(5)));
              if (id > 0) run.setProjectorDraft({ mode: "hold", holdId: id });
              return;
            }
            const id = Math.trunc(Number(val));
            if (id > 0) run.setProjectorDraft({ mode: "video", videoId: id });
          }}
        >
          {holdImages.length > 0 ? (
            <>
              <option value="hold">Заставка (по умолчанию)</option>
              {holdImages.map((hold: SceneHoldImage) => (
                <option key={hold.id} value={`hold:${hold.id}`}>
                  {hold.title?.trim() || `Заставка ${hold.id}`}
                </option>
              ))}
            </>
          ) : (
            <option value="hold">Заставка</option>
          )}
          {videos.map((video: SceneVideo) => (
            <option key={video.id} value={String(video.id)}>
              {video.title?.trim() || `Видео ${video.id}`}
            </option>
          ))}
        </select>

        {run.canRecordProjector ? (
          <button
            type="button"
            className="spectacle-run__add-kadr-btn"
            onClick={run.recordProjectorToCurrentKadr}
            title="Сохранить в тех. карту текущей картины"
          >
            Записать в картину
          </button>
        ) : null}

        {run.canPreviewProjector ? (
          <button
            type="button"
            className="spectacle-run__add-kadr-btn"
            onClick={run.previewProjectorDraft}
            title="Показать выбранное в списке «В картину»"
          >
            ▶ Показать выбранное
          </button>
        ) : null}
      </div>
    </section>
  );
}
