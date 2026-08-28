import { useCallback, useEffect, useId, useState, type MouseEvent, type ReactNode } from "react";
import cn from "classnames";
import { useCompactKadrStrip } from "@shared/hooks/useCompactKadrStrip";
import {
  AppEditorScriptFormattingMenu,
  AppEditorScriptMarkdownStylesMenu,
  requestScriptTokenizeMatches,
  type ScriptTokenizeMode,
} from "../../../shared/components/app-editor-menubar";
import {
  selectActiveSceneMarkdownContext,
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
  type ShowScriptMarkdownMode,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import { useScriptUI } from "../../script-ui";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { requestOpenFormatPlay } from "../model/format-play-request";
import { SCRIPT_MODE_ITEMS } from "./SpectacleScriptModeNav";
import "./spectacle-script-tools-dock.css";

type SpectacleScriptToolsDockProps = {
  projectSlug: string;
  sceneName: string;
};

function ScriptToolsDockChip({
  label,
  icon,
  variant = "panel",
  closeOnAction = false,
  children,
}: {
  label: string;
  icon?: ReactNode;
  variant?: "panel" | "icons";
  closeOnAction?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = document.getElementById(rootId);
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, rootId]);

  const handlePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeOnAction) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) setIsOpen(false);
  };

  return (
    <div
      id={rootId}
      className={cn(
        "script-tools-dock__chip",
        variant === "icons" && "script-tools-dock__chip--icons",
        isOpen && "is-open",
      )}
    >
      <button
        type="button"
        className="script-tools-dock__chip-btn"
        aria-label={label}
        title={label}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        {icon ? (
          <span className="script-tools-dock__chip-icon" aria-hidden>
            {icon}
          </span>
        ) : (
          label
        )}
      </button>
      {isOpen ? (
        <div className="script-tools-dock__chip-panel" onClick={handlePanelClick}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function DockIcon({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </svg>
  );
}

function DockIconBtn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn("script-tools-dock__icon-btn", active && "script-tools-dock__icon-btn--active")}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const formatChipIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 16L10 4l5 12" />
    <path d="M6.5 12h7" />
    <path d="M4 20h16" />
  </svg>
);

const markdownStylesChipIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 5v14" />
    <path d="M9 5v14" />
    <path d="M4 9h6" />
    <path d="M4 15h6" />
    <path d="M14 8h6" />
    <path d="M14 12h5" />
    <path d="M14 16h4" />
  </svg>
);

const playModeIcon = (
  <DockIcon>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </DockIcon>
);

const explicationModeIcon = (
  <DockIcon>
    <rect x="8" y="2" width="8" height="4" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="8" y1="16" x2="14" y2="16" />
  </DockIcon>
);

const commentsModeIcon = (
  <DockIcon>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </DockIcon>
);

const MODE_ICONS: Record<ShowScriptMarkdownMode, ReactNode> = {
  play: playModeIcon,
  explication: explicationModeIcon,
  comments: commentsModeIcon,
};

const displayTriggerIcon = (
  <DockIcon>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </DockIcon>
);

const readingIcon = (
  <DockIcon>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </DockIcon>
);

const editIcon = (
  <DockIcon>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </DockIcon>
);

const annotationsIcon = (
  <DockIcon>
    <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l8.59-8.59a1 1 0 0 0 0-1.41L12 2z" />
    <circle cx="7" cy="7" r="1.2" />
  </DockIcon>
);

const originalTextIcon = (
  <DockIcon>
    <rect x="9" y="9" width="13" height="13" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </DockIcon>
);

export function SpectacleScriptToolsDock({
  projectSlug,
  sceneName,
}: SpectacleScriptToolsDockProps) {
  const dispatch = useAppDispatch();
  const compactStrip = useCompactKadrStrip();
  const { isEditing, setIsEditing, toggleEditing } = useScriptUI();

  const { currentScene } = useAppSelector((state) =>
    selectActiveSceneMarkdownContext(state, projectSlug, sceneName),
  );
  const markdownUi = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectSlug, sceneName),
  );
  const markdownMode = markdownUi.markdownMode;
  const playOriginalMode = markdownUi.playOriginalMode;
  const annotationsMode = markdownUi.annotationsMode;

  const isTextOrExplication =
    markdownMode === "play" || markdownMode === "explication";
  const showFormatMenus = isTextOrExplication;
  const showSceneFlyouts = compactStrip;
  const showEditToggle = markdownMode !== "comments";
  const showAnnotations = markdownMode !== "comments";
  const showPlayOriginal = markdownMode === "play";
  const showDisplayFlyout = showEditToggle || showAnnotations || showPlayOriginal;

  const handleTokenizeMatches = useCallback(
    (query: string, mode: ScriptTokenizeMode) => {
      return requestScriptTokenizeMatches(query, mode)?.count ?? 0;
    },
    [],
  );

  const handleSetMarkdownMode = useCallback(
    (mode: ShowScriptMarkdownMode) => {
      try {
        localStorage.setItem(
          `showScript:markdownMode:${projectSlug}:${sceneName}`,
          mode,
        );
      } catch {
        // ignore
      }
      dispatch(
        showScriptMarkdownActions.setMarkdownMode({
          projectSlug,
          sceneName,
          mode,
        }),
      );
    },
    [dispatch, projectSlug, sceneName],
  );

  const handleToggleAnnotations = useCallback(() => {
    if (isEditing) return;
    dispatch(
      showScriptMarkdownActions.setAnnotationsMode({
        projectSlug,
        sceneName,
        enabled: !annotationsMode,
      }),
    );
  }, [annotationsMode, dispatch, isEditing, projectSlug, sceneName]);

  const handleTogglePlayOriginal = useCallback(() => {
    const next = !playOriginalMode;
    try {
      localStorage.setItem(
        `showScript:playOriginalMode:${projectSlug}:${sceneName}`,
        String(next),
      );
    } catch {
      // ignore
    }
    dispatch(
      showScriptMarkdownActions.setPlayOriginalMode({
        projectSlug,
        sceneName,
        enabled: next,
      }),
    );
  }, [dispatch, playOriginalMode, projectSlug, sceneName]);

  if (!currentScene) return null;
  if (!showFormatMenus && !showSceneFlyouts) return null;

  const canFormatPlayText = !(markdownMode === "play" && playOriginalMode);
  const activeModeLabel =
    SCRIPT_MODE_ITEMS.find((item) => item.mode === markdownMode)?.label ?? "Текст";
  const editToggleLabel = isEditing ? "Режим чтения" : "Режим редактирования";
  const annotationsLabel = isEditing
    ? "Метки недоступны в режиме редактирования"
    : annotationsMode
      ? "Скрыть метки"
      : "Показать метки";
  const playOriginalLabel = playOriginalMode
    ? "Отредактированный текст"
    : "Оригинальный текст";

  return (
    <div className="script-tools-dock" aria-label="Инструменты сценария">
      <div className="script-tools-dock__inner">
        {showFormatMenus ? (
          <div className="script-tools-dock__menus">
            <ScriptToolsDockChip label="Формат" icon={formatChipIcon}>
              <AppEditorScriptFormattingMenu
                variant="panel"
                disabled={!isEditing}
                formatPlayDisabled={!canFormatPlayText}
                onOpenFormatPlay={requestOpenFormatPlay}
                onTokenizeMatches={handleTokenizeMatches}
                onRequestEditing={() => setIsEditing(true)}
              />
            </ScriptToolsDockChip>
            <ScriptToolsDockChip label="Стили" icon={markdownStylesChipIcon}>
              <AppEditorScriptMarkdownStylesMenu />
            </ScriptToolsDockChip>
          </div>
        ) : null}

        {showSceneFlyouts ? (
          <div className="script-tools-dock__end">
            <ScriptToolsDockChip
              label={`Режим: ${activeModeLabel}`}
              icon={MODE_ICONS[markdownMode]}
              variant="icons"
              closeOnAction
            >
              <div className="script-tools-dock__icon-stack" role="group" aria-label="Режим сцены">
                {SCRIPT_MODE_ITEMS.map(({ mode, label }) => (
                  <DockIconBtn
                    key={mode}
                    label={label}
                    active={markdownMode === mode}
                    onClick={() => handleSetMarkdownMode(mode)}
                  >
                    {MODE_ICONS[mode]}
                  </DockIconBtn>
                ))}
              </div>
            </ScriptToolsDockChip>

            {showDisplayFlyout ? (
              <ScriptToolsDockChip
                label="Отображение"
                icon={displayTriggerIcon}
                variant="icons"
                closeOnAction
              >
                <div className="script-tools-dock__icon-stack" role="group" aria-label="Отображение">
                  {showEditToggle ? (
                    <DockIconBtn
                      label={editToggleLabel}
                      active={isEditing}
                      onClick={toggleEditing}
                    >
                      {isEditing ? readingIcon : editIcon}
                    </DockIconBtn>
                  ) : null}
                  {showAnnotations ? (
                    <DockIconBtn
                      label={annotationsLabel}
                      active={annotationsMode}
                      disabled={isEditing}
                      onClick={handleToggleAnnotations}
                    >
                      {annotationsIcon}
                    </DockIconBtn>
                  ) : null}
                  {showPlayOriginal ? (
                    <DockIconBtn
                      label={playOriginalLabel}
                      active={playOriginalMode}
                      onClick={handleTogglePlayOriginal}
                    >
                      {originalTextIcon}
                    </DockIconBtn>
                  ) : null}
                </div>
              </ScriptToolsDockChip>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
