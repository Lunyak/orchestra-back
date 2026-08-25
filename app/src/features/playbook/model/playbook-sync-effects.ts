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
import {
  readSelectedScenePage,
  writeSelectedScenePage,
} from "./playbook-scene-page-storage";
import { usePlaybookOperations } from "./playbook-operations";
import {
  getProjectMediaFolderInfo,
  readStoredProjectMediaFolder,
} from "../../../shared/platform/project-media-folder";
import { setBrowserPickedMediaProject } from "../../../shared/platform/browser-picked-media";
import { registerDevProjectMediaRoot } from "../../../shared/platform/local-project-dev";
import { store } from "../../../shared/store/store";
import { downloadDesktopProjectorMediaOffline } from "../../../sync/desktopProjectorMediaOffline";
import { unpackProjectorMedia } from "../../projector/model/playbook-projector-persist";

type PlaybookLocalBoot = {
  projectName: string;
  promise: Promise<void>;
};

let playbookLocalBoot: PlaybookLocalBoot | null = null;
let lastCompletedPlaybookBootProject: string | null = null;
const syncedPlaybookKeys = new Set<string>();

export function usePlaybookSyncEffects() {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const { projectName, ensureRemoteProject } = useProject();
  const { syncFromServer, saveScenesForLightPlot } = usePlaybookOperations();
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

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

    const reuseBoot =
      playbookLocalBoot?.projectName === projectName
        ? playbookLocalBoot.promise
        : null;

    const alreadyBooted =
      !reuseBoot &&
      lastCompletedPlaybookBootProject === projectName &&
      (store.getState().playbook.isPlaybookReady ||
        // Web: boot finishes before first /sync/pull; keep awaiting sync without reset.
        !getDesktopApi());

    if (alreadyBooted) return;

    if (!reuseBoot) {
      dispatch(playbookActions.resetForProject());
      selectedSceneIdRef.current = null;
      restoredProjectRef.current = null;
      desktopLocalSceneLoadedRef.current = false;
      desktopTheaterRecoveryRef.current = null;
      lastCompletedPlaybookBootProject = null;
      const syncKeySuffix = `:${projectName}`;
      for (const key of [...syncedPlaybookKeys]) {
        if (key.endsWith(syncKeySuffix)) syncedPlaybookKeys.delete(key);
      }
    }

    const bootProject = projectName;
    const isCurrentBoot = () =>
      playbookLocalBoot?.projectName === bootProject ||
      lastCompletedPlaybookBootProject === bootProject;

    const loadScene = async () => {
      if (reuseBoot) {
        await reuseBoot;
        return;
      }

      let finishBoot!: () => void;
      const bootPromise = new Promise<void>((resolve) => {
        finishBoot = resolve;
      });
      // Register before async body so sync web path's isCurrentBoot() is true.
      playbookLocalBoot = { projectName: bootProject, promise: bootPromise };

      void (async () => {
        try {
          setBrowserPickedMediaProject(bootProject);
          const storedFolder = readStoredProjectMediaFolder(bootProject);
          if (storedFolder.path) {
            void registerDevProjectMediaRoot(bootProject, storedFolder.path);
          }
          void getProjectMediaFolderInfo(bootProject);

          const desktopApi = getDesktopApi();
          if (!desktopApi) {
            // Web: source of truth is /sync/pull. Do not mark ready with empty scenes —
            // that flashes «Добавьте материал» before the first pull lands.
            if (!isCurrentBoot()) return;
            const token = accessTokenRef.current;
            if (!token) {
              dispatch(
                playbookActions.hydratePlaybook({
                  playbookData: null,
                  theaterLayout: DEFAULT_THEATER_LAYOUT,
                  scenes: [],
                  currentPage: 0,
                  isPlaybookReady: true,
                }),
              );
            }
            return;
          }
          try {
            const scene = await desktopReadProjectPlaybook(desktopApi, bootProject, "script");
            if (!isCurrentBoot()) return;
            const normalizedScene =
              scene && typeof scene === "object"
                ? normalizePlaybookJsonPayload(scene as Record<string, unknown>)
                : null;
            const localRoles = loadSceneRolesFromStorage(bootProject);
            const mergedScene =
              normalizedScene
                ? {
                    ...normalizedScene,
                    sceneRoles: normalizedScene.sceneRoles ?? localRoles ?? undefined,
                  }
                : null;
            const localPlaybookData = mergedScene || null;
            const lc = normalizeLightChannelsLoose((localPlaybookData as any)?.lightChannels);
            const theaterLayout = resolveInitialTheaterLayout(
              bootProject,
              (mergedScene as any)?.theaterLayout
                ? normalizePersistedTheaterLayout((mergedScene as any).theaterLayout)
                : undefined,
              DEFAULT_THEATER_LAYOUT,
            );
            const prepared = prepareSceneLightBindings(
              readPlaybookScenes(localPlaybookData as Record<string, unknown>),
              (localPlaybookData as Record<string, unknown>)?.lightFaders as
                | PlaybookLightFadersDataV1
                | undefined,
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
            desktopLocalSceneLoadedRef.current =
              Array.isArray(prepared.scenes) && prepared.scenes.length > 0;
            void (async () => {
              const pid =
                typeof window !== "undefined"
                  ? localStorage.getItem(`projectId:${bootProject}`)
                  : null;
              const offline = await downloadDesktopProjectorMediaOffline({
                projectSlug: bootProject,
                accessToken: accessTokenRef.current,
                projectId: pid,
              });
              if (!isCurrentBoot() || !offline.changed) return;
              const bag = unpackProjectorMedia((localPlaybookData as any)?.projectorMedia);
              const nextPlaybookData = {
                ...(localPlaybookData as object),
                videos: offline.videos.length > 0 ? offline.videos : bag.videos,
                holdImages:
                  offline.holdImages.length > 0 ? offline.holdImages : bag.holdImages,
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
            if (!isTheaterLayoutDraftDirty(bootProject)) {
              commitTheaterLayoutBaseline(bootProject, theaterLayout);
            }
            selectedSceneIdRef.current = null;
            restoredProjectRef.current = null;
          } catch {
            if (isCurrentBoot()) {
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
        } finally {
          if (isCurrentBoot()) {
            lastCompletedPlaybookBootProject = bootProject;
          }
          if (playbookLocalBoot?.promise === bootPromise) {
            playbookLocalBoot = null;
          }
          finishBoot();
        }
      })();

      await bootPromise;
    };
    void loadScene();
  }, [projectName, dispatch]);

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
    const key = `${accessToken}:${projectName}`;
    if (syncedPlaybookKeys.has(key)) return;
    syncedPlaybookKeys.add(key);
    void syncFromServer(accessToken, projectName).catch(() => {
      syncedPlaybookKeys.delete(key);
      const playbook = store.getState().playbook;
      if (playbook.isPlaybookReady) return;
      dispatch(
        playbookActions.hydratePlaybook({
          playbookData: playbook.playbookData,
          theaterLayout: playbook.theaterLayout,
          scenes: playbook.scenes,
          currentPage: playbook.currentPage,
          isPlaybookReady: true,
        }),
      );
    });
  }, [accessToken, projectName, syncFromServer, dispatch]);

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

  const selectedSceneId = scenes[currentPage]?.id ?? null;
  const sceneIdsKey = scenes.map((scene) => scene.id).join(",");

  useEffect(() => {
    selectedSceneIdRef.current = selectedSceneId;
  }, [projectName, selectedSceneId]);

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
  }, [projectName, sceneIdsKey, currentPage, dispatch, isPlaybookReady, scenes.length]);

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
  }, [projectName, selectedSceneId, currentPage, isPlaybookReady, scenes.length]);

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
