import React, { useCallback } from "react";
import type { ScriptStep, TheaterLayout } from "../../../shared/types/script";
import {
  markTheaterLayoutDraftDirty,
  writeTheaterLayoutDraft,
} from "../../theater/model/theater-layout-draft-storage";
import { useProject } from "../../project/model/project-context";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { isProjectorOutputWindow } from "../../projector/model/projector-playback-bridge";
import { store } from "../../../shared/store/store";
import {
  sceneActions,
  type SceneData,
  type SceneLightChannelRolesV1,
  type SceneLightFaderV1,
  type SceneLightFadersDataV1,
  type SceneLightProgramV1,
  type SceneLightProgramsDataV1,
  type SceneRoleLinkV1,
  type SceneRolesDataV1,
} from "./scene-slice";
import { useSceneOperations } from "./scene-operations";
import { useSceneSyncEffects } from "./scene-sync-effects";
import {
  invokePlaylistPlay,
  invokeSoundToggle,
  registerPlaylistPlayHandler,
  registerSoundToggleHandler,
  type PlaylistPlayOptions,
} from "./scene-playback-bridge";
import type { ProjectorMediaOfflineDownloadResult } from "../../../sync/desktopProjectorMediaOffline";

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
  seedScenarioFromPlayText: (text: string) => void;
  splitStepFromSelection: (args: {
    sourceStepId: number;
    targetField: "markdown" | "playMarkdown" | "explicationMarkdown";
    selectedText: string;
    trimmedSourceText: string;
  }) => void;
  deleteStep: (id: number) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  saveStepsForLightPlot: (opts?: { force?: boolean }) => Promise<void>;
  pushSceneAfterSoundsSave: () => Promise<void>;
  syncFromServer: (token?: string | null, projectOverride?: string) => Promise<void>;
  downloadProjectorMediaForOffline: (opts?: {
    onProgress?: (current: number, total: number, label: string) => void;
  }) => Promise<ProjectorMediaOfflineDownloadResult>;
  syncAndDownloadProjectorMediaForOffline: (opts?: {
    onProgress?: (current: number, total: number, label: string) => void;
  }) => Promise<ProjectorMediaOfflineDownloadResult>;
  importDevMediaFolder: (opts?: { force?: boolean }) => Promise<{
    message: string;
    videos: import("./scene-slice").SceneVideo[];
    holdImages: import("./scene-slice").SceneHoldImage[];
  }>;
  registerPlaylistPlay: (handler: (trackId: number, options?: PlaylistPlayOptions) => void) => void;
  handleTrackLinkClick: (trackId: number, options?: PlaylistPlayOptions) => void;
  registerSoundToggle: (handler: (soundId: number) => void) => void;
  handleSoundLinkClick: (soundId: number) => void;
}

function SceneSyncRunnerActive({ children }: { children: React.ReactNode }) {
  useSceneSyncEffects();
  return <>{children}</>;
}

/**
 * Mounts scene sync side-effects (Redux-backed, not React Context state).
 * Окно проектора (/projector-output) — отдельный window.open с пустым Redux;
 * sync там не нужен и опасен (может затереть сервер устаревшим diff).
 */
export function SceneSyncRunner({ children }: { children: React.ReactNode }) {
  if (isProjectorOutputWindow()) {
    return <>{children}</>;
  }

  return <SceneSyncRunnerActive>{children}</SceneSyncRunnerActive>;
}

/** @deprecated Use SceneSyncRunner */
export const SceneProvider = SceneSyncRunner;

export function useScene(): SceneContextValue {
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
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
  const { syncFromServer, saveStepsForLightPlot, pushSceneAfterSoundsSave, downloadProjectorMediaForOffline, syncAndDownloadProjectorMediaForOffline, importDevMediaFolder } =
    useSceneOperations();

  const setSceneData = useCallback(
    (next: SetStateAction<SceneData | null>) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: SceneData | null) => SceneData | null)(store.getState().scene.sceneData)
          : next;
      dispatch(sceneActions.setSceneData(resolved));
    },
    [dispatch],
  );

  const setRoleAssignments = useCallback(
    (next: Record<string, string[]>) => {
      dispatch(sceneActions.setRoleAssignments(next));
    },
    [dispatch],
  );

  const setSteps = useCallback(
    (next: SetStateAction<ScriptStep[]>) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: ScriptStep[]) => ScriptStep[])(store.getState().scene.steps)
          : next;
      dispatch(sceneActions.setSteps(resolved));
    },
    [dispatch],
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
      dispatch(sceneActions.setTheaterLayout(next));
      if (projectName) {
        markTheaterLayoutDraftDirty(projectName);
        writeTheaterLayoutDraft(projectName, store.getState().scene.theaterLayout);
      }
    },
    [dispatch, projectName],
  );

  const setCurrentPage = useCallback(
    (next: SetStateAction<number>) => {
      const resolved = typeof next === "function" ? (next as (prev: number) => number)(currentPage) : next;
      dispatch(sceneActions.setCurrentPage(resolved));
    },
    [dispatch, currentPage],
  );

  const addStep = useCallback(() => dispatch(sceneActions.addStep()), [dispatch]);
  const seedScenarioFromPlayText = useCallback(
    (text: string) => dispatch(sceneActions.seedScenarioFromPlayText({ text })),
    [dispatch],
  );
  const splitStepFromSelection = useCallback(
    (args: {
      sourceStepId: number;
      targetField: "markdown" | "playMarkdown" | "explicationMarkdown";
      selectedText: string;
      trimmedSourceText: string;
    }) => {
      dispatch(sceneActions.splitStepFromSelection(args));
    },
    [dispatch],
  );
  const deleteStep = useCallback((id: number) => dispatch(sceneActions.deleteStep(id)), [dispatch]);
  const reorderSteps = useCallback(
    (fromIndex: number, toIndex: number) => dispatch(sceneActions.reorderSteps({ fromIndex, toIndex })),
    [dispatch],
  );

  const registerPlaylistPlay = useCallback(
    (handler: (trackId: number, options?: PlaylistPlayOptions) => void) => {
      registerPlaylistPlayHandler(handler);
    },
    [],
  );

  const handleTrackLinkClick = useCallback((trackId: number, options?: PlaylistPlayOptions) => {
    invokePlaylistPlay(trackId, options);
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
    seedScenarioFromPlayText,
    splitStepFromSelection,
    deleteStep,
    reorderSteps,
    saveStepsForLightPlot,
    pushSceneAfterSoundsSave,
    syncFromServer,
    downloadProjectorMediaForOffline,
    syncAndDownloadProjectorMediaForOffline,
    importDevMediaFolder,
    registerPlaylistPlay,
    handleTrackLinkClick,
    registerSoundToggle,
    handleSoundLinkClick,
  };
}

export { DEFAULT_THEATER_LAYOUT } from "./scene-slice";
export type {
  SceneData,
  SceneLightChannelRolesV1,
  SceneLightFaderV1,
  SceneLightFadersDataV1,
  SceneLightProgramV1,
  SceneLightProgramsDataV1,
  SceneRoleLinkV1,
  SceneRolesDataV1,
};
