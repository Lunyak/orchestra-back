import cn from "classnames";

const annotationsIcon = (
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
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </svg>
);

export type AppEditorScriptAnnotationsToggleProps = {
  annotationsMode: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
};

export function AppEditorScriptAnnotationsToggle({
  annotationsMode,
  onToggle,
  disabled = false,
  className,
}: AppEditorScriptAnnotationsToggleProps) {
  const title = disabled
    ? "Метки недоступны в режиме редактирования"
    : annotationsMode
      ? "Скрыть метки"
      : "Показать метки";

  return (
    <button
      type="button"
      className={cn(
        "script-chrome-dock-btn",
        "script-annotations-toggle",
        annotationsMode && "script-chrome-dock-btn--active",
        annotationsMode && "script-annotations-toggle--active",
        className,
      )}
      onClick={onToggle}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={annotationsMode}
    >
      {annotationsIcon}
    </button>
  );
}
