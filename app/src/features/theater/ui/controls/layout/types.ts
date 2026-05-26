import type { TheaterControlsTabProps } from "../types";
import type { useTheaterControlsLayoutTab } from "../use-theater-controls-layout-tab";

export type LayoutSectionProps = TheaterControlsTabProps & {
  layout: ReturnType<typeof useTheaterControlsLayoutTab>;
};
