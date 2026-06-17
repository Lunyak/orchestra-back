export type SpectacleActiveView =
  | "theater"
  | "light-plot"
  | "notes-run"
  | "board"
  | "script"
  | "sessions";

export const MAIN_CONTENT_VIEW_MODIFIERS: Record<
  SpectacleActiveView,
  string | readonly string[] | undefined
> = {
  theater: "main-content-theater",
  "light-plot": undefined,
  "notes-run": undefined,
  board: "main-content-kanban",
  script: "show-script",
  sessions: "main-content-sessions",
};
