import { useCallback, useEffect, useState } from "react";
import {
  PLAYER_PREFS_STORAGE_KEY,
  PLAYER_VOLUME_CHANGE_EVENT,
  readPlayerVolume,
  setPlayerVolume as persistPlayerVolume,
} from "./player-prefs";

export function usePlayerVolume() {
  const [volume, setVolumeState] = useState(readPlayerVolume);

  useEffect(() => {
    setVolumeState(readPlayerVolume());
  }, []);

  useEffect(() => {
    const onVolumeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ volume?: number }>).detail;
      setVolumeState(detail?.volume ?? readPlayerVolume());
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === PLAYER_PREFS_STORAGE_KEY || event.key === "orchestra:player-dock-hidden") {
        setVolumeState(readPlayerVolume());
      }
    };

    window.addEventListener(PLAYER_VOLUME_CHANGE_EVENT, onVolumeChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PLAYER_VOLUME_CHANGE_EVENT, onVolumeChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setVolume = useCallback((nextValue: number) => {
    persistPlayerVolume(nextValue);
    setVolumeState(readPlayerVolume());
  }, []);

  return { volume, setVolume };
}
