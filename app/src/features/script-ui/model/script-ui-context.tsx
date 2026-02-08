import React, { createContext, useCallback, useEffect, useState } from "react";

export interface ScriptUIContextValue {
  showRequisites: boolean;
  setShowRequisites: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleRequisites: () => void;
  showPlaylistSidebar: boolean;
  setShowPlaylistSidebar: (v: boolean | ((prev: boolean) => boolean)) => void;
  togglePlaylist: () => void;
  showHeaderSounds: boolean;
  setShowHeaderSounds: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleHeaderSounds: () => void;
  isStepsCollapsed: boolean;
  setIsStepsCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleStepsCollapsed: () => void;
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  toggleEditing: () => void;
  swapTheaterPanels: boolean;
  setSwapTheaterPanels: React.Dispatch<React.SetStateAction<boolean>>;
  togglePanels: () => void;
}

const ScriptUIContext = createContext<ScriptUIContextValue | null>(null);

function storedBool(key: string, defaultValue: boolean): boolean {
  const stored = localStorage.getItem(key);
  return stored !== null ? stored === "true" : defaultValue;
}

export function ScriptUIProvider({ children }: { children: React.ReactNode }) {
  const [showRequisites, setShowRequisites] = useState(() =>
    storedBool("showRequisites", true)
  );
  const [showPlaylistSidebar, setShowPlaylistSidebar] = useState(() =>
    storedBool("showPlaylistSidebar", true)
  );
  const [showHeaderSounds, setShowHeaderSounds] = useState(() =>
    storedBool("showHeaderSounds", true)
  );
  const [isStepsCollapsed, setIsStepsCollapsed] = useState(() =>
    storedBool("isStepsCollapsed", false)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [swapTheaterPanels, setSwapTheaterPanels] = useState(true);

  useEffect(() => {
    localStorage.setItem("showRequisites", String(showRequisites));
  }, [showRequisites]);
  useEffect(() => {
    localStorage.setItem("showPlaylistSidebar", String(showPlaylistSidebar));
  }, [showPlaylistSidebar]);
  useEffect(() => {
    localStorage.setItem("showHeaderSounds", String(showHeaderSounds));
  }, [showHeaderSounds]);
  useEffect(() => {
    localStorage.setItem("isStepsCollapsed", String(isStepsCollapsed));
  }, [isStepsCollapsed]);

  const toggleRequisites = useCallback(
    () => setShowRequisites((p) => !p),
    []
  );
  const togglePlaylist = useCallback(
    () => setShowPlaylistSidebar((p) => !p),
    []
  );
  const toggleHeaderSounds = useCallback(
    () => setShowHeaderSounds((p) => !p),
    []
  );
  const toggleStepsCollapsed = useCallback(
    () => setIsStepsCollapsed((p) => !p),
    []
  );
  const toggleEditing = useCallback(() => setIsEditing((p) => !p), []);
  const togglePanels = useCallback(
    () => setSwapTheaterPanels((p) => !p),
    []
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isToggleShortcut =
        key === "r" && (e.metaKey || e.ctrlKey) && !e.shiftKey;
      if (!isToggleShortcut) return;
      e.preventDefault();
      setIsEditing((prev) => !prev);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value: ScriptUIContextValue = {
    showRequisites,
    setShowRequisites,
    toggleRequisites,
    showPlaylistSidebar,
    setShowPlaylistSidebar,
    togglePlaylist,
    showHeaderSounds,
    setShowHeaderSounds,
    toggleHeaderSounds,
    isStepsCollapsed,
    setIsStepsCollapsed,
    toggleStepsCollapsed,
    isEditing,
    setIsEditing,
    toggleEditing,
    swapTheaterPanels,
    setSwapTheaterPanels,
    togglePanels,
  };

  return (
    <ScriptUIContext.Provider value={value}>{children}</ScriptUIContext.Provider>
  );
}

export function useScriptUI(): ScriptUIContextValue {
  const ctx = React.useContext(ScriptUIContext);
  if (!ctx)
    throw new Error("useScriptUI must be used within ScriptUIProvider");
  return ctx;
}
