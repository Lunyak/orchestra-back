import type React from "react";
import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { scriptUiActions, selectScriptUi } from "./script-ui-slice";

export interface ScriptUIContextValue {
  showPlaylistSidebar: boolean;
  setShowPlaylistSidebar: (v: boolean | ((prev: boolean) => boolean)) => void;
  togglePlaylist: () => void;
  showHeaderSounds: boolean;
  setShowHeaderSounds: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleHeaderSounds: () => void;
  isScenesCollapsed: boolean;
  setIsScenesCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleScenesCollapsed: () => void;
  mobilePlaylistOpen: boolean;
  setMobilePlaylistOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleMobilePlaylist: () => void;
  mobileScenesOpen: boolean;
  setMobileScenesOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleMobileScenes: () => void;
  closeMobilePanels: () => void;
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  toggleEditing: () => void;
  swapTheaterPanels: boolean;
  setSwapTheaterPanels: React.Dispatch<React.SetStateAction<boolean>>;
  togglePanels: () => void;
  showTheaterControls: boolean;
  setShowTheaterControls: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleTheaterControls: () => void;
}

type BoolUpdater = boolean | ((prev: boolean) => boolean);

function resolveBoolUpdate(prev: boolean, v: BoolUpdater): boolean {
  return typeof v === "function" ? v(prev) : v;
}

export function useScriptUI(): ScriptUIContextValue {
  const dispatch = useAppDispatch();
  const ui = useAppSelector(selectScriptUi);

  const setShowPlaylistSidebar = useCallback(
    (v: BoolUpdater) => {
      dispatch(
        scriptUiActions.setShowPlaylistSidebar({
          value: Boolean(resolveBoolUpdate(ui.showPlaylistSidebar, v)),
        }),
      );
    },
    [dispatch, ui.showPlaylistSidebar],
  );
  const togglePlaylist = useCallback(() => dispatch(scriptUiActions.togglePlaylist()), [dispatch]);

  const setShowHeaderSounds = useCallback(
    (v: BoolUpdater) => {
      dispatch(
        scriptUiActions.setShowHeaderSounds({
          value: Boolean(resolveBoolUpdate(ui.showHeaderSounds, v)),
        }),
      );
    },
    [dispatch, ui.showHeaderSounds],
  );
  const toggleHeaderSounds = useCallback(
    () => dispatch(scriptUiActions.toggleHeaderSounds()),
    [dispatch],
  );

  const setIsScenesCollapsed = useCallback(
    (v: BoolUpdater) => {
      dispatch(
        scriptUiActions.setIsScenesCollapsed({
          value: Boolean(resolveBoolUpdate(ui.isScenesCollapsed, v)),
        }),
      );
    },
    [dispatch, ui.isScenesCollapsed],
  );
  const toggleScenesCollapsed = useCallback(
    () => dispatch(scriptUiActions.toggleScenesCollapsed()),
    [dispatch],
  );

  const setMobilePlaylistOpen = useCallback(
    (v: BoolUpdater) => {
      dispatch(
        scriptUiActions.setMobilePlaylistOpen({
          value: Boolean(resolveBoolUpdate(ui.mobilePlaylistOpen, v)),
        }),
      );
    },
    [dispatch, ui.mobilePlaylistOpen],
  );
  const toggleMobilePlaylist = useCallback(
    () => dispatch(scriptUiActions.toggleMobilePlaylist()),
    [dispatch],
  );

  const setMobileScenesOpen = useCallback(
    (v: BoolUpdater) => {
      dispatch(
        scriptUiActions.setMobileScenesOpen({
          value: Boolean(resolveBoolUpdate(ui.mobileScenesOpen, v)),
        }),
      );
    },
    [dispatch, ui.mobileScenesOpen],
  );
  const toggleMobileScenes = useCallback(
    () => dispatch(scriptUiActions.toggleMobileScenes()),
    [dispatch],
  );
  const closeMobilePanels = useCallback(
    () => dispatch(scriptUiActions.closeMobilePanels()),
    [dispatch],
  );

  const setIsEditing: React.Dispatch<React.SetStateAction<boolean>> = useCallback(
    (v) => {
      dispatch(
        scriptUiActions.setIsEditing({
          value: Boolean(resolveBoolUpdate(ui.isEditing, v)),
        }),
      );
    },
    [dispatch, ui.isEditing],
  );
  const toggleEditing = useCallback(() => dispatch(scriptUiActions.toggleEditing()), [dispatch]);

  const setSwapTheaterPanels: React.Dispatch<React.SetStateAction<boolean>> = useCallback(
    (v) => {
      dispatch(
        scriptUiActions.setSwapTheaterPanels({
          value: Boolean(resolveBoolUpdate(ui.swapTheaterPanels, v)),
        }),
      );
    },
    [dispatch, ui.swapTheaterPanels],
  );
  const togglePanels = useCallback(() => dispatch(scriptUiActions.togglePanels()), [dispatch]);

  const setShowTheaterControls = useCallback(
    (v: BoolUpdater) => {
      dispatch(
        scriptUiActions.setShowTheaterControls({
          value: Boolean(resolveBoolUpdate(ui.showTheaterControls, v)),
        }),
      );
    },
    [dispatch, ui.showTheaterControls],
  );
  const toggleTheaterControls = useCallback(
    () => dispatch(scriptUiActions.toggleTheaterControls()),
    [dispatch],
  );

  return {
    showPlaylistSidebar: ui.showPlaylistSidebar,
    setShowPlaylistSidebar,
    togglePlaylist,
    showHeaderSounds: ui.showHeaderSounds,
    setShowHeaderSounds,
    toggleHeaderSounds,
    isScenesCollapsed: ui.isScenesCollapsed,
    setIsScenesCollapsed,
    toggleScenesCollapsed,
    mobilePlaylistOpen: ui.mobilePlaylistOpen,
    setMobilePlaylistOpen,
    toggleMobilePlaylist,
    mobileScenesOpen: ui.mobileScenesOpen,
    setMobileScenesOpen,
    toggleMobileScenes,
    closeMobilePanels,
    isEditing: ui.isEditing,
    setIsEditing,
    toggleEditing,
    swapTheaterPanels: ui.swapTheaterPanels,
    setSwapTheaterPanels,
    togglePanels,
    showTheaterControls: ui.showTheaterControls,
    setShowTheaterControls,
    toggleTheaterControls,
  };
}
