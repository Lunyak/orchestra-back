import {
  packProjectorMedia,
  unpackProjectorMedia,
} from "../../projector/model/playbook-projector-persist";
import type { ScriptScene } from "../../../shared/types/script";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { stableStringify } from "../../../shared/utils/stableStringify";
import { dispatchSyncPull } from "../../../shared/api/rtk/sync-dispatch";
import { prefetchDesktopOfflineAfterSync } from "../../../sync/desktopPrefetchOffline";
import { downloadPlaylistTracksOffline } from "../../../shared/media/web-media-cache";
import { mergeScannedMediaIntoScene, readStoredProjectMediaFolder, scanProjectMediaFolder } from "../../../shared/platform/project-media-folder";
import type { AppDispatch } from "../../../shared/store/store";
import { store } from "../../../shared/store/store";
import {
  showScriptMarkdownActions,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import {
  prepareSceneLightBindings,
} from "../../theater/model/theater-light-fader-bindings";
import {
  resolveInitialTheaterLayout,
  commitTheaterLayoutBaseline,
  isTheaterLayoutDraftDirty,
} from "../../theater/model/theater-layout-draft-storage";
import { playbookActions, DEFAULT_THEATER_LAYOUT } from "./playbook-slice";
import { normalizePlaybookRolesDataV1, loadSceneRolesFromStorage } from "./playbook-roles-storage";
import {
  pullPlaybooksFromSync,
  pullScriptScenesFromSync,
  syncPullIncludeForPlaybook,
  syncRowMatchesPlaybook,
} from "../../../sync/sync-pull-normalize";
import { hydratePlaybookFromLocalPack } from "./playbook-local-hydration";
import { readSelectedScenePage } from "./playbook-scene-page-storage";
import {
  normalizeLightChannelsFromServer,
  normalizeScriptScenesFromSyncApi,
  normalizeTheaterLayoutFromServer,
} from "./playbook-normalize";
import {
  normalizeSyncPlaylistItems,
  normalizeSyncSounds,
} from "./playbook-sync-row-normalize";

export type PlaybookSyncFromServerDeps = {
  dispatch: AppDispatch;
  accessToken: string | null;
  projectName: string | undefined;
  scenes: ScriptScene[];
  ensureRemoteProject: (token: string) => Promise<string | null>;
  setAccessToken: (token: string | null) => void;
  onBindingsRepaired?: () => void;
};

export async function syncPlaybookFromServer(
  deps: PlaybookSyncFromServerDeps,
  token?: string | null,
  projectOverride?: string,
) {
  const { dispatch, accessToken, projectName, scenes, ensureRemoteProject, setAccessToken, onBindingsRepaired } =
    deps;

  const tokenToUse =
    token ??
    (typeof localStorage !== "undefined" ? localStorage.getItem("accessToken") : null) ??
    accessToken;
  const effectiveProject = projectOverride ?? projectName;
  if (!tokenToUse || !effectiveProject) {
    dispatch(playbookActions.setPlaybookReady(true));
    return;
  }

  const cachedProjectId =
    typeof window !== "undefined" ? localStorage.getItem(`projectId:${effectiveProject}`) : null;
  const projectId = cachedProjectId ?? (await ensureRemoteProject(tokenToUse));
  if (!projectId) {
    dispatch(playbookActions.setPlaybookReady(true));
    return;
  }

  const perProjectKey = `lastSyncAt:${effectiveProject}`;
  const effectiveLastSyncAt =
    localStorage.getItem(perProjectKey) ?? localStorage.getItem("lastSyncAt") ?? null;

  try {
    const pull = await dispatchSyncPull({
      projectSlug: effectiveProject,
      lastSyncAt: effectiveLastSyncAt,
      include: syncPullIncludeForPlaybook(),
    });
    const { now, projects, playlistItems, sounds, lightChannels, theaterLayouts } = pull;
    const playbooks = pullPlaybooksFromSync(pull);
    const scriptScenesRaw = pullScriptScenesFromSync(pull);
    const project = projects.find((p: any) => p.slug === effectiveProject);
    if (!project) {
      dispatch(playbookActions.setPlaybookReady(true));
      return;
    }
    const expectedSceneId = `${project.id}:script`;
    const scene =
      playbooks.find((s: any) => s.id === expectedSceneId) ??
      playbooks.find((s: any) => s.projectId === project.id && s.name === "script") ??
      playbooks.find((s: any) => s.projectId === project.id);
    if (!scene) {
      dispatch(playbookActions.setPlaybookReady(true));
      return;
    }
    const normalizedScenes = normalizeScriptScenesFromSyncApi(
      (Array.isArray(scriptScenesRaw) ? scriptScenesRaw : []).filter((st) =>
        syncRowMatchesPlaybook(st, scene.id),
      ),
    );

    const normalizedPlaylist = normalizeSyncPlaylistItems(playlistItems, scene.id);
    const normalizedSounds = normalizeSyncSounds(sounds, scene.id);

    const normalizedLightChannels = normalizeLightChannelsFromServer(
      (Array.isArray(lightChannels) ? lightChannels : []).filter((ch) =>
        syncRowMatchesPlaybook(ch, scene.id),
      ),
    );
    const layoutRow =
      (Array.isArray(theaterLayouts) ? theaterLayouts : []).find((tl) =>
        syncRowMatchesPlaybook(tl, scene.id),
      ) ?? null;
    const serverLayout =
      normalizeTheaterLayoutFromServer(layoutRow) ?? DEFAULT_THEATER_LAYOUT;
    // Live UI may keep a dirty local draft; serverShadow must stay server-only
    // so later theaterLayout diffs (doors/recesses) still push.
    const normalizedLayout = resolveInitialTheaterLayout(
      effectiveProject,
      serverLayout,
      DEFAULT_THEATER_LAYOUT,
    );

    const minimalPlaybookData: any = {
      name: scene.name,
      playlist: normalizedPlaylist,
      sounds: normalizedSounds,
      lightChannels: normalizedLightChannels,
    };
    const serverSceneRoles = (scene as any)?.sceneRoles ?? null;
    const normalizedServerSceneRoles = normalizePlaybookRolesDataV1(serverSceneRoles);
    if (normalizedServerSceneRoles) {
      minimalPlaybookData.sceneRoles = normalizedServerSceneRoles;
    } else {
      const localRoles = loadSceneRolesFromStorage(effectiveProject);
      if (localRoles) minimalPlaybookData.sceneRoles = localRoles;
    }
    const serverLightFaders = (scene as any)?.lightFaders ?? null;
    if (serverLightFaders && typeof serverLightFaders === "object" && (serverLightFaders as any).v === 1) {
      minimalPlaybookData.lightFaders = serverLightFaders;
    }
    const serverLightPrograms = (scene as any)?.lightPrograms ?? null;
    if (serverLightPrograms && typeof serverLightPrograms === "object" && (serverLightPrograms as any).v === 1) {
      minimalPlaybookData.lightPrograms = serverLightPrograms;
    }
    const serverLightChannelRoles = (scene as any)?.lightChannelRoles ?? null;
    if (
      serverLightChannelRoles &&
      typeof serverLightChannelRoles === "object" &&
      (serverLightChannelRoles as any).v === 1
    ) {
      minimalPlaybookData.lightChannelRoles = serverLightChannelRoles;
    }
    const projectorBag = unpackProjectorMedia((scene as any)?.projectorMedia);
    if (projectorBag.videos.length > 0) {
      minimalPlaybookData.videos = projectorBag.videos;
    }
    if (projectorBag.holdImages.length > 0) {
      minimalPlaybookData.holdImages = projectorBag.holdImages;
    }
    if (projectorBag.projector) {
      minimalPlaybookData.projector = projectorBag.projector;
    }

    const scenesBeforeRepair = normalizedScenes.length ? normalizedScenes : scenes;
    const bindingsBeforeRepair = prepareSceneLightBindings(
      scenesBeforeRepair,
      minimalPlaybookData.lightFaders,
    );
    const nextScenesPayload = bindingsBeforeRepair.scenes;
    if (
      bindingsBeforeRepair.lightFaders &&
      bindingsBeforeRepair.lightFaders !== minimalPlaybookData.lightFaders
    ) {
      minimalPlaybookData.lightFaders = bindingsBeforeRepair.lightFaders;
    }
    const bindingsRepaired =
      stableStringify(nextScenesPayload) !== stableStringify(scenesBeforeRepair);
    const wasReady = store.getState().playbook.isPlaybookReady;
    let bootstrapPage: number | undefined;
    if (!wasReady && typeof window !== "undefined" && nextScenesPayload.length > 0) {
      const idRaw = localStorage.getItem(`selectedSceneId:${effectiveProject}`);
      const storedPage = readSelectedScenePage(effectiveProject);
      const sid = idRaw != null && idRaw !== "" ? Number(idRaw) : Number.NaN;
      const sp = storedPage != null ? storedPage : Number.NaN;
      let idx = -1;
      if (Number.isFinite(sid)) {
        idx = nextScenesPayload.findIndex((s: any) => s.id === sid);
      }
      if (idx === -1 && Number.isFinite(sp)) {
        idx = Math.max(0, Math.min(Math.floor(sp), nextScenesPayload.length - 1));
      }
      if (idx !== -1) bootstrapPage = idx;
    }

    dispatch(
      playbookActions.hydratePlaybook({
        playbookData: minimalPlaybookData,
        theaterLayout: normalizedLayout,
        scenes: nextScenesPayload,
        ...(bootstrapPage !== undefined ? { currentPage: bootstrapPage } : {}),
        isPlaybookReady: true,
        serverShadow: {
          playbookData: minimalPlaybookData,
          scenes: nextScenesPayload,
          theaterLayout: serverLayout,
          lightChannels: normalizedLightChannels,
        },
      }),
    );
    if (!getDesktopApi()) {
      const storedMediaFolder = readStoredProjectMediaFolder(effectiveProject);
      if (storedMediaFolder.path) {
        void scanProjectMediaFolder(effectiveProject).then((scanned) => {
          if (!scanned.ok) return;
          const state = store.getState().playbook;
          const merged = mergeScannedMediaIntoScene(
            state.playbookData?.videos ?? [],
            state.playbookData?.holdImages ?? [],
            state.playbookData?.playlist ?? [],
            scanned,
          );
          dispatch(
            playbookActions.setProjectorMediaLibrary({
              videos: merged.videos,
              holdImages: merged.holdImages,
            }),
          );
          if (merged.playlist.length !== (state.playbookData?.playlist?.length ?? 0)) {
            dispatch(playbookActions.setPlaylist(merged.playlist));
          }
        });
      }
      const playlist = Array.isArray(minimalPlaybookData.playlist) ? minimalPlaybookData.playlist : [];
      if (
        typeof navigator !== "undefined" &&
        navigator.onLine &&
        playlist.length > 0 &&
        tokenToUse
      ) {
        void downloadPlaylistTracksOffline(effectiveProject, playlist, tokenToUse);
      }
    }
    if (!isTheaterLayoutDraftDirty(effectiveProject)) {
      commitTheaterLayoutBaseline(effectiveProject, normalizedLayout);
    }
    dispatch(
      showScriptMarkdownActions.setLightChannels({
        projectSlug: effectiveProject,
        sceneName: "script",
        lightChannels: normalizedLightChannels,
      }),
    );
    dispatch(playbookActions.clearRealtimePullDeferred());
    localStorage.setItem("lastSyncAt", now);
    localStorage.setItem(perProjectKey, now);

    if (bindingsRepaired && tokenToUse && effectiveProject) {
      window.setTimeout(() => {
        onBindingsRepaired?.();
      }, 100);
    }

    const desktopPrefetch = getDesktopApi();
    if (desktopPrefetch?.invoke && typeof desktopPrefetch.invoke === "function") {
      const pid =
        typeof window !== "undefined" ? localStorage.getItem(`projectId:${effectiveProject}`) : null;
      void prefetchDesktopOfflineAfterSync({
        accessToken: tokenToUse,
        projectSlug: effectiveProject,
        projectId: pid,
        minimalPlaybookData,
        normalizedScenes: nextScenesPayload,
        normalizedLayout,
        normalizedLightChannels,
      }).then((result) => {
        if (result.rehydratePayload) {
          dispatch(playbookActions.hydratePlaybook(result.rehydratePayload as any));
        }
        if (result.errors.length) {
          console.warn("[sync] desktop offline prefetch:", result.errors);
        }
        if (result.downloaded > 0) {
          console.log(
            `[sync] desktop offline: downloaded ${result.downloaded} file(s), skipped ${result.skipped}`,
          );
        }
      });
    }
  } catch (error: any) {
    if (error?.response?.status === 401) {
      setAccessToken(null);
      return;
    }
    console.error("[sync] pull failed:", error);
    const loadedLocal = await hydratePlaybookFromLocalPack(effectiveProject, dispatch);
    if (!loadedLocal) {
      dispatch(playbookActions.setPlaybookReady(true));
    }
  }
}
