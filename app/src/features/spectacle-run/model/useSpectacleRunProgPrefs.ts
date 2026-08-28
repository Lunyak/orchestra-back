import { useCallback, useEffect, useRef, useState } from "react";
import {
  persistProgRunKadrStripLayout,
  persistProgRunKadrStripNotesOverlay,
  persistProgRunKadrStripPlainCover,
  persistProgRunLightConsoleOpen,
  persistProgRunPaused,
  persistProgRunWideLayout,
  readProgRunKadrStripLayout,
  readProgRunKadrStripNotesOverlay,
  readProgRunKadrStripPlainCover,
  readProgRunLightConsoleOpen,
  readProgRunPaused,
  readProgRunWideLayout,
  type ProgRunKadrStripLayout,
} from "./prog-run-prefs-storage";

export type UseSpectacleRunProgPrefsArgs = {
  projectName: string;
  isProgRun: boolean;
};

export function useSpectacleRunProgPrefs({
  projectName,
  isProgRun,
}: UseSpectacleRunProgPrefsArgs) {
  const [progRunPaused, setProgRunPaused] = useState(() =>
    readProgRunPaused(projectName),
  );
  const [progRunKadrStripLayout, setProgRunKadrStripLayoutState] =
    useState<ProgRunKadrStripLayout>(() => readProgRunKadrStripLayout(projectName));
  const [progRunKadrStripNotesOverlay, setProgRunKadrStripNotesOverlayState] = useState(
    () => readProgRunKadrStripNotesOverlay(projectName),
  );
  const [progRunLightConsoleOpen, setProgRunLightConsoleOpenState] = useState(
    () => readProgRunLightConsoleOpen(projectName),
  );
  const [progRunKadrStripPlainCover, setProgRunKadrStripPlainCoverState] = useState(
    () => readProgRunKadrStripPlainCover(projectName),
  );
  const [progRunWideLayout, setProgRunWideLayoutState] = useState(() =>
    readProgRunWideLayout(projectName),
  );
  const progRunPausedRef = useRef(false);
  progRunPausedRef.current = progRunPaused;
  const progRunPlaybackEnabled = isProgRun && !progRunPaused;

  useEffect(() => {
    setProgRunKadrStripLayoutState(readProgRunKadrStripLayout(projectName));
    setProgRunKadrStripNotesOverlayState(readProgRunKadrStripNotesOverlay(projectName));
    setProgRunLightConsoleOpenState(readProgRunLightConsoleOpen(projectName));
    setProgRunKadrStripPlainCoverState(readProgRunKadrStripPlainCover(projectName));
    setProgRunWideLayoutState(readProgRunWideLayout(projectName));
  }, [projectName]);

  useEffect(() => {
    setProgRunPaused(readProgRunPaused(projectName));
  }, [projectName]);

  useEffect(() => {
    if (!isProgRun) return;
    setProgRunPaused(readProgRunPaused(projectName));
  }, [isProgRun, projectName]);

  const setProgRunKadrStripLayout = useCallback(
    (layout: ProgRunKadrStripLayout) => {
      setProgRunKadrStripLayoutState(layout);
      persistProgRunKadrStripLayout(projectName, layout);
    },
    [projectName],
  );

  const setProgRunKadrStripNotesOverlay = useCallback(
    (enabled: boolean) => {
      setProgRunKadrStripNotesOverlayState(enabled);
      persistProgRunKadrStripNotesOverlay(projectName, enabled);
    },
    [projectName],
  );

  const toggleProgRunKadrStripNotesOverlay = useCallback(() => {
    setProgRunKadrStripNotesOverlay(!progRunKadrStripNotesOverlay);
  }, [progRunKadrStripNotesOverlay, setProgRunKadrStripNotesOverlay]);

  const setProgRunLightConsoleOpen = useCallback(
    (open: boolean) => {
      setProgRunLightConsoleOpenState(open);
      persistProgRunLightConsoleOpen(projectName, open);
    },
    [projectName],
  );

  const toggleProgRunLightConsoleOpen = useCallback(() => {
    setProgRunLightConsoleOpen(!progRunLightConsoleOpen);
  }, [progRunLightConsoleOpen, setProgRunLightConsoleOpen]);

  const setProgRunKadrStripPlainCover = useCallback(
    (enabled: boolean) => {
      setProgRunKadrStripPlainCoverState(enabled);
      persistProgRunKadrStripPlainCover(projectName, enabled);
    },
    [projectName],
  );

  const toggleProgRunKadrStripPlainCover = useCallback(() => {
    setProgRunKadrStripPlainCover(!progRunKadrStripPlainCover);
  }, [progRunKadrStripPlainCover, setProgRunKadrStripPlainCover]);

  const setProgRunWideLayout = useCallback(
    (enabled: boolean) => {
      setProgRunWideLayoutState(enabled);
      persistProgRunWideLayout(projectName, enabled);
    },
    [projectName],
  );

  const toggleProgRunWideLayout = useCallback(() => {
    setProgRunWideLayout(!progRunWideLayout);
  }, [progRunWideLayout, setProgRunWideLayout]);

  const persistPaused = useCallback(
    (paused: boolean) => {
      setProgRunPaused(paused);
      persistProgRunPaused(projectName, paused);
    },
    [projectName],
  );

  return {
    progRunPaused,
    setProgRunPaused,
    persistPaused,
    progRunPausedRef,
    progRunPlaybackEnabled,
    progRunKadrStripLayout,
    setProgRunKadrStripLayout,
    progRunKadrStripNotesOverlay,
    setProgRunKadrStripNotesOverlay,
    toggleProgRunKadrStripNotesOverlay,
    progRunLightConsoleOpen,
    setProgRunLightConsoleOpen,
    toggleProgRunLightConsoleOpen,
    progRunKadrStripPlainCover,
    setProgRunKadrStripPlainCover,
    toggleProgRunKadrStripPlainCover,
    progRunWideLayout,
    setProgRunWideLayout,
    toggleProgRunWideLayout,
  };
}
