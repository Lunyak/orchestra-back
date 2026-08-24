export type SpectacleRunSchemeTabId =
  | "light"
  | "requisites"
  | "video"
  | "projector";

export const SPECTACLE_RUN_SCHEME_TABS: ReadonlyArray<{
  id: SpectacleRunSchemeTabId;
  label: string;
}> = [
  { id: "light", label: "Свет" },
  { id: "requisites", label: "Реквизит" },
  { id: "video", label: "Видео" },
  { id: "projector", label: "Проектор" },
];

export const SPECTACLE_RUN_LIGHT_PLOT_MODES = [
  { id: "rehearsal" as const, label: "Сборка" },
  { id: "prog-run" as const, label: "Прогон" },
];

export function spectacleRunSchemeTabLabel(tabId: SpectacleRunSchemeTabId): string {
  return (
    SPECTACLE_RUN_SCHEME_TABS.find((tab) => tab.id === tabId)?.label ?? "Свет"
  );
}
