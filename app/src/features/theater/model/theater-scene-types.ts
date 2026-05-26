import type { Dispatch, SetStateAction } from "react";
import type { TheaterLayout } from "../../../shared/types/script";

export type TheaterSceneProps = {
  projectName?: string;
  theaterLayout?: TheaterLayout;
  onTheaterLayoutChange?: Dispatch<SetStateAction<TheaterLayout>>;
  isPanelsSwapped?: boolean;
  onTogglePanels?: () => void;
  /** @deprecated use mainControlsHost */
  controlsHost?: HTMLElement | null;
  mainControlsHost?: HTMLElement | null;
  outlinerHost?: HTMLElement | null;
  controlsInPanel?: boolean;
};
