import React, { useCallback } from "react";
import type { ScriptStep, TheaterLayout } from "../../../shared/types/script";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { sceneActions, type SceneData, type SceneRoleLinkV1, type SceneRolesDataV1 } from "./scene-slice";
import { useSceneOperations } from "./scene-operations";
import { useSceneSyncEffects } from "./scene-sync-effects";
import {
  invokePlaylistPlay,
  invokeSoundToggle,
  registerPlaylistPlayHandler,
  registerSoundToggleHandler,
} from "./scene-playback-bridge";

type SetStateAction<T> = T | ((prev: T) => T);

export interface SceneContextValue {
  sceneData: SceneData | null;
  setSceneData: (next: SetStateAction<SceneData | null>) => void;
  setRoleAssignments: (next: Record<string, string[]>) => void;
  steps: ScriptStep[];
  setSteps: (next: SetStateAction<ScriptStep[]>) => void;
  updateStep: (id: number, changes: Partial<ScriptStep>) => void;
  resetAllRequisites: () => void;
  theaterLayout: TheaterLayout;
  setTheaterLayout: (next: SetStateAction<TheaterLayout>) => void;
  currentPage: number;
  setCurrentPage: (next: SetStateAction<number>) => void;
  isSceneReady: boolean;
  hasLocalEdits: boolean;
  realtimePullDeferred: boolean;
  realtimePullDeferredAt: string | null;
  realtimePullDeferredReason:
    | "local_edits"
    | "settings_pause"
    | "confirm_declined"
    | "remote_pending"
    | null;
  clearRealtimePullDeferred: () => void;
  addStep: (atPage?: number) => void;
  deleteStep: (id: number) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  saveStepsForLightPlot: (opts?: { force?: boolean }) => Promise<void>;
  pushSceneAfterSoundsSave: () => Promise<void>;
  syncFromServer: (token?: string | null, projectOverride?: string) => Promise<void>;
  registerPlaylistPlay: (handler: (trackId: number) => void) => void;
  handleTrackLinkClick: (trackId: number) => void;
  registerSoundToggle: (handler: (soundId: number) => void) => void;
  handleSoundLinkClick: (soundId: number) => void;
}

/** Mounts scene sync side-effects (Redux-backed, not React Context state). */
export function SceneSyncRunner({ children }: { children: React.ReactNode }) {
  useSceneSyncEffects();
  return <>{children}</>;
}

/** @deprecated Use SceneSyncRunner */
export const SceneProvider = SceneSyncRunner;

export function useScene(): SceneContextValue {
  const dispatch = useAppDispatch();
  const {
    sceneData,
    steps,
    theaterLayout,
    currentPage,
    isSceneReady,
    hasLocalEdits,
    realtimePullDeferred,
    realtimePullDeferredAt,
    realtimePullDeferredReason,
  } = useAppSelector((s) => s.scene);
  const { syncFromServer, saveStepsForLightPlot, pushSceneAfterSoundsSave } =
    useSceneOperations();

  const setSceneData = useCallback(
    (next: SetStateAction<SceneData | null>) => {
      const resolved = typeof next === "function" ? (next as (prev: SceneData | null) => SceneData | null)(sceneData) : next;
      dispatch(sceneActions.setSceneData(resolved));
    },
    [dispatch, sceneData],
  );

  const setRoleAssignments = useCallback(
    (next: Record<string, string[]>) => {
      dispatch(sceneActions.setRoleAssignments(next));
    },
    [dispatch],
  );

  const setSteps = useCallback(
    (next: SetStateAction<ScriptStep[]>) => {
      const resolved = typeof next === "function" ? (next as (prev: ScriptStep[]) => ScriptStep[])(steps) : next;
      dispatch(sceneActions.setSteps(resolved));
    },
    [dispatch, steps],
  );

  const updateStep = useCallback(
    (id: number, changes: Partial<ScriptStep>) => {
      dispatch(sceneActions.updateStep({ id, changes }));
    },
    [dispatch],
  );

  const resetAllRequisites = useCallback(() => {
    dispatch(sceneActions.resetAllRequisites());
  }, [dispatch]);

  const setTheaterLayout = useCallback(
    (next: SetStateAction<TheaterLayout>) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: TheaterLayout) => TheaterLayout)(theaterLayout)
          : next;
      dispatch(sceneActions.setTheaterLayout(resolved));
    },
    [dispatch, theaterLayout],
  );

  const setCurrentPage = useCallback(
    (next: SetStateAction<number>) => {
      const resolved = typeof next === "function" ? (next as (prev: number) => number)(currentPage) : next;
      dispatch(sceneActions.setCurrentPage(resolved));
    },
    [dispatch, currentPage],
  );

  const addStep = useCallback(() => dispatch(sceneActions.addStep()), [dispatch]);
  const deleteStep = useCallback((id: number) => dispatch(sceneActions.deleteStep(id)), [dispatch]);
  const reorderSteps = useCallback(
    (fromIndex: number, toIndex: number) => dispatch(sceneActions.reorderSteps({ fromIndex, toIndex })),
    [dispatch],
  );

  const registerPlaylistPlay = useCallback((handler: (trackId: number) => void) => {
    registerPlaylistPlayHandler(handler);
  }, []);

  const handleTrackLinkClick = useCallback((trackId: number) => {
    invokePlaylistPlay(trackId);
  }, []);

  const registerSoundToggle = useCallback((handler: (soundId: number) => void) => {
    registerSoundToggleHandler(handler);
  }, []);

  const handleSoundLinkClick = useCallback((soundId: number) => {
    invokeSoundToggle(soundId);
  }, []);

  const clearRealtimePullDeferred = useCallback(() => {
    dispatch(sceneActions.clearRealtimePullDeferred());
  }, [dispatch]);

  return {
    sceneData,
    setSceneData,
    setRoleAssignments,
    steps,
    setSteps,
    updateStep,
    resetAllRequisites,
    theaterLayout,
    setTheaterLayout,
    currentPage,
    setCurrentPage,
    isSceneReady,
    hasLocalEdits,
    realtimePullDeferred,
    realtimePullDeferredAt,
    realtimePullDeferredReason,
    clearRealtimePullDeferred,
    addStep,
    deleteStep,
    reorderSteps,
    saveStepsForLightPlot,
    pushSceneAfterSoundsSave,
    syncFromServer,
    registerPlaylistPlay,
    handleTrackLinkClick,
    registerSoundToggle,
    handleSoundLinkClick,
  };
}

export { DEFAULT_THEATER_LAYOUT } from "./scene-slice";
export type { SceneData, SceneRoleLinkV1, SceneRolesDataV1 };
