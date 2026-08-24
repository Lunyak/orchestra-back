export type SpectacleActiveView =
  | "theater"
  | "light-plot"
  | "sufer"
  | "media"
  | "board"
  | "script"
  | "sessions"
  | "tasks"
  | "team";

export const MAIN_CONTENT_VIEW_MODIFIERS: Record<
  SpectacleActiveView,
  string | readonly string[] | undefined
> = {
  theater: "main-content-theater",
  "light-plot": "main-content-light-plot",
  sufer: "main-content-sufer",
  media: "main-content-project-media",
  board: "main-content-kanban",
  script: "show-script",
  sessions: "main-content-sessions",
  tasks: "main-content-sessions",
  team: "main-content-sessions",
};
