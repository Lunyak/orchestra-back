import cn from "classnames";
import { useId, useState } from "react";
import { Modal } from "../../../core/modal/Modal";
import { SCRIPT_MODE_ITEMS } from "../../../../features/spectacle/ui/SpectacleScriptModeNav";
import type { ShowScriptMarkdownMode } from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import "./script-scene-chrome-menu.css";

const menuIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="4" x2="4" y1="21" y2="14" />
    <line x1="4" x2="4" y1="10" y2="3" />
    <line x1="12" x2="12" y1="21" y2="12" />
    <line x1="12" x2="12" y1="8" y2="3" />
    <line x1="20" x2="20" y1="21" y2="16" />
    <line x1="20" x2="20" y1="12" y2="3" />
    <line x1="2" x2="6" y1="14" y2="14" />
    <line x1="10" x2="14" y1="8" y2="8" />
    <line x1="18" x2="22" y1="16" y2="16" />
  </svg>
);

type ScriptSceneChromeMenuProps = {
  variant?: "title" | "menubar";
  markdownMode: ShowScriptMarkdownMode;
  onSetMarkdownMode: (mode: ShowScriptMarkdownMode) => void;
  isModeEditing: boolean;
  onToggleModeEditing: () => void;
  showEditToggle: boolean;
  annotationsMode: boolean;
  onToggleAnnotations: () => void;
  annotationsDisabled: boolean;
  showAnnotations: boolean;
  playOriginalMode: boolean;
  onTogglePlayOriginal: () => void;
  showPlayOriginal: boolean;
};

export function ScriptSceneChromeMenu({
  variant = "title",
  markdownMode,
  onSetMarkdownMode,
  isModeEditing,
  onToggleModeEditing,
  showEditToggle,
  annotationsMode,
  onToggleAnnotations,
  annotationsDisabled,
  showAnnotations,
  playOriginalMode,
  onTogglePlayOriginal,
  showPlayOriginal,
}: ScriptSceneChromeMenuProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const editToggleLabel = isModeEditing ? "Режим чтения" : "Режим редактирования";
  const annotationsLabel = annotationsMode ? "Скрыть метки" : "Показать метки";
  const playOriginalLabel = playOriginalMode
    ? "Отредактированный текст"
    : "Оригинальный текст";

  const showDisplaySection = showEditToggle || showAnnotations || showPlayOriginal;

  return (
    <>
      <button
        type="button"
        className={cn(
          "script-scene-chrome-menu__trigger",
          variant === "menubar" && "script-scene-chrome-menu__trigger--menubar",
        )}
        title="Настройки сцены"
        aria-label="Настройки сцены"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {menuIcon}
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        panelClassName="script-scene-chrome-menu__panel"
        ariaLabelledBy={titleId}
      >
        <div className="script-scene-chrome-menu">
          <h2 id={titleId} className="script-scene-chrome-menu__title">
            Сцена
          </h2>

          <section className="script-scene-chrome-menu__section">
            <h3 className="script-scene-chrome-menu__section-title">Режим</h3>
            <ul className="script-scene-chrome-menu__list">
              {SCRIPT_MODE_ITEMS.map(({ mode, label }) => {
                const isActive = markdownMode === mode;
                return (
                  <li key={mode}>
                    <button
                      type="button"
                      className={cn(
                        "script-scene-chrome-menu__item",
                        isActive && "script-scene-chrome-menu__item--active",
                      )}
                      aria-pressed={isActive}
                      onClick={() => onSetMarkdownMode(mode)}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {showDisplaySection ? (
            <section className="script-scene-chrome-menu__section">
              <h3 className="script-scene-chrome-menu__section-title">Отображение</h3>
              <ul className="script-scene-chrome-menu__list">
                {showEditToggle ? (
                  <li>
                    <button
                      type="button"
                      className={cn(
                        "script-scene-chrome-menu__item",
                        isModeEditing && "script-scene-chrome-menu__item--active",
                      )}
                      aria-pressed={isModeEditing}
                      onClick={onToggleModeEditing}
                    >
                      {editToggleLabel}
                    </button>
                  </li>
                ) : null}
                {showAnnotations ? (
                  <li>
                    <button
                      type="button"
                      className={cn(
                        "script-scene-chrome-menu__item",
                        annotationsMode && "script-scene-chrome-menu__item--active",
                      )}
                      aria-pressed={annotationsMode}
                      disabled={annotationsDisabled}
                      onClick={onToggleAnnotations}
                    >
                      {annotationsLabel}
                    </button>
                  </li>
                ) : null}
                {showPlayOriginal ? (
                  <li>
                    <button
                      type="button"
                      className={cn(
                        "script-scene-chrome-menu__item",
                        playOriginalMode && "script-scene-chrome-menu__item--active",
                      )}
                      aria-pressed={playOriginalMode}
                      onClick={onTogglePlayOriginal}
                    >
                      {playOriginalLabel}
                    </button>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
