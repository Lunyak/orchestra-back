import { useEffect, useMemo, useRef } from "react";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { desktopReadProjectPlaybook } from "../../../shared/platform/desktop-methods";
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
import {
  commitTheaterLayoutBaseline,
  isTheaterLayoutDraftDirty,
  resolveInitialTheaterLayout,
} from "../../theater/model/theater-layout-draft-storage";
import { prepareSceneLightBindings } from "../../theater/model/theater-light-fader-bindings";
import { sceneHasTheaterLayoutContent } from "../../theater/model/copy-scene-theater-layout";
import { playbookActions, DEFAULT_THEATER_LAYOUT, type PlaybookLightFadersDataV1 } from "./playbook-slice";
import { loadSceneRolesFromStorage, saveSceneRolesToStorage } from "./playbook-roles-storage";
import { normalizeLightChannelsLoose, normalizePlaybookJsonPayload, readPlaybookScenes } from "./playbook-normalize";
import { hydratePlaybookFromLocalPack } from "./playbook-local-hydration";
import {
  readSelectedScenePage,
  writeSelectedScenePage,
} from "./playbook-scene-page-storage";
import { usePlaybookOperations } from "./playbook-operations";
import {
  getProjectMediaFolderInfo,
  mergeScannedMediaIntoScene,
  readStoredProjectMediaFolder,
  scanProjectMediaFolder,
} from "../../../shared/platform/project-media-folder";
import { setBrowserPickedMediaProject } from "../../../shared/platform/browser-picked-media";
import { registerDevProjectMediaRoot } from "../../../shared/platform/local-project-dev";
import { store } from "../../../shared/store/store";
import { downloadDesktopProjectorMediaOffline } from "../../../sync/desktopProjectorMediaOffline";
import { unpackProjectorMedia } from "../../projector/model/playbook-projector-persist";

export function usePlaybookSyncEffects() {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const { projectName, ensureRemoteProject } = useProject();
  const { syncFromServer, saveScenesForLightPlot } = usePlaybookOperations();

  const {
    scenes,
    currentPage,
    isPlaybookReady,
    theaterLayout,
    playbookData,
    hasLocalEdits,
    scenesRevision,
    serverShadow,
  } = useAppSelector((s) => s.playbook);
  const playbookDataRevision = useAppSelector((s) => s.playbook.playbookDataRevision);
  const showScriptUi = useAppSelector((s) =>
    selectShowScriptMarkdownUi(s, projectName || "fools", "script"),
  );

  const selectedSceneIdRef = useRef<number | null>(null);
  const restoredProjectRef = useRef<string | null>(null);
  const lastProjectForSceneRolesSaveRef = useRef<string | null>(null);
  const lastProjectForSelectedSceneSaveRef = useRef<string | null>(null);
  const lightPlotSaveTimerRef = useRef<number | null>(null);
  const lastSyncedKeyRef = useRef<string | null>(null);
  const lastSavedLightChannelsKeyRef = useRef<string | null>(null);
  const joinedProjectIdRef = useRef<string | null>(null);
  const realtimePullTimerRef = useRef<number | null>(null);
  const realtimeSceneUpdatedHandlerRef = useRef<
    ((payload?: { projectId?: string; sourceClientId?: string | null }) => void) | null
  >(null);
  const realtimeConnectHandlerRef = useRef<(() => void) | null>(null);
  const desktopLocalSceneLoadedRef = useRef(false);
  const desktopTheaterRecoveryRef = useRef<string | null>(null);
  const lastLocalEditAtRef = useRef(0);

  useEffect(() => {
    if (!projectName) return;
    dispatch(playbookActions.resetForProject());
    selectedSceneIdRef.current = null;
    restoredProjectRef.current = null;
    desktopLocalSceneLoadedRef.current = false;
    desktopTheaterRecoveryRef.current = null;

    let cancelled = false;
    const loadScene = async () => {
      setBrowserPickedMediaProject(projectName);
      const storedFolder = readStoredProjectMediaFolder(projectName);
      if (storedFolder.path) {
        void registerDevProjectMediaRoot(projectName, storedFolder.path);
      }
      void getProjectMediaFolderInfo(projectName);

      const desktopApi = getDesktopApi();
      if (!desktopApi) {
        const loadedLocal = await hydratePlaybookFromLocalPack(projectName, dispatch);
        if (cancelled) return;
        if (loadedLocal) {
          desktopLocalSceneLoadedRef.current = true;
        }
        if (!getDesktopApi()) {
          const scanned = await scanProjectMediaFolder(projectName);
          if (
            !cancelled &&
            scanned.ok &&
            (scanned.videos.length > 0 ||
              scanned.holdImages.length > 0 ||
              (scanned.sounds?.length ?? 0) > 0)
          ) {
            const prev = store.getState().playbook.playbookData;
            const merged = mergeScannedMediaIntoScene(
              prev?.videos ?? [],
              prev?.holdImages ?? [],
              prev?.playlist ?? [],
              scanned,
            );
            dispatch(
              playbookActions.setProjectorMediaLibrary({
                videos: merged.videos,
                holdImages: merged.holdImages,
              }),
            );
            if (merged.playlist.length !== (prev?.playlist?.length ?? 0)) {
              dispatch(playbookActions.setPlaylist(merged.playlist));
            }
            console.info(
              `[sync] imported media from ${scanned.mediaRoot ?? scanned.folderName ?? "local"}`,
            );
          }
        }
        if (loadedLocal) {
          if (!store.getState().playbook.isPlaybookReady) {
            dispatch(playbookActions.setPlaybookReady(true));
          }
          return;
        }
        const hasImportedMedia =
          (store.getState().playbook.playbookData?.videos?.length ?? 0) > 0 ||
          (store.getState().playbook.playbookData?.holdImages?.length ?? 0) > 0;
        if (hasImportedMedia) {
          if (!store.getState().playbook.isPlaybookReady) {
            dispatch(playbookActions.setPlaybookReady(true));
          }
          return;
        }
        dispatch(
          playbookActions.hydratePlaybook({
            playbookData: null,
            theaterLayout: DEFAULT_THEATER_LAYOUT,
            scenes: [],
            currentPage: 0,
            isPlaybookReady: true,
          }),
        );
        return;
      }
      try {
        const scene = await desktopReadProjectPlaybook(desktopApi, projectName, "script");
        if (cancelled) return;
        const normalizedScene =
          scene && typeof scene === "object"
            ? normalizePlaybookJsonPayload(scene as Record<string, unknown>)
            : null;
        const localRoles = loadSceneRolesFromStorage(projectName);
        const mergedScene =
          normalizedScene
            ? { ...normalizedScene, sceneRoles: normalizedScene.sceneRoles ?? localRoles ?? undefined }
            : null;
        const localPlaybookData = mergedScene || null;
        const lc = normalizeLightChannelsLoose((localPlaybookData as any)?.lightChannels);
        const theaterLayout = resolveInitialTheaterLayout(
          projectName,
          (mergedScene as any)?.theaterLayout
            ? normalizePersistedTheaterLayout((mergedScene as any).theaterLayout)
            : undefined,
          DEFAULT_THEATER_LAYOUT,
        );
        const prepared = prepareSceneLightBindings(
          readPlaybookScenes(localPlaybookData as Record<string, unknown>),
          (localPlaybookData as Record<string, unknown>)?.lightFaders as PlaybookLightFadersDataV1 | undefined,
        );
        const playbookDataForHydrate =
          localPlaybookData && prepared.lightFaders
            ? { ...(localPlaybookData as any), lightFaders: prepared.lightFaders }
            : localPlaybookData;
        dispatch(
          playbookActions.hydratePlaybook({
            playbookData: playbookDataForHydrate,
            theaterLayout,
            scenes: prepared.scenes,
            currentPage: 0,
            isPlaybookReady: true,
            serverShadow: {
              playbookData: playbookDataForHydrate,
              scenes: prepared.scenes,
              theaterLayout,
              lightChannels: lc,
            },
          }),
        );
        desktopLocalSceneLoadedRef.current = Array.isArray(prepared.scenes) && prepared.scenes.length > 0;
        void (async () => {
          const pid =
            typeof window !== "undefined"
              ? localStorage.getItem(`projectId:${projectName}`)
              : null;
          const offline = await downloadDesktopProjectorMediaOffline({
            projectSlug: projectName,
            accessToken,
            projectId: pid,
          });
          if (cancelled || !offline.changed) return;
          const bag = unpackProjectorMedia((localPlaybookData as any)?.projectorMedia);
          const nextPlaybookData = {
            ...(localPlaybookData as object),
            videos: offline.videos.length > 0 ? offline.videos : bag.videos,
            holdImages: offline.holdImages.length > 0 ? offline.holdImages : bag.holdImages,
          };
          dispatch(
            playbookActions.hydratePlaybook({
              playbookData: nextPlaybookData,
              theaterLayout,
              scenes: prepared.scenes,
              currentPage: 0,
              isPlaybookReady: true,
            }),
          );
        })();
        if (!isTheaterLayoutDraftDirty(projectName)) {
          commitTheaterLayoutBaseline(projectName, theaterLayout);
        }
        selectedSceneIdRef.current = null;
        restoredProjectRef.current = null;
      } catch (error) {
        if (!cancelled) {
          dispatch(
            playbookActions.hydratePlaybook({
              playbookData: null,
              theaterLayout: DEFAULT_THEATER_LAYOUT,
              scenes: [],
              currentPage: 0,
              isPlaybookReady: false,
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

  // Persist per-scene role links locally as well (helps web-only mode too).
  useEffect(() => {
    if (!projectName) return;
    // On project switch, the render can still hold previous project's playbookData.
    // Never write it into the new project's localStorage key.
    if (lastProjectForSceneRolesSaveRef.current !== projectName) {
      lastProjectForSceneRolesSaveRef.current = projectName;
      return;
    }
    saveSceneRolesToStorage(projectName, playbookData);
  }, [projectName, playbookData, playbookDataRevision]);

  useEffect(() => {
    if (!accessToken || !projectName) return;
    if (getDesktopApi()) return;
    if (!isPlaybookReady) return;
    const key = `${accessToken}:${projectName}`;
    if (lastSyncedKeyRef.current === key) return;
    lastSyncedKeyRef.current = key;
    void syncFromServer(accessToken, projectName);
  }, [accessToken, projectName, syncFromServer, isPlaybookReady]);

  // Desktop: локальный script.json мог устареть/обнулить 3D — подтягиваем театр с сервера.
  useEffect(() => {
    if (!getDesktopApi() || !accessToken || !projectName) return;
    if (!isPlaybookReady || scenes.length === 0) return;
    if (hasLocalEdits) return;
    if (desktopTheaterRecoveryRef.current === projectName) return;

    const lacksTheater = !scenes.some((scene) => sceneHasTheaterLayoutContent(scene));
    desktopTheaterRecoveryRef.current = projectName;
    if (!lacksTheater) return;

    console.warn("[sync] desktop local pack has no 3D theater content, pulling from server");
    void syncFromServer(accessToken, projectName);
  }, [
    accessToken,
    hasLocalEdits,
    isPlaybookReady,
    projectName,
    scenes,
    scenesRevision,
    syncFromServer,
  ]);

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
    if (getDesktopApi()) {
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
            playbookActions.setRealtimePullDeferred({
              deferred: true,
              at: new Date().toISOString(),
              reason: "local_edits",
            }),
          );
          return;
        }
        if (Date.now() - lastLocalEditAtRef.current < 5000) {
          dispatch(
            playbookActions.setRealtimePullDeferred({
              deferred: true,
              at: new Date().toISOString(),
              reason: "remote_pending",
            }),
          );
          return;
        }
        if (getPauseRemoteSceneUpdates()) {
          dispatch(
            playbookActions.setRealtimePullDeferred({
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
                playbookActions.setRealtimePullDeferred({
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
    selectedSceneIdRef.current = scenes[currentPage]?.id ?? null;
  }, [projectName, scenes, currentPage]);

  useEffect(() => {
    if (scenes.length === 0) {
      if (currentPage !== 0) dispatch(playbookActions.setCurrentPage(0));
      return;
    }

    if (!isPlaybookReady) return;

    if (projectName && restoredProjectRef.current !== projectName) {
      const storedIdRaw = localStorage.getItem(`selectedSceneId:${projectName}`);
      const storedId = storedIdRaw ? Number(storedIdRaw) : null;
      const storedPage = readSelectedScenePage(projectName);

      let targetIdx: number | null = null;
      if (storedId != null && Number.isFinite(storedId)) {
        const byId = scenes.findIndex((s) => s.id === storedId);
        if (byId !== -1) targetIdx = byId;
      }
      if (targetIdx == null && storedPage != null && scenes.length > 0) {
        targetIdx = Math.max(0, Math.min(Math.floor(storedPage), scenes.length - 1));
      }
      if (targetIdx != null && targetIdx !== currentPage) {
        dispatch(playbookActions.setCurrentPage(targetIdx));
      }
      restoredProjectRef.current = projectName;
      return;
    }

    const selectedId = selectedSceneIdRef.current;
    if (selectedId != null) {
      const nextIndex = scenes.findIndex((s) => s.id === selectedId);
      if (nextIndex !== -1 && nextIndex !== currentPage) {
        dispatch(playbookActions.setCurrentPage(nextIndex));
        return;
      }
    }

    if (currentPage > scenes.length - 1) {
      dispatch(playbookActions.setCurrentPage(scenes.length - 1));
    }
  }, [projectName, scenes, currentPage, dispatch, isPlaybookReady]);

  useEffect(() => {
    if (!projectName) return;
    if (!isPlaybookReady) return;
    // Same race as with sceneRoles: don't persist previous project's selection
    // into the new project's localStorage key on project switch.
    if (lastProjectForSelectedSceneSaveRef.current !== projectName) {
      lastProjectForSelectedSceneSaveRef.current = projectName;
      return;
    }
    const selectedId = scenes[currentPage]?.id;
    if (selectedId != null) {
      localStorage.setItem(`selectedSceneId:${projectName}`, String(selectedId));
    }
    try {
      if (scenes.length > 0) {
        writeSelectedScenePage(projectName, currentPage);
      }
    } catch {
      // ignore
    }
  }, [projectName, scenes, currentPage, isPlaybookReady]);

  const roleAssignmentsKey = useMemo(
    () => JSON.stringify((playbookData as any)?.roleAssignments ?? null),
    [playbookData],
  );

  const lightChannelsKey = useMemo(
    () => JSON.stringify(showScriptUi.lightChannels ?? null),
    [showScriptUi.lightChannels],
  );

  useEffect(() => {
    if (hasLocalEdits) {
      lastLocalEditAtRef.current = Date.now();
    }
  }, [hasLocalEdits, scenesRevision, playbookDataRevision, theaterLayout, lightChannelsKey]);

  useEffect(() => {
    if (!isPlaybookReady) return;
    if (scenes.length === 0 && !hasLocalEdits) return;

    const shadowSceneCount = Array.isArray(serverShadow?.scenes) ? serverShadow!.scenes.length : 0;
    const localBehindServer =
      shadowSceneCount > 1 && scenes.length < shadowSceneCount * 0.8;
    if (localBehindServer) return;

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
    const shouldSaveLightChannelsNow = metaChanged && lightDirtyVsServer;
    if (lightPlotSaveTimerRef.current) {
      window.clearTimeout(lightPlotSaveTimerRef.current);
      lightPlotSaveTimerRef.current = null;
    }
    const runSave = () => {
      void saveScenesForLightPlot({ force: shouldSaveLightChannelsNow }).then(() => {
        lastSavedLightChannelsKeyRef.current = lightChannelsKey;
      });
    };
    if (shouldSaveLightChannelsNow) {
      runSave();
      return;
    }
    lightPlotSaveTimerRef.current = window.setTimeout(runSave, 600);
    return () => {
      if (lightPlotSaveTimerRef.current) {
        window.clearTimeout(lightPlotSaveTimerRef.current);
      }
    };
  }, [
    isPlaybookReady,
    scenes.length,
    scenesRevision,
    playbookDataRevision,
    theaterLayout,
    roleAssignmentsKey,
    hasLocalEdits,
    lightChannelsKey,
    saveScenesForLightPlot,
    serverShadow,
    showScriptUi.lightChannels,
  ]);
}
