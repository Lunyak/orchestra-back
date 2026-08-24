import { useLayoutEffect } from "react";
import { useCompactKadrStrip } from "@shared/hooks/useCompactKadrStrip";
import { useNotesRunContext } from "../model/notes-run-context";

export function NotesRunWideLayoutBridge() {
  const run = useNotesRunContext();
  const compactStrip = useCompactKadrStrip();
  const wideLayoutEnabled = run.stripWideLayout && !compactStrip;

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
