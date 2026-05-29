import { useState } from "react";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import { TheaterControlsOutlinerSection } from "./controls/TheaterControlsOutlinerSection";
import { TheaterControlsProjectSection } from "./controls/TheaterControlsProjectSection";

type NavigationPanelTab = "scene" | "project";

export type TheaterNavigationPanelProps = {
  vm: TheaterSceneViewModel;
  /** Внутри правого сайдбара (без отдельной колонки у viewport). */
  embedded?: boolean;
};

/** Outliner, проект и закладки камеры — отдельно от настроек инструментов. */
export function TheaterNavigationPanel({ vm, embedded }: TheaterNavigationPanelProps) {
  const [tab, setTab] = useState<NavigationPanelTab>("scene");

  return (
    <div
      className={[
        "theater-navigation-panel",
        embedded ? "theater-navigation-panel--embedded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
          className={[
            "theater-navigation-panel-tab",
            tab === "scene" ? "theater-navigation-panel-tab--selected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setTab("scene")}
        >
          Сцена
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "project"}
          className={[
            "theater-navigation-panel-tab",
            tab === "project" ? "theater-navigation-panel-tab--selected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setTab("project")}
        >
          Проект
        </button>
      </div>
      <div
        className="theater-navigation-panel-body"
        role="tabpanel"
        aria-label={tab === "scene" ? "Сцена" : "Проект"}
      >
        {tab === "scene" ? (
          <TheaterControlsOutlinerSection vm={vm} />
        ) : (
          <TheaterControlsProjectSection vm={vm} />
        )}
      </div>
    </div>
  );
}
