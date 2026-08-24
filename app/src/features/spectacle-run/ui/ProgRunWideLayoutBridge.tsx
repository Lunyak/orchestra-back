import { useLayoutEffect } from "react";
import { useCompactKadrStrip } from "@shared/hooks/useCompactKadrStrip";
import { useAppSelector } from "../../../shared/store/hooks";
import { useSpectacleRunContext } from "../model/spectacle-run-context";

export function ProgRunWideLayoutBridge() {
  const lightPlotMode = useAppSelector((state) => state.scriptUi.lightPlotMode);
  const run = useSpectacleRunContext();
  const compactStrip = useCompactKadrStrip();
  const isProgRun = lightPlotMode === "prog-run";
  const wideLayoutEnabled = isProgRun && run.progRunWideLayout && !compactStrip;

  useLayoutEffect(() => {
    const layout = document.querySelector(".app-layout");
    if (!layout) return;

    if (wideLayoutEnabled) {
      layout.setAttribute("data-prog-run-wide", "true");
    } else {
      layout.removeAttribute("data-prog-run-wide");
    }

    return () => {
      layout.removeAttribute("data-prog-run-wide");
    };
  }, [wideLayoutEnabled]);

  return null;
}
