import { usePlayerDockHidden } from "../../player/usePlayerDockHidden";

export function AppEditorPlayerToggle() {
  const { playerDockHidden, togglePlayerDock } = usePlayerDockHidden();

  return (
    <button
      type="button"
      className={[
        "app-editor-menubar__panel-btn",
        "app-editor-menubar__panel-btn--player",
        playerDockHidden ? "app-editor-menubar__panel-btn--muted" : "app-editor-menubar__panel-btn--active",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={togglePlayerDock}
      title={playerDockHidden ? "Показать проигрыватель" : "Скрыть проигрыватель"}
      aria-label={playerDockHidden ? "Показать проигрыватель" : "Скрыть проигрыватель"}
      aria-pressed={!playerDockHidden}
    >
      <span className="app-editor-menubar__panel-icon">
        {playerDockHidden ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
            <path d="M3 3l18 18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        )}
      </span>
    </button>
  );
}
