import React, { useCallback } from "react";
import type { ScriptScene, TheaterLayout } from "../../../shared/types/script";
import {
  markTheaterLayoutDraftDirty,
  writeTheaterLayoutDraft,
} from "../../theater/model/theater-layout-draft-storage";
import { useProject } from "../../project/model/project-context";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { isProjectorOutputWindow } from "../../projector/model/projector-playback-bridge";
import { store } from "../../../shared/store/store";
import {
  playbookActions,
  type PlaybookData,
  type PlaybookLightChannelRolesV1,
  type PlaybookLightFaderV1,
  type PlaybookLightFadersDataV1,
  type PlaybookLightProgramV1,
  type PlaybookLightProgramsDataV1,
  type PlaybookRoleLinkV1,
  type PlaybookRolesDataV1,
} from "./playbook-slice";
import type { BrowserPickedScan } from "../../../shared/platform/browser-picked-media";
import type { ProjectMediaScan } from "../../../shared/platform/project-media-folder";
import { usePlaybookOperations } from "./playbook-operations";
import { usePlaybookSyncEffects } from "./playbook-sync-effects";
import {
  invokePlaylistPlay,
  invokeSoundToggle,
  registerPlaylistPlayHandler,
  registerSoundToggleHandler,
  type PlaylistPlayOptions,
} from "./playbook-playback-bridge";
import type { ProjectorMediaOfflineDownloadResult } from "../../../sync/desktopProjectorMediaOffline";

type SetStateAction<T> = T | ((prev: T) => T);

export interface PlaybookContextValue {
  playbookData: PlaybookData | null;
  setPlaybookData: (next: SetStateAction<PlaybookData | null>) => void;
  setRoleAssignments: (next: Record<string, string[]>) => void;
  scenes: ScriptScene[];
  setScenes: (next: SetStateAction<ScriptScene[]>) => void;
  updateScene: (id: number, changes: Partial<ScriptScene>) => void;
  resetAllRequisites: () => void;
  theaterLayout: TheaterLayout;
  setTheaterLayout: (next: SetStateAction<TheaterLayout>) => void;
  currentPage: number;
  setCurrentPage: (next: SetStateAction<number>) => void;
  isPlaybookReady: boolean;
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
  addScene: (atPage?: number) => void;
  seedScenarioFromPlayText: (text: string) => void;
  splitSceneFromSelection: (args: {
    sourceSceneId: number;
    targetField: "markdown" | "playMarkdown" | "explicationMarkdown";
    selectedText: string;
    trimmedSourceText: string;
  }) => void;
  deleteScene: (id: number) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  saveScenesForLightPlot: (opts?: { force?: boolean }) => Promise<void>;
  pushPlaybookAfterSoundsSave: () => Promise<void>;
  syncFromServer: (token?: string | null, projectOverride?: string) => Promise<void>;
  downloadProjectorMediaForOffline: (opts?: {
    onProgress?: (current: number, total: number, label: string) => void;
  }) => Promise<ProjectorMediaOfflineDownloadResult>;
  syncAndDownloadProjectorMediaForOffline: (opts?: {
    onProgress?: (current: number, total: number, label: string) => void;
  }) => Promise<ProjectorMediaOfflineDownloadResult>;
  importDevMediaFolder: (opts?: {
    force?: boolean;
    scanned?: ProjectMediaScan | BrowserPickedScan;
    pickIfMissing?: boolean;
  }) => Promise<{
    message: string;
    videos: import("./playbook-slice").PlaybookVideo[];
    holdImages: import("./playbook-slice").PlaybookHoldImage[];
  }>;
  registerPlaylistPlay: (handler: (trackId: number, options?: PlaylistPlayOptions) => void) => void;
  handleTrackLinkClick: (trackId: number, options?: PlaylistPlayOptions) => void;
  registerSoundToggle: (handler: (soundId: number) => void) => void;
  handleSoundLinkClick: (soundId: number) => void;
}

function PlaybookSyncRunnerActive({ children }: { children: React.ReactNode }) {
  usePlaybookSyncEffects();
  return <>{children}</>;
}

/**
 * Mounts scene sync side-effects (Redux-backed, not React Context state).
 * Окно проектора (/projector-output) — отдельный window.open с пустым Redux;
 * sync там не нужен и опасен (может затереть сервер устаревшим diff).
 */
export function PlaybookSyncRunner({ children }: { children: React.ReactNode }) {
  if (isProjectorOutputWindow()) {
    return <>{children}</>;
  }

  return <PlaybookSyncRunnerActive>{children}</PlaybookSyncRunnerActive>;
}

export function usePlaybook(): PlaybookContextValue {
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const {
    playbookData,
    scenes,
    theaterLayout,
    currentPage,
    isPlaybookReady,
    hasLocalEdits,
    realtimePullDeferred,
    realtimePullDeferredAt,
    realtimePullDeferredReason,
  } = useAppSelector((s) => s.playbook);
  const { syncFromServer, saveScenesForLightPlot, pushPlaybookAfterSoundsSave, downloadProjectorMediaForOffline, syncAndDownloadProjectorMediaForOffline, importDevMediaFolder } =
    usePlaybookOperations();

  const setPlaybookData = useCallback(
    (next: SetStateAction<PlaybookData | null>) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: PlaybookData | null) => PlaybookData | null)(store.getState().playbook.playbookData)
          : next;
      dispatch(playbookActions.setPlaybookData(resolved));
    },
    [dispatch],
  );

  const setRoleAssignments = useCallback(
    (next: Record<string, string[]>) => {
      dispatch(playbookActions.setRoleAssignments(next));
    },
    [dispatch],
  );

  const setScenes = useCallback(
    (next: SetStateAction<ScriptScene[]>) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: ScriptScene[]) => ScriptScene[])(store.getState().playbook.scenes)
          : next;
      dispatch(playbookActions.setScenes(resolved));
    },
    [dispatch],
  );

  const updateScene = useCallback(
    (id: number, changes: Partial<ScriptScene>) => {
      dispatch(playbookActions.updateScene({ id, changes }));
    },
    [dispatch],
  );

  const resetAllRequisites = useCallback(() => {
    dispatch(playbookActions.resetAllRequisites());
  }, [dispatch]);

  const setTheaterLayout = useCallback(
    (next: SetStateAction<TheaterLayout>) => {
      dispatch(playbookActions.setTheaterLayout(next));
      if (projectName) {
        markTheaterLayoutDraftDirty(projectName);
        writeTheaterLayoutDraft(projectName, store.getState().playbook.theaterLayout);
      }
    },
    [dispatch, projectName],
  );

  const setCurrentPage = useCallback(
    (next: SetStateAction<number>) => {
      const resolved = typeof next === "function" ? (next as (prev: number) => number)(currentPage) : next;
      dispatch(playbookActions.setCurrentPage(resolved));
    },
    [dispatch, currentPage],
  );

  const addScene = useCallback(() => dispatch(playbookActions.addScene()), [dispatch]);
  const seedScenarioFromPlayText = useCallback(
    (text: string) => dispatch(playbookActions.seedScenarioFromPlayText({ text })),
    [dispatch],
  );
  const splitSceneFromSelection = useCallback(
    (args: {
      sourceSceneId: number;
      targetField: "markdown" | "playMarkdown" | "explicationMarkdown";
      selectedText: string;
      trimmedSourceText: string;
    }) => {
      dispatch(playbookActions.splitSceneFromSelection(args));
    },
    [dispatch],
  );
  const deleteScene = useCallback((id: number) => dispatch(playbookActions.deleteScene(id)), [dispatch]);
  const reorderScenes = useCallback(
    (fromIndex: number, toIndex: number) => dispatch(playbookActions.reorderScenes({ fromIndex, toIndex })),
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
    dispatch(playbookActions.clearRealtimePullDeferred());
  }, [dispatch]);

  return {
    playbookData,
    setPlaybookData,
    setRoleAssignments,
    scenes,
    setScenes,
    updateScene,
    resetAllRequisites,
    theaterLayout,
    setTheaterLayout,
    currentPage,
    setCurrentPage,
    isPlaybookReady,
    hasLocalEdits,
    realtimePullDeferred,
    realtimePullDeferredAt,
    realtimePullDeferredReason,
    clearRealtimePullDeferred,
    addScene,
    seedScenarioFromPlayText,
    splitSceneFromSelection,
    deleteScene,
    reorderScenes,
    saveScenesForLightPlot,
    pushPlaybookAfterSoundsSave,
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

export { DEFAULT_THEATER_LAYOUT } from "./playbook-slice";
export type {
  PlaybookData,
  PlaybookLightChannelRolesV1,
  PlaybookLightFaderV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramV1,
  PlaybookLightProgramsDataV1,
  PlaybookRoleLinkV1,
  PlaybookRolesDataV1,
};
