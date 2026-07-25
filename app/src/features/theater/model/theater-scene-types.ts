import type { Dispatch, SetStateAction } from "react";
import type { TheaterLayout } from "../../../shared/types/script";

export type TheaterSceneProps = {
  projectName?: string;
  theaterLayout?: TheaterLayout;
  onTheaterLayoutChange?: Dispatch<SetStateAction<TheaterLayout>>;
  isPanelsSwapped?: boolean;
  onTogglePanels?: () => void;
  /** Правый сайдбар: outliner + свойства */
  outlinerHost?: HTMLElement | null;
  controlsInPanel?: boolean;
  /** Встроенный режим на странице «Спектакль»: только 3D и наведение софитов, без полного редактора театра. */
  embeddedLightRehearsal?: boolean;
  /** Скрыть менюбар и боковые панели — 3D на весь экран. */
  immersiveMode?: boolean;
  onImmersiveModeChange?: (value: boolean) => void;
};
