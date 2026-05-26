import type { TheaterControlsTabProps } from "../types";
import type { useTheaterControlsDecorTab } from "../use-theater-controls-decor-tab";

export type DecorSectionProps = TheaterControlsTabProps & {
  decor: ReturnType<typeof useTheaterControlsDecorTab>;
};
