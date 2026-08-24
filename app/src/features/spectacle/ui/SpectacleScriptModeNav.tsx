import cn from "classnames";
import { useId, useState } from "react";
import { Modal } from "../../../shared/core/modal/Modal";
import { useProject } from "../../project";
import {
  showScriptMarkdownActions,
  type ShowScriptMarkdownMode,
  selectShowScriptMarkdownUi,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import "./spectacle-script-mode-nav-modal.css";

export const SCRIPT_SCENE_NAME = "script";

export const SCRIPT_MODE_ITEMS: ReadonlyArray<{
  mode: ShowScriptMarkdownMode;
  label: string;
}> = [
  { mode: "play", label: "Текст" },
  { mode: "explication", label: "Экспликация" },
  { mode: "comments", label: "Комментарии" },
];

type SpectacleScriptModeNavProps = {
  variant?: "bar" | "corner";
};

export function SpectacleScriptModeNav({
  variant = "bar",
}: SpectacleScriptModeNavProps) {
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const [modalOpen, setModalOpen] = useState(false);
  const titleId = useId();

  const markdownMode = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME)
          .markdownMode
      : "play",
  );

  const activeLabel =
    SCRIPT_MODE_ITEMS.find((item) => item.mode === markdownMode)?.label ??
    "Текст";

  const handleSelectMode = (mode: ShowScriptMarkdownMode) => {
    if (!projectName) return;

    try {
      localStorage.setItem(
        `showScript:markdownMode:${projectName}:${SCRIPT_SCENE_NAME}`,
        mode,
      );
    } catch {
      // ignore
    }

    dispatch(
      showScriptMarkdownActions.setMarkdownMode({
        projectSlug: projectName,
        sceneName: SCRIPT_SCENE_NAME,
        mode,
      }),
    );
    setModalOpen(false);
  };

  const buttonClassName =
    variant === "corner"
      ? "script-scene-mode-nav__btn"
      : "spectacle-direction-switch__nav-btn";

  return (
    <>
      <button
        type="button"
        className={cn(
          buttonClassName,
          variant === "corner" && "script-scene-mode-nav",
        )}
        title={`Режим сцены: ${activeLabel}`}
        aria-label={`Режим сцены: ${activeLabel}`}
        aria-haspopup="dialog"
        aria-expanded={modalOpen}
        disabled={!projectName}
        onClick={() => setModalOpen(true)}
      >
        {activeLabel}
      </button>
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        panelClassName="spectacle-script-mode-nav-modal__panel"
        ariaLabelledBy={titleId}
      >
        <div className="spectacle-script-mode-nav-modal">
          <h2 id={titleId} className="spectacle-script-mode-nav-modal__title">
            Режим сцены
          </h2>
          <ul className="spectacle-script-mode-nav-modal__list">
            {SCRIPT_MODE_ITEMS.map(({ mode, label }) => {
              const isActive = markdownMode === mode;
              return (
                <li key={mode}>
                  <button
                    type="button"
                    className={cn(
                      "spectacle-script-mode-nav-modal__item",
                      isActive && "spectacle-script-mode-nav-modal__item--active",
                    )}
                    aria-pressed={isActive}
                    disabled={!projectName}
                    onClick={() => handleSelectMode(mode)}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Modal>
    </>
  );
}
