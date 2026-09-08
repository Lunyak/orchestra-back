import { Modal } from "@shared/core/modal/Modal";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import cn from "classnames";
import { useEffect, useState } from "react";
import type { ScriptScene } from "../../../shared/types/script";
import type { DirectorSessionSlot } from "../directorSessionsSync";
import {
  directorSlotRefKey,
  formatSlotTime,
  isSlotScenePickerCustomSlug,
  SLOT_SCENE_PICKER_CUSTOM_SLUG,
} from "../model/session-page-utils";
import { SLOT_PROG_RUN_TITLE } from "../model/session-slot-planned";
import "./slot-scene-picker-modal.css";

export type SlotSceneListItem = {
  scene: ScriptScene;
  ok: boolean;
  missing: string[];
};

export type SlotScenePickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  projects: Array<{ slug: string; label: string }>;
  projectSlug: string;
  onProjectChange: (slug: string) => void;
  scenes: SlotSceneListItem[];
  scenesLoading: boolean;
  scenesError: string | null;
  availabilityError: string | null;
  selectedSceneId: number | null;
  isProgRunSelected?: boolean;
  currentSlotId: string;
  sessionStartsAt: string | null;
  slotsBySceneRefInSession: Map<string, DirectorSessionSlot[]>;
  onSelectScene: (scene: ScriptScene) => void;
  onSelectProgRun?: () => void;
  onClearProgRun?: () => void;
  initialCustomTitle?: string;
  onSelectCustom: (title: string) => void;
};

export function SlotScenePickerModal({
  isOpen,
  onClose,
  projects,
  projectSlug,
  onProjectChange,
  scenes,
  scenesLoading,
  scenesError,
  availabilityError,
  selectedSceneId,
  isProgRunSelected = false,
  currentSlotId,
  sessionStartsAt,
  slotsBySceneRefInSession,
  onSelectScene,
  onSelectProgRun,
  onClearProgRun,
  initialCustomTitle = "",
  onSelectCustom,
}: SlotScenePickerModalProps) {
  const [query, setQuery] = useState("");
  const [onlySelectable, setOnlySelectable] = useState(false);
  const [customTitleDraft, setCustomTitleDraft] = useState("");
  const isCustom = isSlotScenePickerCustomSlug(projectSlug);
  const canProgRun = Boolean(onSelectProgRun) && !isCustom;

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setOnlySelectable(false);
    setCustomTitleDraft(String(initialCustomTitle ?? "").trim());
  }, [isOpen, initialCustomTitle]);

  useEffect(() => {
    if (!isOpen || !isCustom) return;
    setCustomTitleDraft(String(initialCustomTitle ?? "").trim());
  }, [isOpen, isCustom, initialCustomTitle]);

  const needle = query.trim().toLowerCase();
  const filtered = scenes.filter((item) => {
    if (onlySelectable && !item.ok) return false;
    if (!needle) return true;
    const title = String(item.scene.title ?? "").trim().toLowerCase();
    return title.includes(needle) || String(item.scene.id).includes(needle);
  });

  const customTitleTrimmed = customTitleDraft.trim();
  const canApplyCustom = Boolean(customTitleTrimmed);
  const scenesCount = scenes.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="slot-scene-picker-modal"
      ariaLabelledBy="slot-scene-picker-title"
    >
      <header className="slot-scene-picker-modal__header">
        <h2 id="slot-scene-picker-title" className="slot-scene-picker-modal__title">
          {isCustom ? "Свой слот" : "Выбор сцены"}
        </h2>
        <button
          type="button"
          className="slot-scene-picker-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </header>

      <div className="slot-scene-picker-modal__toolbar">
        <label className="slot-scene-picker-modal__field">
          <span className="slot-scene-picker-modal__label">Проект</span>
          <select
            className="slot-scene-picker-modal__select"
            value={projectSlug}
            onChange={(event) => onProjectChange(event.target.value)}
          >
            <option value={SLOT_SCENE_PICKER_CUSTOM_SLUG}>Без проекта</option>
            {projects.map((project) => (
              <option key={project.slug} value={project.slug}>
                {project.label}
              </option>
            ))}
          </select>
        </label>
        {canProgRun ? (
          <div className="slot-scene-picker-modal__filter">
            <LabeledCheckbox
              checked={isProgRunSelected}
              onChange={(checked) => {
                if (checked) {
                  if (!onSelectProgRun) return;
                  onSelectProgRun();
                  onClose();
                  return;
                }
                onClearProgRun?.();
              }}
            >
              Прогон
            </LabeledCheckbox>
          </div>
        ) : null}
        {!isCustom ? (
          <>
            <label className="slot-scene-picker-modal__field slot-scene-picker-modal__field--grow">
              <span className="slot-scene-picker-modal__label">Поиск</span>
              <input
                type="search"
                className="slot-scene-picker-modal__search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Название или номер сцены…"
                aria-label="Поиск сцены"
              />
            </label>
            <div className="slot-scene-picker-modal__filter">
              <LabeledCheckbox
                checked={onlySelectable}
                onChange={setOnlySelectable}
              >
                по доступности актёров
              </LabeledCheckbox>
            </div>
          </>
        ) : (
          <label className="slot-scene-picker-modal__field slot-scene-picker-modal__field--grow">
            <span className="slot-scene-picker-modal__label">Название</span>
            <input
              type="text"
              className="slot-scene-picker-modal__search"
              value={customTitleDraft}
              onChange={(event) => setCustomTitleDraft(event.target.value)}
              placeholder="Разминка, обсуждение, примерка…"
              aria-label="Название слота"
            />
          </label>
        )}
      </div>

      <div className="slot-scene-picker-modal__body">
        {isCustom ? (
          <div className="slot-scene-picker-modal__custom">
            <p className="slot-scene-picker-modal__empty">
              Слот без привязки к проекту и сцене — только своё название.
            </p>
            <button
              type="button"
              className="slot-scene-picker-modal__apply"
              disabled={!canApplyCustom}
              onClick={() => {
                if (!canApplyCustom) return;
                onSelectCustom(customTitleTrimmed);
                onClose();
              }}
            >
              Применить
            </button>
          </div>
        ) : (
          <>
            {isProgRunSelected ? (
              <div className="slot-scene-picker-modal__prog-run">
                <p className="slot-scene-picker-modal__prog-run-title">
                  {SLOT_PROG_RUN_TITLE}
                </p>
                <p className="slot-scene-picker-modal__empty">
                  Все сцены проекта
                  {scenesCount > 0 ? ` (${scenesCount})` : ""}. Актёры — все, с
                  возможностью открепить в слоте. Снимите «Прогон» или выберите
                  сцену ниже.
                </p>
              </div>
            ) : null}
            {scenesLoading ? (
              <p className="slot-scene-picker-modal__empty">Загружаю сцены…</p>
            ) : null}
            {scenesError ? (
              <p className="slot-scene-picker-modal__error">{scenesError}</p>
            ) : null}
            {availabilityError ? (
              <p className="slot-scene-picker-modal__error">{availabilityError}</p>
            ) : null}

            {!scenesLoading && filtered.length === 0 ? (
              <p className="slot-scene-picker-modal__empty">
                Нет сцен (или сценарий не найден).
              </p>
            ) : null}

            <div className="slot-scene-picker-modal__list">
              {filtered.slice(0, 250).map((sceneData) => {
                const scene = sceneData.scene;
                const isSelected =
                  !isProgRunSelected && selectedSceneId === scene.id;
                const refKey = directorSlotRefKey(projectSlug, scene.id);
                const slotsWithSameRef =
                  slotsBySceneRefInSession.get(refKey) ?? [];
                const otherSlotsWithRef = slotsWithSameRef.filter(
                  (sl) => sl.id !== currentSlotId,
                );
                const bookedInOtherSlots = otherSlotsWithRef.length > 0;
                const otherSlotsTimesLabel =
                  bookedInOtherSlots && sessionStartsAt
                    ? [...otherSlotsWithRef]
                        .sort((a, b) => a.offsetMin - b.offsetMin)
                        .map((sl) =>
                          formatSlotTime(sessionStartsAt, sl.offsetMin),
                        )
                        .join(", ")
                    : "";
                const assignTitle =
                  bookedInOtherSlots && sessionStartsAt
                    ? `Назначить в этот слот. Уже в сессии: ${otherSlotsTimesLabel}`
                    : "Назначить в этот слот";

                return (
                  <button
                    key={`${projectSlug}:${scene.id}`}
                    type="button"
                    className={cn(
                      "session__scene-item",
                      "slot-scene-picker-modal__item",
                      isSelected && "session__scene-item--selected",
                      !isSelected && sceneData.ok && "session__scene-item--ok",
                      !isSelected && !sceneData.ok && "session__scene-item--bad",
                      bookedInOtherSlots &&
                        !isSelected &&
                        "session__scene-item--booked",
                    )}
                    onClick={() => {
                      onSelectScene(scene);
                      onClose();
                    }}
                    title={assignTitle}
                  >
                    <div className="session__scene-item__title">
                      <span className="session__scene-item__title-text">
                        #{scene.id} {scene.title || "\u00a0"}
                      </span>
                      {bookedInOtherSlots ? (
                        <span
                          className="session__scene-item__badge session__scene-item__badge--in-session"
                          aria-hidden
                        >
                          в сессии
                          {otherSlotsTimesLabel ? (
                            <span className="session__scene-item__badge-detail">
                              {" "}
                              · {otherSlotsTimesLabel}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "session__scene-item__missing",
                        !(
                          !sceneData.ok && sceneData.missing.length > 0
                        ) && "session__scene-item__missing--empty",
                      )}
                    >
                      {!sceneData.ok && sceneData.missing.length > 0 ? (
                        <>
                          не хватает:{" "}
                          <b>{sceneData.missing.slice(0, 6).join(", ")}</b>
                          {sceneData.missing.length > 6
                            ? ` +${sceneData.missing.length - 6}`
                            : ""}
                        </>
                      ) : (
                        "\u00a0"
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
