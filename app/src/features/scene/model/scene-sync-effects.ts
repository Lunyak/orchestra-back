import { useEffect, useMemo, useRef } from "react";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { desktopReadProjectScene } from "../../../shared/platform/desktop-methods";
import { stableStringify } from "../../../shared/utils/stableStringify";
import {
  getConfirmBeforeRemoteScenePull,
  getPauseRemoteSceneUpdates,
} from "../../../shared/settings/syncPreferences";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { disconnectRealtimeSocket, getRealtimeSocket } from "../../../realtime/socket";
import { getClientInstanceId } from "../../../realtime/clientInstanceId";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../../project/model/project-context";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import { normalizePersistedTheaterLayout } from "../../theater/model/theater-metrics";
import { resolveInitialTheaterLayout } from "../../theater/model/theater-layout-draft-storage";
import { applySceneFaderBindingsToSpotlights } from "../../theater/model/theater-light-fader-bindings";
import { sceneActions, DEFAULT_THEATER_LAYOUT } from "./scene-slice";
import { loadSceneRolesFromStorage, saveSceneRolesToStorage } from "./scene-roles-storage";
import { useSceneOperations } from "./scene-operations";

export function useSceneSyncEffects() {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const { projectName, ensureRemoteProject } = useProject();
  const { syncFromServer, saveStepsForLightPlot } = useSceneOperations();

  const {
    steps,
    currentPage,
    isSceneReady,
    theaterLayout,
    sceneData,
    hasLocalEdits,
    stepsRevision,
    serverShadow,
  } = useAppSelector((s) => s.scene);
  const sceneDataRevision = useAppSelector((s) => s.scene.sceneDataRevision);
  const showScriptUi = useAppSelector((s) =>
    selectShowScriptMarkdownUi(s, projectName || "fools", "script"),
  );

  const selectedStepIdRef = useRef<number | null>(null);
  const restoredProjectRef = useRef<string | null>(null);
  const lastProjectForSceneRolesSaveRef = useRef<string | null>(null);
  const lastProjectForSelectedStepSaveRef = useRef<string | null>(null);
  const lightPlotSaveTimerRef = useRef<number | null>(null);
  const lastSyncedKeyRef = useRef<string | null>(null);
  const lastSavedLightChannelsKeyRef = useRef<string | null>(null);
  const joinedProjectIdRef = useRef<string | null>(null);
  const realtimePullTimerRef = useRef<number | null>(null);
  const realtimeSceneUpdatedHandlerRef = useRef<
    ((payload?: { projectId?: string; sourceClientId?: string | null }) => void) | null
  >(null);
  const realtimeConnectHandlerRef = useRef<(() => void) | null>(null);

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
            // Web: Р¶РґС‘Рј initial sync (РµСЃР»Рё РµСЃС‚СЊ С‚РѕРєРµРЅ), С‡С‚РѕР±С‹ РЅРµ РјРµР»СЊРєР°Р»Рѕ РїСѓСЃС‚РѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ/С€Р°Рі-Р·Р°РіР»СѓС€РєР°
            isSceneReady: !accessToken,
          }),
        );
        return;
      }
      try {
        const scene = await desktopReadProjectScene(desktopApi, projectName, "script");
        if (cancelled) return;
        const localRoles = loadSceneRolesFromStorage(projectName);
        const mergedScene =
          scene && typeof scene === "object"
            ? { ...(scene as any), sceneRoles: (scene as any)?.sceneRoles ?? localRoles ?? undefined }
            : scene;
        const localSceneData = mergedScene || null;
        const localSteps = applySceneFaderBindingsToSpotlights(
          (localSceneData as any)?.steps ?? [],
          (localSceneData as any)?.lightFaders,
        );
        dispatch(
          sceneActions.hydrateScene({
            sceneData: localSceneData,
            theaterLayout: resolveInitialTheaterLayout(
              projectName,
              (mergedScene as any)?.theaterLayout
                ? normalizePersistedTheaterLayout((mergedScene as any).theaterLayout)
                : undefined,
              DEFAULT_THEATER_LAYOUT,
            ),
            steps: localSteps,
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
  }, [projectName, dispatch, accessToken]);

  // Persist per-step role links locally as well (helps web-only mode too).
  useEffect(() => {
    if (!projectName) return;
    // On project switch, the render can still hold previous project's sceneData.
    // Never write it into the new project's localStorage key.
    if (lastProjectForSceneRolesSaveRef.current !== projectName) {
      lastProjectForSceneRolesSaveRef.current = projectName;
      return;
    }
    saveSceneRolesToStorage(projectName, sceneData);
  }, [projectName, sceneData, sceneDataRevision]);

  useEffect(() => {
    if (!accessToken || !projectName) return;
    const key = `${accessToken}:${projectName}`;
    if (lastSyncedKeyRef.current === key) return;
    lastSyncedKeyRef.current = key;
    void syncFromServer(accessToken, projectName);
  }, [accessToken, projectName, syncFromServer]);

  // Realtime: join socket.io room per project and pull on updates.
  useEffect(() => {
    const token =
      accessToken ?? (typeof window !== "undefined" ? localStorage.getItem("accessToken") : null);

    if (!token || !projectName) {
      joinedProjectIdRef.current = null;
      if (realtimePullTimerRef.current) {
        window.clearTimeout(realtimePullTimerRef.current);
        realtimePullTimerRef.current = null;
      }
      disconnectRealtimeSocket();
      return;
    }

    let cancelled = false;

    const setup = async () => {
      const cachedProjectId =
        typeof window !== "undefined" ? localStorage.getItem(`projectId:${projectName}`) : null;
      const projectId = cachedProjectId ?? (await ensureRemoteProject(token));
      if (cancelled || !projectId) return;

      const socket = getRealtimeSocket(token);
      if (!socket) return;

      const prev = joinedProjectIdRef.current;
      if (prev && prev !== projectId) {
        socket.emit("leave-project", { projectId: prev });
      }
      if (prev !== projectId) joinedProjectIdRef.current = projectId;

      socket.connect();

      const onConnect = () => {
        socket.emit("join-project", { projectId });
      };
      const prevConnectHandler = realtimeConnectHandlerRef.current;
      if (prevConnectHandler) socket.off("connect", prevConnectHandler);
      socket.on("connect", onConnect);
      realtimeConnectHandlerRef.current = onConnect;

      const myClientId = getClientInstanceId();
      const onSceneUpdated = (payload?: { projectId?: string; sourceClientId?: string | null }) => {
        if (payload?.sourceClientId && payload.sourceClientId === myClientId) return;
        // Pull can overwrite current draft; don't auto-pull while local edits exist.
        if (hasLocalEdits) {
          dispatch(
            sceneActions.setRealtimePullDeferred({
              deferred: true,
              at: new Date().toISOString(),
              reason: "local_edits",
            }),
          );
          return;
        }
        if (getPauseRemoteSceneUpdates()) {
          dispatch(
            sceneActions.setRealtimePullDeferred({
              deferred: true,
              at: new Date().toISOString(),
              reason: "settings_pause",
            }),
          );
          return;
        }
        if (realtimePullTimerRef.current) window.clearTimeout(realtimePullTimerRef.current);
        realtimePullTimerRef.current = window.setTimeout(() => {
          if (getConfirmBeforeRemoteScenePull()) {
            const ok = window.confirm(
              "РќР° СЃРµСЂРІРµСЂРµ РѕР±РЅРѕРІРёР»Рё СЃС†РµРЅСѓ. РџРѕРґС‚СЏРЅСѓС‚СЊ РёР·РјРµРЅРµРЅРёСЏ СЃРµР№С‡Р°СЃ? РћС‚РјРµРЅР° вЂ” РѕСЃС‚Р°РІРёС‚СЊ РєР°Рє РµСЃС‚СЊ, РјРѕР¶РЅРѕ Р±СѓРґРµС‚ РїРѕРґС‚СЏРЅСѓС‚СЊ РІСЂСѓС‡РЅСѓСЋ.",
            );
            if (!ok) {
              dispatch(
                sceneActions.setRealtimePullDeferred({
                  deferred: true,
                  at: new Date().toISOString(),
                  reason: "confirm_declined",
                }),
              );
              return;
            }
          }
          void syncFromServer(token, projectName);
        }, 300);
      };

      const prevHandler = realtimeSceneUpdatedHandlerRef.current;
      if (prevHandler) socket.off("scene-updated", prevHandler);
      socket.on("scene-updated", onSceneUpdated);
      realtimeSceneUpdatedHandlerRef.current = onSceneUpdated;
    };

    void setup();

    return () => {
      cancelled = true;
    };
  }, [accessToken, projectName, ensureRemoteProject, syncFromServer, hasLocalEdits]);

  useEffect(() => {
    selectedStepIdRef.current = steps[currentPage]?.id ?? null;
  }, [projectName, steps, currentPage]);

  useEffect(() => {
    if (steps.length === 0) {
      if (currentPage !== 0) dispatch(sceneActions.setCurrentPage(0));
      return;
    }

    if (!isSceneReady) return;

    if (projectName && restoredProjectRef.current !== projectName) {
      const storedIdRaw = localStorage.getItem(`selectedStepId:${projectName}`);
      const storedId = storedIdRaw ? Number(storedIdRaw) : null;
      const storedPageRaw = localStorage.getItem(`selectedStepPage:${projectName}`);
      const storedPage = storedPageRaw != null ? Number(storedPageRaw) : NaN;

      let targetIdx: number | null = null;
      if (storedId != null && Number.isFinite(storedId)) {
        const byId = steps.findIndex((s) => s.id === storedId);
        if (byId !== -1) targetIdx = byId;
      }
      if (targetIdx == null && Number.isFinite(storedPage) && steps.length > 0) {
        targetIdx = Math.max(0, Math.min(Math.floor(storedPage), steps.length - 1));
      }
      if (targetIdx != null && targetIdx !== currentPage) {
        dispatch(sceneActions.setCurrentPage(targetIdx));
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
  }, [projectName, steps, currentPage, dispatch, isSceneReady]);

  useEffect(() => {
    if (!projectName) return;
    if (!isSceneReady) return;
    // Same race as with sceneRoles: don't persist previous project's selection
    // into the new project's localStorage key on project switch.
    if (lastProjectForSelectedStepSaveRef.current !== projectName) {
      lastProjectForSelectedStepSaveRef.current = projectName;
      return;
    }
    const selectedId = steps[currentPage]?.id;
    if (selectedId != null) {
      localStorage.setItem(`selectedStepId:${projectName}`, String(selectedId));
    }
    try {
      if (steps.length > 0) {
        localStorage.setItem(`selectedStepPage:${projectName}`, String(currentPage));
      }
    } catch {
      // ignore
    }
  }, [projectName, steps, currentPage, isSceneReady]);

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
    const lightDirtyVsServer = (() => {
      // Prevent feedback-loop: remote pull updates serverShadow -> UI meta updates ->
      // metaChanged becomes true, but this is NOT a local change and must not trigger push.
      const serverLight = Array.isArray(serverShadow?.lightChannels)
        ? serverShadow!.lightChannels
        : null;
      const localLight = Array.isArray(showScriptUi.lightChannels) ? showScriptUi.lightChannels : null;
      if (serverLight) {
        return stableStringify(serverLight) !== stableStringify(localLight);
      }
      // If we don't have server baseline yet, treat non-empty values as local edits.
      return (localLight ?? []).some((x) => String(x ?? "").trim().length > 0);
    })();

    // If meta changed but matches the server baseline, accept it as new baseline
    // without persisting/pushing it back.
    if (metaChanged && !lightDirtyVsServer) {
      lastSavedLightChannelsKeyRef.current = lightChannelsKey;
      return;
    }

    const shouldSave = hasLocalEdits || (metaChanged && lightDirtyVsServer);
    if (!shouldSave) return;
    const shouldForceSaveMeta = metaChanged && !hasLocalEdits && lightDirtyVsServer;
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
    serverShadow,
    showScriptUi.lightChannels,
  ]);
}
