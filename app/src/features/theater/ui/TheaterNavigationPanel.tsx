import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import { TheaterControlsOutlinerSection } from "./controls/TheaterControlsOutlinerSection";
import { TheaterControlsViewSection } from "./controls/TheaterControlsViewSection";
import { TheaterKeyboardShortcuts } from "./TheaterKeyboardShortcuts";
import cn from "classnames";

export type TheaterNavigationSection = "scene" | "view" | "help";

export type TheaterNavigationPanelProps = {
  vm: TheaterSceneViewModel;
  /** Внутри правого сайдбара (без отдельной колонки у viewport). */
  embedded?: boolean;
  section: TheaterNavigationSection;
};

/** Outliner, вид и справка — отдельно от настроек инструментов. */
export function TheaterNavigationPanel({
  vm,
  embedded,
  section,
}: TheaterNavigationPanelProps) {
  const activePanelLabel =
    section === "scene"
      ? "Список элементов"
      : section === "view"
        ? "Вид"
        : "Справка";

  return (
    <div
      className={cn(
        "theater-navigation-panel",
        embedded && "theater-navigation-panel--embedded",
      )}
      aria-label={activePanelLabel}
    >
      <div className="theater-navigation-panel-body" aria-label={activePanelLabel}>
        {section === "scene" ? <TheaterControlsOutlinerSection vm={vm} /> : null}
        {section === "view" ? <TheaterControlsViewSection vm={vm} /> : null}
        {section === "help" ? <TheaterKeyboardShortcuts /> : null}
      </div>
    </div>
  );
}
