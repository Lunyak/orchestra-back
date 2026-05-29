import { MenubarPanelIcon } from "./MenubarPanelIcon";

const tocIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 6h16" />
    <path d="M4 12h10" />
    <path d="M4 18h14" />
  </svg>
);

export type AppEditorScriptTocToggleProps = {
  editorTocEnabled: boolean;
  onToggle: () => void;
};

export function AppEditorScriptTocToggle({
  editorTocEnabled,
  onToggle,
}: AppEditorScriptTocToggleProps) {
  return (
    <button
      type="button"
      className={[
        "app-editor-menubar__panel-btn",
        editorTocEnabled ? "app-editor-menubar__panel-btn--active" : "app-editor-menubar__panel-btn--muted",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onToggle}
      title={editorTocEnabled ? "Скрыть оглавление «Картины»" : "Показать оглавление «Картины»"}
      aria-label={editorTocEnabled ? "Скрыть оглавление" : "Показать оглавление"}
      aria-pressed={editorTocEnabled}
    >
      <MenubarPanelIcon active={editorTocEnabled}>{tocIcon}</MenubarPanelIcon>
    </button>
  );
}
