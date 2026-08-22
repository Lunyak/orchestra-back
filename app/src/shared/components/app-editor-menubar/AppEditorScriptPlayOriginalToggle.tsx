import cn from "classnames";

const originalTextIcon = (
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
    <path d="M8 7h8" />
    <path d="M8 11h6" />
  </svg>
);

export type AppEditorScriptPlayOriginalToggleProps = {
  playOriginalMode: boolean;
  onToggle: () => void;
  className?: string;
};

export function AppEditorScriptPlayOriginalToggle({
  playOriginalMode,
  onToggle,
  className,
}: AppEditorScriptPlayOriginalToggleProps) {
  return (
    <button
      type="button"
      className={cn(
        "script-chrome-dock-btn",
        "script-play-original-toggle",
        playOriginalMode && "script-chrome-dock-btn--active",
        playOriginalMode && "script-play-original-toggle--active",
        className,
      )}
      onClick={onToggle}
      title={
        playOriginalMode
          ? "Показан оригинал — нажмите для отредактированного"
          : "Показан отредактированный — нажмите для оригинала"
      }
      aria-label={
        playOriginalMode
          ? "Показан оригинальный текст"
          : "Показан отредактированный текст"
      }
      aria-pressed={playOriginalMode}
    >
      {originalTextIcon}
    </button>
  );
}
