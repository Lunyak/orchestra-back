import { useState } from "react";
import cn from "classnames";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import { TheaterControlsOutlinerSection } from "./controls/TheaterControlsOutlinerSection";
import { TheaterControlsProjectSection } from "./controls/TheaterControlsProjectSection";
import { TheaterKeyboardShortcuts } from "./TheaterKeyboardShortcuts";

type NavigationPanelTab = "scene" | "project" | "help";

export type TheaterNavigationPanelProps = {
  vm: TheaterSceneViewModel;
  /** Внутри правого сайдбара (без отдельной колонки у viewport). */
  embedded?: boolean;
};

/** Outliner, проект и закладки камеры — отдельно от настроек инструментов. */
export function TheaterNavigationPanel({ vm, embedded }: TheaterNavigationPanelProps) {
  const [tab, setTab] = useState<NavigationPanelTab>("scene");
  const activePanelLabel =
    tab === "scene" ? "Сцена" : tab === "project" ? "Проект" : "Справка";

  return (
    <div
      className={cn(
        "theater-navigation-panel",
        embedded && "theater-navigation-panel--embedded",
      )}
      aria-label="Навигация по сцене"
    >
      <div
        className="theater-navigation-panel-tabs"
        role="tablist"
        aria-label="Сцена и проект"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "scene"}
          className={cn(
            "theater-navigation-panel-tab",
            tab === "scene" && "theater-navigation-panel-tab--selected",
          )}
          onClick={() => setTab("scene")}
        >
          Сцена
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "project"}
          className={cn(
            "theater-navigation-panel-tab",
            tab === "project" && "theater-navigation-panel-tab--selected",
          )}
          onClick={() => setTab("project")}
        >
          Проект
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "help"}
          className={cn(
            "theater-navigation-panel-tab",
            tab === "help" && "theater-navigation-panel-tab--selected",
          )}
          onClick={() => setTab("help")}
        >
          Справка
        </button>
      </div>
      <div
        className="theater-navigation-panel-body"
        role="tabpanel"
        aria-label={activePanelLabel}
      >
        {tab === "scene" ? <TheaterControlsOutlinerSection vm={vm} /> : null}
        {tab === "project" ? <TheaterControlsProjectSection vm={vm} /> : null}
        {tab === "help" ? <TheaterKeyboardShortcuts /> : null}
      </div>
    </div>
  );
}
