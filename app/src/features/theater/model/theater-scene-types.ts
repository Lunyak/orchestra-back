import type { Dispatch, SetStateAction } from "react";
import type { TheaterLayout } from "../../../shared/types/script";

export type TheaterSceneProps = {
  projectName?: string;
  theaterLayout?: TheaterLayout;
  onTheaterLayoutChange?: Dispatch<SetStateAction<TheaterLayout>>;
  isPanelsSwapped?: boolean;
  onTogglePanels?: () => void;
  /** @deprecated настройки в верхней панели и правом сайдбаре */
  controlsHost?: HTMLElement | null;
  /** @deprecated use outlinerHost */
  mainControlsHost?: HTMLElement | null;
  /** Правый сайдбар: outliner + свойства */
  outlinerHost?: HTMLElement | null;
  controlsInPanel?: boolean;
  /** Встроенный режим на странице «Репетиция»: только 3D и наведение софитов, без полного редактора театра. */
  embeddedLightRehearsal?: boolean;
};
