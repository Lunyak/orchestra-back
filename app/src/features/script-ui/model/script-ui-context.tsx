import React, { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { scriptUiActions, selectScriptUi } from "./script-ui-slice";

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
  showStepRoles: boolean;
  setShowStepRoles: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleStepRoles: () => void;
  showScriptEditorTools: boolean;
  setShowScriptEditorTools: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleScriptEditorTools: () => void;
  isStepsCollapsed: boolean;
  setIsStepsCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleStepsCollapsed: () => void;
  mobilePlaylistOpen: boolean;
  setMobilePlaylistOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleMobilePlaylist: () => void;
  mobileStepsOpen: boolean;
  setMobileStepsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleMobileSteps: () => void;
  closeMobilePanels: () => void;
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  toggleEditing: () => void;
  swapTheaterPanels: boolean;
  setSwapTheaterPanels: React.Dispatch<React.SetStateAction<boolean>>;
  togglePanels: () => void;
}

export function ScriptUIProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  // Load persisted UI flags once on mount.
  useEffect(() => {
    dispatch(scriptUiActions.initScriptUi());
  }, [dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const rawKey = (e as any)?.key;
      if (typeof rawKey !== "string" || rawKey.length === 0) return;
      const key = rawKey.toLowerCase();
      const isToggleShortcut =
        key === "r" && (e.metaKey || e.ctrlKey) && !e.shiftKey;
      if (!isToggleShortcut) return;
      e.preventDefault();
      dispatch(scriptUiActions.toggleEditing());
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  return <>{children}</>;
}

export function useScriptUI(): ScriptUIContextValue {
  const dispatch = useAppDispatch();
  const ui = useAppSelector(selectScriptUi);

  const setShowRequisites = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? (v as any)(ui.showRequisites) : v;
      dispatch(scriptUiActions.setShowRequisites({ value: Boolean(next) }));
    },
    [dispatch, ui.showRequisites],
  );
  const toggleRequisites = useCallback(() => dispatch(scriptUiActions.toggleRequisites()), [dispatch]);

  const setShowPlaylistSidebar = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? (v as any)(ui.showPlaylistSidebar) : v;
      dispatch(scriptUiActions.setShowPlaylistSidebar({ value: Boolean(next) }));
    },
    [dispatch, ui.showPlaylistSidebar],
  );
  const togglePlaylist = useCallback(() => dispatch(scriptUiActions.togglePlaylist()), [dispatch]);

  const setShowHeaderSounds = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? (v as any)(ui.showHeaderSounds) : v;
      dispatch(scriptUiActions.setShowHeaderSounds({ value: Boolean(next) }));
    },
    [dispatch, ui.showHeaderSounds],
  );
  const toggleHeaderSounds = useCallback(() => dispatch(scriptUiActions.toggleHeaderSounds()), [dispatch]);

  const setShowStepRoles = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? (v as any)(ui.showStepRoles) : v;
      dispatch(scriptUiActions.setShowStepRoles({ value: Boolean(next) }));
    },
    [dispatch, ui.showStepRoles],
  );
  const toggleStepRoles = useCallback(() => dispatch(scriptUiActions.toggleStepRoles()), [dispatch]);

  const setShowScriptEditorTools = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? (v as any)(ui.showScriptEditorTools) : v;
      dispatch(scriptUiActions.setShowScriptEditorTools({ value: Boolean(next) }));
    },
    [dispatch, ui.showScriptEditorTools],
  );
  const toggleScriptEditorTools = useCallback(
    () => dispatch(scriptUiActions.toggleScriptEditorTools()),
    [dispatch],
  );

  const setIsStepsCollapsed = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? (v as any)(ui.isStepsCollapsed) : v;
      dispatch(scriptUiActions.setIsStepsCollapsed({ value: Boolean(next) }));
    },
    [dispatch, ui.isStepsCollapsed],
  );
  const toggleStepsCollapsed = useCallback(() => dispatch(scriptUiActions.toggleStepsCollapsed()), [dispatch]);

  const setMobilePlaylistOpen = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? (v as any)(ui.mobilePlaylistOpen) : v;
      dispatch(scriptUiActions.setMobilePlaylistOpen({ value: Boolean(next) }));
    },
    [dispatch, ui.mobilePlaylistOpen],
  );
  const toggleMobilePlaylist = useCallback(
    () => dispatch(scriptUiActions.toggleMobilePlaylist()),
    [dispatch],
  );

  const setMobileStepsOpen = useCallback(
    (v: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof v === "function" ? (v as any)(ui.mobileStepsOpen) : v;
      dispatch(scriptUiActions.setMobileStepsOpen({ value: Boolean(next) }));
    },
    [dispatch, ui.mobileStepsOpen],
  );
  const toggleMobileSteps = useCallback(
    () => dispatch(scriptUiActions.toggleMobileSteps()),
    [dispatch],
  );
  const closeMobilePanels = useCallback(() => dispatch(scriptUiActions.closeMobilePanels()), [dispatch]);

  const setIsEditing: React.Dispatch<React.SetStateAction<boolean>> = useCallback(
    (v) => {
      const next = typeof v === "function" ? (v as any)(ui.isEditing) : v;
      dispatch(scriptUiActions.setIsEditing({ value: Boolean(next) }));
    },
    [dispatch, ui.isEditing],
  );
  const toggleEditing = useCallback(() => dispatch(scriptUiActions.toggleEditing()), [dispatch]);

  const setSwapTheaterPanels: React.Dispatch<React.SetStateAction<boolean>> = useCallback(
    (v) => {
      const next = typeof v === "function" ? (v as any)(ui.swapTheaterPanels) : v;
      dispatch(scriptUiActions.setSwapTheaterPanels({ value: Boolean(next) }));
    },
    [dispatch, ui.swapTheaterPanels],
  );
  const togglePanels = useCallback(() => dispatch(scriptUiActions.togglePanels()), [dispatch]);

  return {
    showRequisites: ui.showRequisites,
    setShowRequisites,
    toggleRequisites,
    showPlaylistSidebar: ui.showPlaylistSidebar,
    setShowPlaylistSidebar,
    togglePlaylist,
    showHeaderSounds: ui.showHeaderSounds,
    setShowHeaderSounds,
    toggleHeaderSounds,
    showStepRoles: ui.showStepRoles,
    setShowStepRoles,
    toggleStepRoles,
    showScriptEditorTools: ui.showScriptEditorTools,
    setShowScriptEditorTools,
    toggleScriptEditorTools,
    isStepsCollapsed: ui.isStepsCollapsed,
    setIsStepsCollapsed,
    toggleStepsCollapsed,
    mobilePlaylistOpen: ui.mobilePlaylistOpen,
    setMobilePlaylistOpen,
    toggleMobilePlaylist,
    mobileStepsOpen: ui.mobileStepsOpen,
    setMobileStepsOpen,
    toggleMobileSteps,
    closeMobilePanels,
    isEditing: ui.isEditing,
    setIsEditing,
    toggleEditing,
    swapTheaterPanels: ui.swapTheaterPanels,
    setSwapTheaterPanels,
    togglePanels,
  };
}
