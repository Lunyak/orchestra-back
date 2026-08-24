import cn from "classnames";
import { useId } from "react";
import { Modal } from "../../../shared/core/modal/Modal";
import type { ProgRunKadrStripLayout } from "../model/prog-run-prefs-storage";
import "./prog-run-strip-modes-modal.css";

const LAYOUT_OPTIONS: {
  id: ProgRunKadrStripLayout;
  label: string;
  hint: string;
}[] = [
  { id: "classic", label: "Лента", hint: "Классическая лента по сценам" },
  { id: "carousel", label: "Карусель", hint: "Карусель по сценам" },
  { id: "flow", label: "Поток", hint: "Сквозная карусель без сцен" },
  { id: "trio", label: "Тройка", hint: "Текущая и две соседние карточки" },
];

const DISPLAY_TOGGLES = [
  {
    key: "notesOverlay" as const,
    label: "Поверх",
    hint: "Свет внизу и трек вверху обложки",
  },
  {
    key: "plainCover" as const,
    label: "Без фото",
    hint: "Чёрный блок вместо обложки",
  },
  {
    key: "lightConsoleOpen" as const,
    label: "Пульт",
    hint: "Пульт в активной карточке, только просмотр",
  },
  {
    key: "wideLayout" as const,
    label: "На экран",
    hint: "Контент и шапка на всю ширину между доками",
  },
];

export type ProgRunStripModesState = {
  layout: ProgRunKadrStripLayout;
  notesOverlay: boolean;
  plainCover: boolean;
  lightConsoleOpen: boolean;
  wideLayout: boolean;
};

type ProgRunStripModesModalProps = {
  isOpen: boolean;
  modes: ProgRunStripModesState;
  onClose: () => void;
  onLayoutChange: (layout: ProgRunKadrStripLayout) => void;
  onToggleNotesOverlay: () => void;
  onTogglePlainCover: () => void;
  onToggleLightConsoleOpen: () => void;
  onToggleWideLayout: () => void;
};

export function ProgRunStripModesModal({
  isOpen,
  modes,
  onClose,
  onLayoutChange,
  onToggleNotesOverlay,
  onTogglePlainCover,
  onToggleLightConsoleOpen,
  onToggleWideLayout,
}: ProgRunStripModesModalProps) {
  const titleId = useId();

  const toggleByKey: Record<
    (typeof DISPLAY_TOGGLES)[number]["key"],
    () => void
  > = {
    notesOverlay: onToggleNotesOverlay,
    plainCover: onTogglePlainCover,
    lightConsoleOpen: onToggleLightConsoleOpen,
    wideLayout: onToggleWideLayout,
  };

  const pressedByKey: Record<(typeof DISPLAY_TOGGLES)[number]["key"], boolean> =
    {
      notesOverlay: modes.notesOverlay,
      plainCover: modes.plainCover,
      lightConsoleOpen: modes.lightConsoleOpen,
      wideLayout: modes.wideLayout,
    };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      lockScroll={false}
      panelClassName="prog-run-strip-modes-modal__panel"
      ariaLabelledBy={titleId}
    >
      <div className="prog-run-strip-modes-modal">
        <header className="prog-run-strip-modes-modal__header">
          <h2 id={titleId} className="prog-run-strip-modes-modal__title">
            Режимы ленты
          </h2>
        </header>

        <section className="prog-run-strip-modes-modal__section">
          <h3 className="prog-run-strip-modes-modal__section-title">Вид ленты</h3>
          <div
            className="prog-run-strip-modes-modal__layout"
            role="group"
            aria-label="Вид ленты"
          >
            {LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="prog-run-strip-modes-modal__layout-btn"
                aria-pressed={modes.layout === option.id}
                title={option.hint}
                onClick={() => onLayoutChange(option.id)}
              >
                <span className="prog-run-strip-modes-modal__layout-label">
                  {option.label}
                </span>
                <span className="prog-run-strip-modes-modal__layout-hint">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="prog-run-strip-modes-modal__section">
          <h3 className="prog-run-strip-modes-modal__section-title">
            Отображение карточки
          </h3>
          <div
            className="prog-run-strip-modes-modal__toggles"
            role="group"
            aria-label="Отображение карточки"
          >
            {DISPLAY_TOGGLES.map((toggle) => (
              <button
                key={toggle.key}
                type="button"
                className="prog-run-strip-modes-modal__toggle-btn"
                aria-pressed={pressedByKey[toggle.key]}
                title={toggle.hint}
                onClick={toggleByKey[toggle.key]}
              >
                {toggle.label}
              </button>
            ))}
          </div>
        </section>

        <footer className="prog-run-strip-modes-modal__actions">
          <button
            type="button"
            className={cn(
              "prog-run-strip-modes-modal__btn",
              "prog-run-strip-modes-modal__btn--primary",
            )}
            onClick={onClose}
          >
            Готово
          </button>
        </footer>
      </div>
    </Modal>
  );
}

export function ProgRunStripModesButton({
  modes,
  onClick,
}: {
  modes: ProgRunStripModesState;
  onClick: () => void;
}) {
  const hasCustomModes =
    modes.layout !== "carousel" ||
    !modes.notesOverlay ||
    modes.plainCover ||
    !modes.lightConsoleOpen ||
    modes.wideLayout;

  return (
    <button
      type="button"
      className="spectacle-run__add-kadr-btn spectacle-run__prog-run-modes-btn"
      aria-pressed={hasCustomModes}
      title="Режимы ленты и отображения карточки"
      aria-label="Режимы ленты"
      onClick={onClick}
    >
      Режимы
    </button>
  );
}
