import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../../../shared/core/modal/Modal";
import type { SceneHoldImage, SceneVideo } from "../../scene/model/scene-slice";
import type { KadrProjectorCue } from "../../theater/model/kadr-projector";
import { ProjectorMediaPreview } from "../../projector/ui/ProjectorMediaPreview";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import type { NotesRunCardDraft } from "../model/notes-run-types";
import "../../spectacle-run/ui/create-kadr-modal.css";
import "./notes-run.css";

function parseProjectorSelectValue(value: string): KadrProjectorCue | null {
  if (!value || value === "none") return null;
  if (value === "hold") return { mode: "hold" };
  if (value.startsWith("hold:")) {
    const holdId = Math.trunc(Number(value.slice(5)) || 0);
    return holdId > 0 ? { mode: "hold", holdId } : { mode: "hold" };
  }
  const videoId = Math.trunc(Number(value) || 0);
  return videoId > 0 ? { mode: "video", videoId } : null;
}

function projectorSelectValue(cue: KadrProjectorCue | null): string {
  if (!cue) return "none";
  if (cue.mode === "hold") {
    return cue.holdId != null && cue.holdId > 0 ? `hold:${cue.holdId}` : "hold";
  }
  return String(cue.videoId);
}

export function NotesRunCardModal({
  isOpen,
  mode,
  initialDraft,
  cardNo,
  playlist,
  sounds,
  videos,
  holdImages,
  projectorCtx,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  mode: "create" | "edit";
  initialDraft: NotesRunCardDraft;
  cardNo: number;
  playlist: Array<{ id: number; title: string }>;
  sounds: Array<{ id: number; title: string }>;
  videos: SceneVideo[];
  holdImages: SceneHoldImage[];
  projectorCtx: ProjectorMediaContext;
  onClose: () => void;
  onSubmit: (draft: NotesRunCardDraft) => void;
}) {
  const wasOpenRef = useRef(false);
  const draftRef = useRef(initialDraft);
  const [draft, setDraft] = useState(initialDraft);
  draftRef.current = draft;

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;
    setDraft(initialDraft);
  }, [initialDraft, isOpen]);

  const title = mode === "edit" ? `Карточка ${cardNo}` : `Новая карточка ${cardNo}`;
  const projectorValue = projectorSelectValue(draft.projectorCue);
  const projectorPreviewMode = draft.projectorCue?.mode ?? null;
  const projectorPreviewVideoId =
    draft.projectorCue?.mode === "video" ? draft.projectorCue.videoId : null;
  const projectorPreviewHoldId =
    draft.projectorCue?.mode === "hold" ? (draft.projectorCue.holdId ?? null) : null;

  const updateLightLine = (index: number, field: "label" | "value", raw: string) => {
    setDraft((prev) => ({
      ...prev,
      lightLines: prev.lightLines.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: raw } : row,
      ),
    }));
  };

  const addLightLine = () => {
    setDraft((prev) => ({
      ...prev,
      lightLines: [...prev.lightLines, { label: "", value: "" }],
    }));
  };

  const removeLightLine = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      lightLines:
        prev.lightLines.length <= 1
          ? [{ label: "", value: "" }]
          : prev.lightLines.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const toggleSound = (soundId: number) => {
    setDraft((prev) => {
      const has = prev.soundIds.includes(soundId);
      return {
        ...prev,
        soundIds: has
          ? prev.soundIds.filter((id) => id !== soundId)
          : [...prev.soundIds, soundId],
      };
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} panelClassName="create-kadr-modal notes-run-modal" ariaLabel={title}>
      <header className="create-kadr-modal__head">
        <h2 className="create-kadr-modal__title">{title}</h2>
        <button type="button" className="create-kadr-modal__close" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="create-kadr-modal__body">
        <p className="notes-run-modal__hint">
          Свет записывается свободно — любые названия софитов/каналов и значения. Без привязки к 3D и пульту.
        </p>

        <label className="create-kadr-modal__field">
          <span className="create-kadr-modal__label">Название карточки</span>
          <input
            type="text"
            className="create-kadr-modal__input"
            value={draft.title}
            placeholder="Необязательно"
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          />
        </label>

        <label className="create-kadr-modal__field">
          <span className="create-kadr-modal__label">Шаг / сцена (метка)</span>
          <input
            type="text"
            className="create-kadr-modal__input"
            value={draft.stepLabel}
            placeholder="Например: Шаг 3 · Кухня"
            onChange={(e) => setDraft((prev) => ({ ...prev, stepLabel: e.target.value }))}
          />
        </label>

        <section className="create-kadr-modal__section">
          <h3 className="create-kadr-modal__section-title">Свет</h3>
          <div className="notes-run-modal__light-grid">
            {draft.lightLines.map((row, index) => (
              <div key={`line-${index}`} className="notes-run-modal__light-row">
                <input
                  type="text"
                  className="create-kadr-modal__input"
                  placeholder="Софит / канал / что угодно"
                  value={row.label}
                  onChange={(e) => updateLightLine(index, "label", e.target.value)}
                />
                <input
                  type="text"
                  className="create-kadr-modal__input"
                  placeholder="Значение: 80%, блекаут, П2…"
                  value={row.value}
                  onChange={(e) => updateLightLine(index, "value", e.target.value)}
                />
                <button
                  type="button"
                  className="notes-run-modal__line-remove"
                  onClick={() => removeLightLine(index)}
                  aria-label="Удалить строку"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="notes-run-modal__add-line" onClick={addLightLine}>
            + строка света
          </button>
          <label className="create-kadr-modal__field">
            <span className="create-kadr-modal__label">Доп. текст по свету</span>
            <textarea
              className="create-kadr-modal__textarea"
              rows={3}
              value={draft.lightNotes}
              placeholder="Если удобнее одним абзацем"
              onChange={(e) => setDraft((prev) => ({ ...prev, lightNotes: e.target.value }))}
            />
          </label>
        </section>

        <section className="create-kadr-modal__section">
          <h3 className="create-kadr-modal__section-title">Звук</h3>
          <label className="create-kadr-modal__field">
            <span className="create-kadr-modal__label">Музыка из плейлиста</span>
            <select
              className="create-kadr-modal__select"
              value={draft.playTrackId ?? ""}
              onChange={(e) => {
                const id = Math.trunc(Number(e.target.value) || 0);
                setDraft((prev) => ({ ...prev, playTrackId: id > 0 ? id : null }));
              }}
            >
              <option value="">— без музыки —</option>
              {playlist.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title?.trim() || `Трек ${track.id}`}
                </option>
              ))}
            </select>
          </label>
          {sounds.length > 0 ? (
            <div className="create-kadr-modal__checks">
              <span className="create-kadr-modal__label">Звуковые эффекты</span>
              <div className="create-kadr-modal__check-grid">
                {sounds.map((sound) => {
                  const checked = draft.soundIds.includes(sound.id);
                  return (
                    <label
                      key={sound.id}
                      className={cn("create-kadr-modal__check", checked && "create-kadr-modal__check--active")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSound(sound.id)}
                      />
                      <span>{sound.title?.trim() || `SFX ${sound.id}`}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <section className="create-kadr-modal__section">
          <h3 className="create-kadr-modal__section-title">Проектор</h3>
          <label className="create-kadr-modal__field">
            <span className="create-kadr-modal__label">Видео или заставка</span>
            <select
              className="create-kadr-modal__select"
              value={projectorValue}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  projectorCue: parseProjectorSelectValue(e.target.value),
                }))
              }
            >
              <option value="none">— без видео —</option>
              <option value="hold">Заставка по умолчанию</option>
              {holdImages.map((hold) => (
                <option key={`hold-${hold.id}`} value={`hold:${hold.id}`}>
                  Заставка: {hold.title?.trim() || hold.id}
                </option>
              ))}
              {videos.map((video) => (
                <option key={`video-${video.id}`} value={String(video.id)}>
                  Видео: {video.title?.trim() || video.id}
                </option>
              ))}
            </select>
          </label>
          {projectorPreviewMode ? (
            <ProjectorMediaPreview
              ctx={projectorCtx}
              mode={projectorPreviewMode}
              videoId={projectorPreviewVideoId}
              holdId={projectorPreviewHoldId}
              title=""
              className="create-kadr-modal__projector-preview"
            />
          ) : null}
        </section>

        <label className="create-kadr-modal__field">
          <span className="create-kadr-modal__label">Комментарий на карточке</span>
          <textarea
            className="create-kadr-modal__textarea"
            rows={2}
            value={draft.commentText}
            onChange={(e) => setDraft((prev) => ({ ...prev, commentText: e.target.value }))}
          />
        </label>

        <label className="create-kadr-modal__field">
          <span className="create-kadr-modal__label">Переход (внизу при прогоне)</span>
          <input
            type="text"
            className="create-kadr-modal__input"
            value={draft.transitionText}
            onChange={(e) => setDraft((prev) => ({ ...prev, transitionText: e.target.value }))}
          />
        </label>
      </div>

      <footer className="create-kadr-modal__foot">
        <button type="button" className="create-kadr-modal__btn" onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className="create-kadr-modal__btn create-kadr-modal__btn--primary"
          onClick={() => onSubmit(draftRef.current)}
        >
          Сохранить
        </button>
      </footer>
    </Modal>
  );
}
