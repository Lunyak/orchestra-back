import { useEffect, useState } from "react";
import cn from "classnames";
import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsLayoutTab } from "./use-theater-controls-layout-tab";
import { TheaterControlsLayoutRoomPanel } from "./layout/TheaterControlsLayoutRoomPanel";
import { TheaterControlsLayoutOpeningsPanel } from "./layout/TheaterControlsLayoutOpeningsPanel";

type LayoutInnerTab = "room" | "openings";

export function TheaterControlsLayoutTab({ vm }: TheaterControlsTabProps) {
  const layout = useTheaterControlsLayoutTab(vm);
  const [innerTab, setInnerTab] = useState<LayoutInnerTab>("room");

  useEffect(() => {
    if (vm.activeDoorId != null || vm.activeRecessId != null) {
      setInnerTab("openings");
    }
  }, [vm.activeDoorId, vm.activeRecessId]);

  return (
    <div className="theater-layout-panel theater-layout-panel--organized">
      <div
        className="theater-layout-panel__tabs"
        role="tablist"
        aria-label="План зала"
      >
        <button
          type="button"
          role="tab"
          aria-selected={innerTab === "room"}
          className={cn(
            "theater-layout-panel__tab",
            innerTab === "room" && "theater-layout-panel__tab--selected",
          )}
          onClick={() => setInnerTab("room")}
        >
          Помещение
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={innerTab === "openings"}
          className={cn(
            "theater-layout-panel__tab",
            innerTab === "openings" && "theater-layout-panel__tab--selected",
          )}
          onClick={() => setInnerTab("openings")}
        >
          Проёмы
        </button>
      </div>
      <div
        className="theater-layout-panel__tabpanel"
        role="tabpanel"
        aria-label={innerTab === "room" ? "Помещение" : "Проёмы"}
      >
        {innerTab === "room" ? (
          <TheaterControlsLayoutRoomPanel vm={vm} layout={layout} />
        ) : (
          <TheaterControlsLayoutOpeningsPanel vm={vm} layout={layout} />
        )}
      </div>
    </div>
  );
}
