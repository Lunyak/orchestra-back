import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import { TheaterControlsToolbar } from "./controls/TheaterControlsToolbar";
import { TheaterControlsSettings } from "./controls/TheaterControlsSettings";
import { TheaterNavigationPanel } from "./TheaterNavigationPanel";

export type TheaterRightSidebarProps = {
  vm: TheaterSceneViewModel;
};

/** Правая панель: горизонтальные вкладки сверху + содержимое. */
export function TheaterRightSidebar({ vm }: TheaterRightSidebarProps) {
  const isNavigate = vm.activeTab === "navigate";
  const panelLabel = isNavigate ? "Обзор" : "Параметры";

  return (
    <div className="theater-right-sidebar">
      <TheaterControlsToolbar vm={vm} />
      <div
        className="theater-right-sidebar-panels"
        role="tabpanel"
        aria-label={panelLabel}
      >
        {isNavigate ? (
          <TheaterNavigationPanel vm={vm} embedded />
        ) : (
          <TheaterControlsSettings vm={vm} />
        )}
      </div>
    </div>
  );
}
