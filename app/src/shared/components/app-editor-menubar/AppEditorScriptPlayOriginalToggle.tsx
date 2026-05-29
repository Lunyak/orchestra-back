import { MenubarPanelIcon } from "./MenubarPanelIcon";

const originalTextIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    <path d="M8 7h8" />
    <path d="M8 11h6" />
  </svg>
);

export type AppEditorScriptPlayOriginalToggleProps = {
  playOriginalMode: boolean;
  onToggle: () => void;
};

export function AppEditorScriptPlayOriginalToggle({
  playOriginalMode,
  onToggle,
}: AppEditorScriptPlayOriginalToggleProps) {
  return (
    <button
      type="button"
      className={[
        "app-editor-menubar__panel-btn",
        "app-editor-menubar__panel-btn--play-original",
        playOriginalMode ? "app-editor-menubar__panel-btn--active" : "app-editor-menubar__panel-btn--muted",
      ]
        .filter(Boolean)
        .join(" ")}
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
      <MenubarPanelIcon active={playOriginalMode}>{originalTextIcon}</MenubarPanelIcon>
    </button>
  );
}
