import type { TheaterControlsTabProps } from "../types";
import type { TheaterControlsLayoutTabModel } from "../use-theater-controls-layout-tab";

export type LayoutSectionProps = TheaterControlsTabProps & {
  layout: TheaterControlsLayoutTabModel;
};
