import type {
  TheaterLayoutSectionId,
  TheaterRoomSectionId,
} from "../../model/theater-sidebar-nav";
import { getTheaterRoomSectionLabel } from "../../model/theater-sidebar-nav";
import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsLayoutTab } from "./use-theater-controls-layout-tab";
import { TheaterControlsLayoutOpeningsPanel } from "./layout/TheaterControlsLayoutOpeningsPanel";
import { TheaterControlsLayoutRoomPanel } from "./layout/TheaterControlsLayoutRoomPanel";
import { TheaterRoomHome } from "./layout/TheaterRoomHome";

export type TheaterControlsLayoutTabProps = TheaterControlsTabProps & {
  section: TheaterLayoutSectionId;
  roomSection?: TheaterRoomSectionId | null;
  onOpenRoomSection?: (sectionId: TheaterRoomSectionId) => void;
};

export function TheaterControlsLayoutTab({
  vm,
  section,
  roomSection = null,
  onOpenRoomSection,
}: TheaterControlsLayoutTabProps) {
  const layout = useTheaterControlsLayoutTab(vm);
  const isRoomHome = section === "room" && roomSection == null;
  const panelLabel =
    section === "openings"
      ? "Проёмы"
      : roomSection
        ? getTheaterRoomSectionLabel(roomSection)
        : "Помещение";

  if (isRoomHome) {
    return (
      <TheaterRoomHome
        vm={vm}
        layout={layout}
        onOpen={onOpenRoomSection ?? (() => undefined)}
      />
    );
  }

  return (
    <div className="theater-layout-panel" aria-label={panelLabel}>
      {section === "room" && roomSection ? (
        <TheaterControlsLayoutRoomPanel vm={vm} layout={layout} section={roomSection} />
      ) : (
        <TheaterControlsLayoutOpeningsPanel vm={vm} layout={layout} />
      )}
    </div>
  );
}
