import { useState } from "react";
import cn from "classnames";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import { TheaterControlsOutlinerSection } from "./controls/TheaterControlsOutlinerSection";
import { TheaterControlsViewSection } from "./controls/TheaterControlsViewSection";
import { TheaterKeyboardShortcuts } from "./TheaterKeyboardShortcuts";
import { TheaterKadrTape } from "./TheaterKadrTape";

type NavigationPanelTab = "scene" | "kadrs" | "view" | "help";

export type TheaterNavigationPanelProps = {
  vm: TheaterSceneViewModel;
  /** Внутри правого сайдбара (без отдельной колонки у viewport). */
  embedded?: boolean;
};

/** Outliner, картины, вид и справка — отдельно от настроек инструментов. */
export function TheaterNavigationPanel({ vm, embedded }: TheaterNavigationPanelProps) {
  const [tab, setTab] = useState<NavigationPanelTab>("scene");
  const activePanelLabel =
    tab === "scene"
      ? "Сцена"
      : tab === "kadrs"
        ? "Сцены / картины"
        : tab === "view"
          ? "Вид"
          : "Справка";

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
        aria-label="Сцена, сцены и картины, вид и справка"
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
          aria-selected={tab === "kadrs"}
          className={cn(
            "theater-navigation-panel-tab",
            tab === "kadrs" && "theater-navigation-panel-tab--selected",
          )}
          onClick={() => setTab("kadrs")}
        >
          Сцены / картины
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "view"}
          className={cn(
            "theater-navigation-panel-tab",
            tab === "view" && "theater-navigation-panel-tab--selected",
          )}
          onClick={() => setTab("view")}
        >
          Вид
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
        {tab === "kadrs" ? <TheaterKadrTape vm={vm} /> : null}
        {tab === "view" ? <TheaterControlsViewSection vm={vm} /> : null}
        {tab === "help" ? <TheaterKeyboardShortcuts /> : null}
      </div>
    </div>
  );
}
