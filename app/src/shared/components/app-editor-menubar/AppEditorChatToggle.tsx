import { useChatDockHidden } from "../../chat/useChatDockHidden";

export function AppEditorChatToggle() {
  const { chatDockHidden, toggleChatDock } = useChatDockHidden();

  return (
    <button
      type="button"
      className={[
        "app-editor-menubar__panel-btn",
        "app-editor-menubar__panel-btn--chat",
        chatDockHidden ? "app-editor-menubar__panel-btn--muted" : "app-editor-menubar__panel-btn--active",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={toggleChatDock}
      title={chatDockHidden ? "Показать чат" : "Скрыть чат"}
      aria-label={chatDockHidden ? "Показать чат" : "Скрыть чат"}
      aria-pressed={!chatDockHidden}
    >
      <span className="app-editor-menubar__panel-icon">
        {chatDockHidden ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.35-4.05" />
            <path d="M4.4 8.2A8.5 8.5 0 0 1 12.5 3h.5a8.48 8.48 0 0 1 8 8v.5" />
            <path d="M3 3l18 18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </span>
    </button>
  );
}
