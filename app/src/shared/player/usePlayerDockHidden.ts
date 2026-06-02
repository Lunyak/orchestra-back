import { useCallback, useEffect, useState } from "react";
import {
  PLAYER_DOCK_VISIBILITY_EVENT,
  PLAYER_PREFS_STORAGE_KEY,
  readPlayerDockHidden,
  setPlayerDockHidden,
} from "./player-prefs";

export function usePlayerDockHidden() {
  const [playerDockHidden, setPlayerDockHiddenState] = useState(readPlayerDockHidden);

  useEffect(() => {
    setPlayerDockHiddenState(readPlayerDockHidden());
  }, []);

  useEffect(() => {
    const onVisibilityChange = (event: Event) => {
      const detail = (event as CustomEvent<{ hidden?: boolean }>).detail;
      setPlayerDockHiddenState(detail?.hidden ?? readPlayerDockHidden());
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === PLAYER_PREFS_STORAGE_KEY || event.key === "orchestra:player-dock-hidden") {
        setPlayerDockHiddenState(readPlayerDockHidden());
      }
    };

    window.addEventListener(PLAYER_DOCK_VISIBILITY_EVENT, onVisibilityChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PLAYER_DOCK_VISIBILITY_EVENT, onVisibilityChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const togglePlayerDock = useCallback(() => {
    const nextHidden = !readPlayerDockHidden();
    setPlayerDockHidden(nextHidden);
    setPlayerDockHiddenState(nextHidden);
  }, []);

  return { playerDockHidden, togglePlayerDock };
}
