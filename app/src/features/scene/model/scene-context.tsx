import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { ScriptStep, TheaterLayout } from "../../../shared/types/script";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { pruneSceneImages } from "../../../shared/utils/markdownImages";
import { createId } from "../../../shared/utils/createId";
import { syncPull, syncPush, type SyncChange } from "../../../sync/api";
import { flushDesktopOutbox } from "../../../sync/desktopOutbox";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../../project/model/project-context";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import {
  DEFAULT_THEATER_LAYOUT,
  sceneActions,
  type SceneData,
} from "./scene-slice";

type SetStateAction<T> = T | ((prev: T) => T);

let playlistPlayHandler: ((trackId: number) => void) | undefined;

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
  addStep: (atPage?: number) => void;
  deleteStep: (id: number) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  saveStepsForLightPlot: (opts?: { force?: boolean }) => Promise<void>;
  pushSceneAfterSoundsSave: () => Promise<void>;
  syncFromServer: (token?: string | null, projectOverride?: string) => Promise<void>;
  registerPlaylistPlay: (handler: (trackId: number) => void) => void;
  handleTrackLinkClick: (trackId: number) => void;
}

function useSceneOperations() {
  const dispatch = useAppDispatch();
  const { accessToken, setAccessToken } = useAuth();
  const { projectName, ensureRemoteProject } = useProject();

  const { sceneData, steps, theaterLayout, hasLocalEdits } = useAppSelector(
    (s) => s.scene,
  );
  const showScriptUi = useAppSelector((s) =>
    selectShowScriptMarkdownUi(s, projectName || "fools", "script"),
  );

  const syncFromServer = useCallback(
    async (token?: string | null, projectOverride?: string) => {
      const tokenToUse =
        token ??
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("accessToken")
          : null) ??
        accessToken;
      const effectiveProject = projectOverride ?? projectName;
      if (!tokenToUse || !effectiveProject) return;

      const projectId = await ensureRemoteProject(tokenToUse);
      if (!projectId) return;

      const perProjectKey = `lastSyncAt:${effectiveProject}`;
      const effectiveLastSyncAt =
        localStorage.getItem(perProjectKey) ??
        localStorage.getItem("lastSyncAt") ??
        null;

      try {
        const { now, projects, scenes } = await syncPull(
          tokenToUse,
          effectiveLastSyncAt,
          effectiveProject,
        );
        const project = projects.find((p: any) => p.slug === effectiveProject);
        if (!project) return;
        const scene = scenes.find((s: any) => s.projectId === project.id);
        if (!scene) return;
        const raw = (scene.rawJson as any) ?? {};
        dispatch(
          sceneActions.hydrateScene({
            sceneData: raw || null,
            theaterLayout: raw.theaterLayout || DEFAULT_THEATER_LAYOUT,
            steps: raw.steps?.length ? raw.steps : steps,
            isSceneReady: true,
          }),
        );
        localStorage.setItem("lastSyncAt", now);
        localStorage.setItem(perProjectKey, now);
      } catch (error: any) {
        if (error?.response?.status === 401) {
          setAccessToken(null);
          return;
        }
        console.error("[sync] pull failed:", error);
      }
    },
    [
      accessToken,
      projectName,
      ensureRemoteProject,
      setAccessToken,
      dispatch,
      steps,
    ],
  );

  const saveStepsForLightPlot = useCallback(async (opts?: { force?: boolean }) => {
    if (!projectName) return;
    const shouldSave = hasLocalEdits || Boolean(opts?.force);
    if (!shouldSave) return;
    const desktopApi = getDesktopApi();
    const token = accessToken ?? localStorage.getItem("accessToken");

    try {
      const current =
        sceneData ??
        (desktopApi ? await desktopApi.readProjectScene(projectName, "script") : null);

      const images = pruneSceneImages(
        (current as any)?.images as
          | Record<string, { remoteKey?: string; remoteUrl?: string }>
          | undefined,
        steps,
      );
      const payload: any = {
        ...(current ?? {}),
        steps,
        theaterLayout,
        images,
        lightChannels: showScriptUi.lightChannels,
      };

      if (desktopApi) {
        const result = await desktopApi.saveProjectScene(projectName, "script", payload);
        if (!result?.ok) {
          console.error("Failed to save scene:", result?.error);
        }
      }

      if (token) {
        // Desktop path: deltas are enqueued by saveProjectScene; push only outbox.
        if (desktopApi) {
          try {
            await flushDesktopOutbox(token, projectName);
            dispatch(sceneActions.markSaved());
          } catch (err) {
            console.error("[sync] desktop outbox flush failed:", err);
          }
          return;
        }

        const projectId =
          localStorage.getItem(`projectId:${projectName}`) ??
          (await ensureRemoteProject(token));
        if (projectId) {
          const sceneId = `${projectId}:script`;
          const nowIso = new Date().toISOString();
          let payloadForServer: any = { ...payload };

          let serverSounds: any[] = [];
          try {
            const pull = await syncPull(token, null, projectName);
            const serverScene = pull.scenes?.find((sc: any) => sc.id === sceneId);
            if (serverScene?.rawJson?.sounds) serverSounds = serverScene.rawJson.sounds;
          } catch (_) {}

          if (payloadForServer.sounds?.length) {
            payloadForServer.sounds = payloadForServer.sounds.map((s: any) => {
              const { filePath: _fp, ...rest } = s;
              const sound = { ...rest };
              if ((!sound.remoteKey || !sound.remoteUrl) && serverSounds.length > 0) {
                const server = serverSounds.find((ss: any) => ss.id === s.id);
                if (server?.remoteKey) sound.remoteKey = server.remoteKey;
                if (server?.remoteUrl) sound.remoteUrl = server.remoteUrl;
              }
              return sound;
            });
          }

          const changes: SyncChange[] = [
            {
              id: createId(),
              entityType: "Scene",
              entityId: sceneId,
              operation: "update",
              payload: {
                id: sceneId,
                projectId,
                name: payloadForServer.name || `Сцена ${projectName}`,
                rawJson: payloadForServer,
                updatedAt: nowIso,
              },
              createdAt: nowIso,
            },
          ];

          const existingSteps: ScriptStep[] =
            (Array.isArray((current as any)?.steps)
              ? ((current as any).steps as ScriptStep[])
              : []) ?? [];
          const existingIds = new Set(existingSteps.map((s) => s.id));
          const newIds = new Set(steps.map((s) => s.id));
          steps.forEach((step, index) => {
            const stepKey = `${sceneId}:${step.id}`;
            changes.push({
              id: createId(),
              entityType: "Step",
              entityId: stepKey,
              operation: existingIds.has(step.id) ? "update" : "create",
              payload: {
                id: stepKey,
                sceneId,
                sourceId: step.id,
                title: step.title,
                markdown: step.markdown ?? "",
                playMarkdown: step.playMarkdown ?? null,
                order: index,
                updatedAt: nowIso,
              },
              createdAt: nowIso,
            });
          });
          existingIds.forEach((id) => {
            if (!newIds.has(id)) {
              changes.push({
                id: createId(),
                entityType: "Step",
                entityId: `${sceneId}:${id}`,
                operation: "delete",
                payload: { id: `${sceneId}:${id}`, updatedAt: nowIso },
                createdAt: nowIso,
              });
            }
          });

          if (changes.length > 0) {
            await syncPush(token, changes);
            dispatch(sceneActions.markSaved());
          }
        }
      }
    } catch (error) {
      console.error("Failed to save/push scene:", error);
    }
  }, [
    projectName,
    hasLocalEdits,
    accessToken,
    sceneData,
    steps,
    theaterLayout,
    ensureRemoteProject,
    dispatch,
    showScriptUi.lightChannels,
  ]);

  const pushSceneAfterSoundsSave = useCallback(async () => {
    const desktopApi = getDesktopApi();
    if (!desktopApi) return;
    const token = accessToken ?? localStorage.getItem("accessToken");
    if (!token || !projectName) return;
    try {
      await flushDesktopOutbox(token, projectName);
    } catch (error) {
      console.error("[sync] desktop outbox flush after sounds save failed:", error);
    }
  }, [accessToken, projectName, ensureRemoteProject]);

  return { syncFromServer, saveStepsForLightPlot, pushSceneAfterSoundsSave };
}

function useSceneProviderEffects() {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const { syncFromServer, saveStepsForLightPlot } = useSceneOperations();

  const { steps, currentPage, isSceneReady, theaterLayout, sceneData, hasLocalEdits, stepsRevision } =
    useAppSelector((s) => s.scene);
  const sceneDataRevision = useAppSelector((s) => s.scene.sceneDataRevision);
  const showScriptUi = useAppSelector((s) =>
    selectShowScriptMarkdownUi(s, projectName || "fools", "script"),
  );

  const selectedStepIdRef = useRef<number | null>(null);
  const restoredProjectRef = useRef<string | null>(null);
  const lightPlotSaveTimerRef = useRef<number | null>(null);
  const lastSyncedKeyRef = useRef<string | null>(null);
  const lastSavedLightChannelsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectName) return;
    dispatch(sceneActions.resetForProject());
    selectedStepIdRef.current = null;
    restoredProjectRef.current = null;

    let cancelled = false;
    const loadScene = async () => {
      const desktopApi = getDesktopApi();
      if (!desktopApi) {
        if (cancelled) return;
        dispatch(
          sceneActions.hydrateScene({
            sceneData: null,
            theaterLayout: DEFAULT_THEATER_LAYOUT,
            steps: [],
            currentPage: 0,
            isSceneReady: true,
          }),
        );
        return;
      }
      try {
        const scene = await desktopApi.readProjectScene(projectName, "script");
        if (cancelled) return;
        dispatch(
          sceneActions.hydrateScene({
            sceneData: scene || null,
            theaterLayout: scene?.theaterLayout ?? DEFAULT_THEATER_LAYOUT,
            steps: scene?.steps ?? [],
            currentPage: 0,
            isSceneReady: true,
          }),
        );
        selectedStepIdRef.current = null;
        restoredProjectRef.current = null;
      } catch (error) {
        if (!cancelled) {
          dispatch(
            sceneActions.hydrateScene({
              sceneData: null,
              theaterLayout: DEFAULT_THEATER_LAYOUT,
              steps: [],
              currentPage: 0,
              isSceneReady: false,
            }),
          );
        }
      }
    };
    void loadScene();
    return () => {
      cancelled = true;
    };
  }, [projectName, dispatch]);

  useEffect(() => {
    if (!accessToken || !projectName) return;
    const key = `${accessToken}:${projectName}`;
    if (lastSyncedKeyRef.current === key) return;
    lastSyncedKeyRef.current = key;
    void syncFromServer(accessToken, projectName);
  }, [accessToken, projectName, syncFromServer]);

  useEffect(() => {
    selectedStepIdRef.current = steps[currentPage]?.id ?? null;
  }, [projectName, steps, currentPage]);

  useEffect(() => {
    if (steps.length === 0) {
      if (currentPage !== 0) dispatch(sceneActions.setCurrentPage(0));
      return;
    }

    if (projectName && restoredProjectRef.current !== projectName) {
      const storedIdRaw = localStorage.getItem(`selectedStepId:${projectName}`);
      const storedId = storedIdRaw ? Number(storedIdRaw) : null;
      if (storedId != null) {
        const idx = steps.findIndex((s) => s.id === storedId);
        if (idx !== -1 && idx !== currentPage) dispatch(sceneActions.setCurrentPage(idx));
      }
      restoredProjectRef.current = projectName;
      return;
    }

    const selectedId = selectedStepIdRef.current;
    if (selectedId != null) {
      const nextIndex = steps.findIndex((s) => s.id === selectedId);
      if (nextIndex !== -1 && nextIndex !== currentPage) {
        dispatch(sceneActions.setCurrentPage(nextIndex));
        return;
      }
    }

    if (currentPage > steps.length - 1) {
      dispatch(sceneActions.setCurrentPage(steps.length - 1));
    }
  }, [projectName, steps, currentPage, dispatch]);

  useEffect(() => {
    if (!projectName) return;
    const selectedId = steps[currentPage]?.id;
    if (selectedId != null) {
      localStorage.setItem(`selectedStepId:${projectName}`, String(selectedId));
    }
  }, [projectName, steps, currentPage]);

  const roleAssignmentsKey = useMemo(
    () => JSON.stringify((sceneData as any)?.roleAssignments ?? null),
    [sceneData],
  );

  const lightChannelsKey = useMemo(
    () => JSON.stringify(showScriptUi.lightChannels ?? null),
    [showScriptUi.lightChannels],
  );

  useEffect(() => {
    if (!isSceneReady || steps.length === 0) return;
    if (lastSavedLightChannelsKeyRef.current === null) {
      lastSavedLightChannelsKeyRef.current = lightChannelsKey;
    }
    const metaChanged = lastSavedLightChannelsKeyRef.current !== lightChannelsKey;
    const shouldSave = hasLocalEdits || metaChanged;
    if (!shouldSave) return;
    const shouldForceSaveMeta = metaChanged && !hasLocalEdits;
    if (lightPlotSaveTimerRef.current) {
      window.clearTimeout(lightPlotSaveTimerRef.current);
    }
    lightPlotSaveTimerRef.current = window.setTimeout(() => {
      void saveStepsForLightPlot({ force: shouldForceSaveMeta });
      lastSavedLightChannelsKeyRef.current = lightChannelsKey;
    }, 600);
    return () => {
      if (lightPlotSaveTimerRef.current) {
        window.clearTimeout(lightPlotSaveTimerRef.current);
      }
    };
  }, [
    isSceneReady,
    steps.length,
    stepsRevision,
    sceneDataRevision,
    theaterLayout,
    roleAssignmentsKey,
    hasLocalEdits,
    lightChannelsKey,
    saveStepsForLightPlot,
  ]);
}

export function SceneProvider({ children }: { children: React.ReactNode }) {
  useSceneProviderEffects();
  return <>{children}</>;
}

export function useScene(): SceneContextValue {
  const dispatch = useAppDispatch();
  const { sceneData, steps, theaterLayout, currentPage, isSceneReady } = useAppSelector(
    (s) => s.scene,
  );
  const { syncFromServer, saveStepsForLightPlot, pushSceneAfterSoundsSave } =
    useSceneOperations();

  const setSceneData = useCallback(
    (next: SetStateAction<SceneData | null>) => {
      const resolved = typeof next === "function" ? (next as any)(sceneData) : next;
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
      const resolved = typeof next === "function" ? (next as any)(steps) : next;
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
      const resolved = typeof next === "function" ? (next as any)(theaterLayout) : next;
      dispatch(sceneActions.setTheaterLayout(resolved));
    },
    [dispatch, theaterLayout],
  );

  const setCurrentPage = useCallback(
    (next: SetStateAction<number>) => {
      const resolved = typeof next === "function" ? (next as any)(currentPage) : next;
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
    playlistPlayHandler = handler;
  }, []);

  const handleTrackLinkClick = useCallback((trackId: number) => {
    playlistPlayHandler?.(trackId);
  }, []);

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
    addStep,
    deleteStep,
    reorderSteps,
    saveStepsForLightPlot,
    pushSceneAfterSoundsSave,
    syncFromServer,
    registerPlaylistPlay,
    handleTrackLinkClick,
  };
}

export { DEFAULT_THEATER_LAYOUT };
export type { SceneData };

