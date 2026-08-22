import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import cn from "classnames";
import {
  AppEditorScriptFormattingMenu,
  AppEditorScriptMarkdownStylesMenu,
  requestScriptTokenizeMatches,
  type ScriptTokenizeMode,
} from "../../../shared/components/app-editor-menubar";
import {
  selectActiveSceneMarkdownContext,
  selectShowScriptMarkdownUi,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import { useScriptUI } from "../../script-ui";
import { useAppSelector } from "../../../shared/store/hooks";
import { requestOpenFormatPlay } from "../model/format-play-request";
import "./spectacle-script-tools-dock.css";

type SpectacleScriptToolsDockProps = {
  projectSlug: string;
  sceneName: string;
};

function ScriptToolsDockChip({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
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

  return (
    <div
      id={rootId}
      className={cn("script-tools-dock__chip", isOpen && "is-open")}
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
        <div className="script-tools-dock__chip-panel">{children}</div>
      ) : null}
    </div>
  );
}

/** «A» с базовой линией — формат пьесы / токены. */
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

/** # + строки — стили markdown. */
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

/** Dock инструментов сценария внутри markdown-области. */
export function SpectacleScriptToolsDock({
  projectSlug,
  sceneName,
}: SpectacleScriptToolsDockProps) {
  const { isEditing, setIsEditing } = useScriptUI();

  const { currentScene } = useAppSelector((state) =>
    selectActiveSceneMarkdownContext(state, projectSlug, sceneName),
  );
  const markdownMode = useAppSelector(
    (state) => selectShowScriptMarkdownUi(state, projectSlug, sceneName).markdownMode,
  );
  const playOriginalMode = useAppSelector(
    (state) => selectShowScriptMarkdownUi(state, projectSlug, sceneName).playOriginalMode,
  );

  const isTextOrExplication =
    markdownMode === "play" || markdownMode === "explication";

  const handleTokenizeMatches = useCallback(
    (query: string, mode: ScriptTokenizeMode) => {
      return requestScriptTokenizeMatches(query, mode)?.count ?? 0;
    },
    [],
  );

  if (!currentScene || !isTextOrExplication) return null;

  const canFormatPlayText = !(markdownMode === "play" && playOriginalMode);

  return (
    <div
      className="script-tools-dock"
      aria-label="Инструменты сценария"
    >
      <div className="script-tools-dock__inner">
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
      </div>
    </div>
  );
}
