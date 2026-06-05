import {
  packProjectorMedia,
  unpackProjectorMedia,
} from "../../projector/model/scene-projector-persist";
import { useCallback, useRef } from "react";
import type { ScriptStep, TheaterSpotlight } from "../../../shared/types/script";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  desktopReadProjectScene,
  desktopSaveProjectScene,
} from "../../../shared/platform/desktop-methods";
import { pruneSceneImages } from "../../../shared/utils/markdownImages";
import { createId } from "../../../shared/utils/createId";
import { stableStringify } from "../../../shared/utils/stableStringify";
import { syncPull, syncPush } from "../../../sync/api/entity-sync";
import type { SyncChange } from "../../../sync/api/types/sync";
import { cleanupProjectImages } from "../../../sync/api/projects";
import { flushDesktopOutbox } from "../../../sync/desktopOutbox";
import { prefetchDesktopOfflineAfterSync } from "../../../sync/desktopPrefetchOffline";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { store } from "../../../shared/store/store";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../../project/model/project-context";
import {
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import { resolveStepTheaterFromApi } from "../../theater/model/theater-model-serialize";
import { stepTheaterSyncPayload } from "../../theater/model/theater-step-models";
import {
  applySceneFaderBindingsToSpotlights,
  mapTheaterSpotlightFromApi,
  mapTheaterSpotlightToSync,
} from "../../theater/model/theater-light-fader-bindings";
import {
  resolveInitialTheaterLayout,
  writeTheaterLayoutDraft,
} from "../../theater/model/theater-layout-draft-storage";
import { sceneActions, DEFAULT_THEATER_LAYOUT, type SceneData } from "./scene-slice";
import { loadSceneRolesFromStorage } from "./scene-roles-storage";
import { hydrateSceneFromLocalPack } from "./scene-local-hydration";
import {
  extractReferencedRemoteImageKeysFromSteps,
  normalizeLightChannelsFromServer,
  normalizeTheaterLayoutFromServer,
} from "./scene-normalize";
import { mergeLightChannelsPreferLonger } from "../../../shared/components/light-console/light-channels-mutate";

function normalizeRequisiteAssignees(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

export function useSceneOperations() {
  const dispatch = useAppDispatch();
  const { accessToken, setAccessToken } = useAuth();
  const { projectName, ensureRemoteProject } = useProject();

  const { sceneData, steps, theaterLayout, hasLocalEdits, serverShadow } = useAppSelector(
    (s) => s.scene,
  );
  const showScriptUi = useAppSelector((s) =>
    selectShowScriptMarkdownUi(s, projectName || "fools", "script"),
  );
  const saveStepsRef = useRef<(opts?: { force?: boolean }) => Promise<void>>(async () => {});

  const syncFromServer = useCallback(
    async (token?: string | null, projectOverride?: string) => {
      const tokenToUse =
        token ??
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("accessToken")
          : null) ??
        accessToken;
      const effectiveProject = projectOverride ?? projectName;
      if (!tokenToUse || !effectiveProject) {
        dispatch(sceneActions.setSceneReady(true));
        return;
      }

      const cachedProjectId =
        typeof window !== "undefined"
          ? localStorage.getItem(`projectId:${effectiveProject}`)
          : null;
      const projectId = cachedProjectId ?? (await ensureRemoteProject(tokenToUse));
      if (!projectId) {
        dispatch(sceneActions.setSceneReady(true));
        return;
      }

      const perProjectKey = `lastSyncAt:${effectiveProject}`;
      const effectiveLastSyncAt =
        localStorage.getItem(perProjectKey) ??
        localStorage.getItem("lastSyncAt") ??
        null;

      try {
        const {
          now,
          projects,
          scenes,
          steps: serverSteps,
          playlistItems,
          sounds,
          lightChannels,
          theaterLayouts,
        } = await syncPull(
          tokenToUse,
          effectiveLastSyncAt,
          effectiveProject,
          { steps: true, playlist: true, sounds: true, lightChannels: true, theaterLayout: true },
        );
        const project = projects.find((p: any) => p.slug === effectiveProject);
        if (!project) {
          dispatch(sceneActions.setSceneReady(true));
          return;
        }
        const expectedSceneId = `${project.id}:script`;
        const scene =
          scenes.find((s: any) => s.id === expectedSceneId) ??
          scenes.find((s: any) => s.projectId === project.id && s.name === "script") ??
          scenes.find((s: any) => s.projectId === project.id);
        if (!scene) {
          dispatch(sceneActions.setSceneReady(true));
          return;
        }
        const normalizedSteps = (Array.isArray(serverSteps) ? serverSteps : [])
          .filter((st: any) => String(st?.sceneId ?? "") === String(scene.id))
          .sort((a: any, b: any) => (Number(a?.order ?? 0) - Number(b?.order ?? 0)))
          .map((st: any) => ({
            id: Number(st?.sourceId ?? 0),
            title: String(st?.title ?? ""),
            markdown: String(st?.markdown ?? ""),
            playMarkdown: st?.playMarkdown ?? undefined,
            explicationMarkdown: st?.explicationMarkdown ?? undefined,
            durationMin: st?.durationMin ?? undefined,
            kanbanStatus: st?.kanbanStatus ?? undefined,
            kanbanOrder: st?.kanbanOrder ?? undefined,
            requisites: Array.isArray(st?.requisites)
              ? st.requisites.map((r: any) => ({
                  id: Number(r?.sourceId ?? r?.id ?? 0),
                  label: String(r?.label ?? ""),
                  checked: Boolean(r?.checked),
                  setupAssignees: normalizeRequisiteAssignees(r?.setupAssignees),
                  removeAssignees: normalizeRequisiteAssignees(r?.removeAssignees),
                }))
              : [],
            lightPlot: Array.isArray(st?.lightPlot)
              ? st.lightPlot.map((f: any) => ({
                  id: Number(f?.sourceId ?? f?.id ?? 0),
                  label: String(f?.label ?? ""),
                  channel: String(f?.channel ?? ""),
                  x: Number(f?.x ?? 0),
                  y: Number(f?.y ?? 0),
                  angle: f?.angle ?? undefined,
                  length: f?.length ?? undefined,
                }))
              : [],
            lightCues: Array.isArray((st as any)?.lightCues)
              ? (st as any).lightCues.map((cue: any) => ({
                  id: Number(cue?.id ?? 0),
                  tSec: Number(cue?.tSec ?? 0),
                  channel: String(cue?.channel ?? ""),
                  intensity:
                    typeof cue?.intensity === "number" ? cue.intensity : undefined,
                  enabled: cue?.enabled ?? undefined,
                }))
              : undefined,
            lightKadrs:
              (st as any)?.lightKadrs && typeof (st as any).lightKadrs === "object"
                ? (st as any).lightKadrs
                : undefined,
            ...resolveStepTheaterFromApi(st),
            theaterSpotlights: Array.isArray(st?.theaterSpotlights)
              ? st.theaterSpotlights.map((sp: any) => mapTheaterSpotlightFromApi(sp))
              : [],
          }))
          .filter((x: any) => Number.isFinite(x.id) && x.id > 0);

        const normalizedPlaylist = (Array.isArray(playlistItems) ? playlistItems : [])
          .filter((pi: any) => String(pi?.sceneId ?? "") === String(scene.id))
          .sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
          .map((pi: any) => ({
            id: Number(pi?.sourceId ?? 0),
            title: String(pi?.title ?? ""),
            file: String(pi?.file ?? ""),
            fadeMs: typeof pi?.fadeMs === "number" ? pi.fadeMs : 500,
            loop: Boolean(pi?.loop),
            remoteKey: pi?.remoteKey ?? undefined,
            remoteUrl: pi?.remoteUrl ?? undefined,
          }))
          .filter((x: any) => Number.isFinite(x.id) && x.id > 0);

        const normalizedSounds = (Array.isArray(sounds) ? sounds : [])
          .filter((sd: any) => String(sd?.sceneId ?? "") === String(scene.id))
          .map((sd: any) => ({
            id: Number(sd?.sourceId ?? 0),
            title: String(sd?.title ?? ""),
            file: String(sd?.file ?? ""),
            icon: sd?.icon ?? undefined,
            iconRemoteKey: sd?.iconRemoteKey ?? undefined,
            iconRemoteUrl: sd?.iconRemoteUrl ?? undefined,
            volume: typeof sd?.volume === "number" ? sd.volume : 0.8,
            fadeMs: typeof sd?.fadeMs === "number" ? sd.fadeMs : 500,
            loop: Boolean(sd?.loop),
            remoteKey: sd?.remoteKey ?? undefined,
            remoteUrl: sd?.remoteUrl ?? undefined,
          }))
          .filter((x: any) => Number.isFinite(x.id) && x.id > 0);

        const normalizedLightChannels = normalizeLightChannelsFromServer(
          (Array.isArray(lightChannels) ? lightChannels : []).filter(
            (ch: any) => String(ch?.sceneId ?? "") === String(scene.id),
          ),
        );
        const layoutRow =
          (Array.isArray(theaterLayouts) ? theaterLayouts : []).find(
            (tl: any) => String(tl?.sceneId ?? "") === String(scene.id),
          ) ?? null;
        const normalizedLayout = resolveInitialTheaterLayout(
          effectiveProject,
          normalizeTheaterLayoutFromServer(layoutRow),
          DEFAULT_THEATER_LAYOUT,
        );

        const minimalSceneData: any = {
          name: scene.name,
          playlist: normalizedPlaylist,
          sounds: normalizedSounds,
          lightChannels: normalizedLightChannels,
        };
        const serverSceneRoles = (scene as any)?.sceneRoles ?? null;
        const isSceneRolesV1 = (v: any) =>
          v && typeof v === "object" && (v as any).v === 1 && (v as any).byStepId && typeof (v as any).byStepId === "object";
        if (isSceneRolesV1(serverSceneRoles)) {
          minimalSceneData.sceneRoles = serverSceneRoles;
        } else {
          const localRoles = loadSceneRolesFromStorage(effectiveProject);
          if (localRoles) minimalSceneData.sceneRoles = localRoles;
        }
        const serverLightFaders = (scene as any)?.lightFaders ?? null;
        if (serverLightFaders && typeof serverLightFaders === "object" && (serverLightFaders as any).v === 1) {
          minimalSceneData.lightFaders = serverLightFaders;
        }
        const serverLightPrograms = (scene as any)?.lightPrograms ?? null;
        if (serverLightPrograms && typeof serverLightPrograms === "object" && (serverLightPrograms as any).v === 1) {
          minimalSceneData.lightPrograms = serverLightPrograms;
        }
        const serverLightChannelRoles = (scene as any)?.lightChannelRoles ?? null;
        if (
          serverLightChannelRoles &&
          typeof serverLightChannelRoles === "object" &&
          (serverLightChannelRoles as any).v === 1
        ) {
          minimalSceneData.lightChannelRoles = serverLightChannelRoles;
        }
        const projectorBag = unpackProjectorMedia((scene as any)?.projectorMedia);
        if (projectorBag.videos.length > 0) {
          minimalSceneData.videos = projectorBag.videos;
        }
        if (projectorBag.holdImages.length > 0) {
          minimalSceneData.holdImages = projectorBag.holdImages;
        }
        if (projectorBag.projector) {
          minimalSceneData.projector = projectorBag.projector;
        }

        const stepsBeforeRepair = normalizedSteps.length ? normalizedSteps : steps;
        const nextStepsPayload = applySceneFaderBindingsToSpotlights(
          stepsBeforeRepair,
          minimalSceneData.lightFaders,
        );
        const bindingsRepaired =
          stableStringify(nextStepsPayload) !== stableStringify(stepsBeforeRepair);
        const wasReady = store.getState().scene.isSceneReady;
        let bootstrapPage: number | undefined;
        if (!wasReady && typeof window !== "undefined" && nextStepsPayload.length > 0) {
          const idRaw = localStorage.getItem(`selectedStepId:${effectiveProject}`);
          const pageRaw = localStorage.getItem(`selectedStepPage:${effectiveProject}`);
          const sid = idRaw != null && idRaw !== "" ? Number(idRaw) : Number.NaN;
          const sp = pageRaw != null && pageRaw !== "" ? Number(pageRaw) : Number.NaN;
          let idx = -1;
          if (Number.isFinite(sid)) {
            idx = nextStepsPayload.findIndex((s: any) => s.id === sid);
          }
          if (idx === -1 && Number.isFinite(sp)) {
            idx = Math.max(0, Math.min(Math.floor(sp), nextStepsPayload.length - 1));
          }
          if (idx !== -1) bootstrapPage = idx;
        }

        dispatch(
          sceneActions.hydrateScene({
            sceneData: minimalSceneData,
            theaterLayout: normalizedLayout,
            steps: nextStepsPayload,
            ...(bootstrapPage !== undefined ? { currentPage: bootstrapPage } : {}),
            isSceneReady: true,
            serverShadow: {
              sceneData: minimalSceneData,
              steps: nextStepsPayload,
              theaterLayout: normalizedLayout,
              lightChannels: normalizedLightChannels,
            },
          }),
        );
        dispatch(
          showScriptMarkdownActions.setLightChannels({
            projectSlug: effectiveProject,
            sceneName: "script",
            lightChannels: normalizedLightChannels,
          }),
        );
        dispatch(sceneActions.clearRealtimePullDeferred());
        localStorage.setItem("lastSyncAt", now);
        localStorage.setItem(perProjectKey, now);

        if (bindingsRepaired && tokenToUse && effectiveProject) {
          window.setTimeout(() => {
            void saveStepsRef.current({ force: true });
          }, 100);
        }

        const desktopPrefetch = getDesktopApi();
        if (desktopPrefetch?.invoke && typeof desktopPrefetch.invoke === "function") {
          const pid =
            typeof window !== "undefined"
              ? localStorage.getItem(`projectId:${effectiveProject}`)
              : null;
          void prefetchDesktopOfflineAfterSync({
            accessToken: tokenToUse,
            projectSlug: effectiveProject,
            projectId: pid,
            minimalSceneData,
            normalizedSteps: nextStepsPayload,
            normalizedLayout,
            normalizedLightChannels,
          }).then((result) => {
            if (result.rehydratePayload) {
              dispatch(sceneActions.hydrateScene(result.rehydratePayload as any));
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
        const loadedLocal = await hydrateSceneFromLocalPack(
          effectiveProject,
          dispatch,
        );
        if (!loadedLocal) {
          dispatch(sceneActions.setSceneReady(true));
        }
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
    const liveScene = store.getState().scene;
    const liveSteps = liveScene.steps;
    const liveSceneData = liveScene.sceneData;
    const liveTheaterLayout = liveScene.theaterLayout;
    const liveServerShadow = liveScene.serverShadow;
    const liveHasLocalEdits = liveScene.hasLocalEdits;
    const shouldSave = liveHasLocalEdits || Boolean(opts?.force);
    if (!shouldSave) return;
    const desktopApi = getDesktopApi();
    const token = accessToken ?? localStorage.getItem("accessToken");

    try {
      const current =
        liveSceneData ??
        (desktopApi ? await desktopReadProjectScene(desktopApi, projectName, "script") : null);

      const images = pruneSceneImages(
        (current as any)?.images as
          | Record<string, { remoteKey?: string; remoteUrl?: string }>
          | undefined,
        liveSteps,
      );
      const payload: any = {
        ...(current ?? {}),
        ...(liveSceneData ?? {}),
        steps: liveSteps,
        theaterLayout: liveTheaterLayout,
        lightFaders: liveSceneData?.lightFaders ?? (current as any)?.lightFaders,
        lightPrograms: liveSceneData?.lightPrograms ?? (current as any)?.lightPrograms,
        lightChannelRoles: liveSceneData?.lightChannelRoles ?? (current as any)?.lightChannelRoles,
        sceneRoles: liveSceneData?.sceneRoles ?? (current as any)?.sceneRoles,
        videos: liveSceneData?.videos ?? (current as any)?.videos ?? [],
        holdImages: liveSceneData?.holdImages ?? (current as any)?.holdImages ?? [],
        projector: liveSceneData?.projector ?? (current as any)?.projector,
        projectorMedia: packProjectorMedia({
          videos: liveSceneData?.videos ?? (current as any)?.videos,
          holdImages: liveSceneData?.holdImages ?? (current as any)?.holdImages,
          projector: liveSceneData?.projector ?? (current as any)?.projector,
        }),
        images,
        lightChannels: mergeLightChannelsPreferLonger(
          Array.isArray(liveSceneData?.lightChannels) ? liveSceneData.lightChannels : [],
          Array.isArray(showScriptUi.lightChannels) ? showScriptUi.lightChannels : [],
        ),
      };

      if (desktopApi) {
        const result = await desktopSaveProjectScene(desktopApi, projectName, "script", payload);
        if (!result?.ok) {
          console.error("Failed to save scene:", result?.error);
          return;
        }
      }

      if (token) {
        // Desktop: flush outbox first, then always run diff-push below (spotlights/faders may be missing from outbox).
        if (desktopApi) {
          try {
            await flushDesktopOutbox(token, projectName);
          } catch (err) {
            console.error("[sync] desktop outbox flush failed:", err);
          }
        }

        const projectId =
          localStorage.getItem(`projectId:${projectName}`) ??
          (await ensureRemoteProject(token));
        if (projectId) {
          const sceneId = `${projectId}:script`;
          const nowIso = new Date().toISOString();
          let payloadForServer: any = { ...payload };
          const nextSceneName = payloadForServer.name || `РЎС†РµРЅР° ${projectName}`;
          let serverShadowForDiff = store.getState().scene.serverShadow;

          // Ensure serverShadow is initialized once (without overwriting local edits).
          // This makes diffs precise without pull-on-every-push.
          if (!serverShadowForDiff) {
            try {
              const pull = await syncPull(token, null, projectName, {
                sounds: true,
                playlist: true,
                steps: true,
                theaterLayout: true,
                lightChannels: true,
              });
              const scenesArr = Array.isArray((pull as any)?.scenes) ? (pull as any).scenes : [];
              const sceneRow = scenesArr.find((s: any) => String(s?.id ?? "") === sceneId) ?? null;
              if (sceneRow) {
                const serverStepsRaw = Array.isArray((pull as any)?.steps)
                  ? (pull as any).steps.filter((st: any) => String(st?.sceneId ?? "") === sceneId)
                  : [];
                const prevSteps = [...serverStepsRaw]
                  .sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
                  .map((st: any) => ({
                    id: Number(st?.sourceId ?? 0),
                    title: String(st?.title ?? ""),
                    markdown: String(st?.markdown ?? ""),
                    playMarkdown: st?.playMarkdown ?? undefined,
                    explicationMarkdown: st?.explicationMarkdown ?? undefined,
                    durationMin: st?.durationMin ?? undefined,
                    kanbanStatus: st?.kanbanStatus ?? undefined,
                    kanbanOrder: st?.kanbanOrder ?? undefined,
                    requisites: Array.isArray(st?.requisites)
                      ? st.requisites.map((r: any) => ({
                          id: Number(r?.sourceId ?? r?.id ?? 0),
                          label: String(r?.label ?? ""),
                          checked: Boolean(r?.checked),
                          setupAssignees: normalizeRequisiteAssignees(r?.setupAssignees),
                          removeAssignees: normalizeRequisiteAssignees(r?.removeAssignees),
                        }))
                      : [],
                    lightPlot: Array.isArray(st?.lightPlot)
                      ? st.lightPlot.map((f: any) => ({
                          id: Number(f?.sourceId ?? f?.id ?? 0),
                          label: String(f?.label ?? ""),
                          channel: String(f?.channel ?? ""),
                          x: Number(f?.x ?? 0),
                          y: Number(f?.y ?? 0),
                          angle: f?.angle ?? undefined,
                          length: f?.length ?? undefined,
                        }))
                      : [],
                    lightCues: Array.isArray(st?.lightCues)
                      ? st.lightCues.map((cue: any) => ({
                          id: Number(cue?.id ?? 0),
                          tSec: Number(cue?.tSec ?? 0),
                          channel: String(cue?.channel ?? ""),
                          intensity:
                            typeof cue?.intensity === "number"
                              ? cue.intensity
                              : undefined,
                          enabled: cue?.enabled ?? undefined,
                        }))
                      : undefined,
                    lightKadrs:
                      (st as any)?.lightKadrs && typeof (st as any).lightKadrs === "object"
                        ? (st as any).lightKadrs
                        : undefined,
                    ...resolveStepTheaterFromApi(st),
                    theaterSpotlights: Array.isArray(st?.theaterSpotlights)
                      ? st.theaterSpotlights.map((sp: any) => mapTheaterSpotlightFromApi(sp))
                      : [],
                  }))
                  .filter((x: any) => Number.isFinite(x.id) && x.id > 0) as ScriptStep[];

                const playlistItems = Array.isArray((pull as any)?.playlistItems)
                  ? (pull as any).playlistItems.filter((pi: any) => String(pi?.sceneId ?? "") === sceneId)
                  : [];
                const sounds = Array.isArray((pull as any)?.sounds)
                  ? (pull as any).sounds.filter((sd: any) => String(sd?.sceneId ?? "") === sceneId)
                  : [];
                const normalizedPlaylist = playlistItems
                  .sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
                  .map((pi: any) => ({
                    id: Number(pi?.sourceId ?? 0),
                    title: String(pi?.title ?? ""),
                    file: String(pi?.file ?? ""),
                    fadeMs: typeof pi?.fadeMs === "number" ? pi.fadeMs : 500,
                    loop: Boolean(pi?.loop),
                    remoteKey: pi?.remoteKey ?? undefined,
                    remoteUrl: pi?.remoteUrl ?? undefined,
                  }))
                  .filter((x: any) => Number.isFinite(x.id) && x.id > 0);
                const normalizedSounds = sounds
                  .map((sd: any) => ({
                    id: Number(sd?.sourceId ?? 0),
                    title: String(sd?.title ?? ""),
                    file: String(sd?.file ?? ""),
                    icon: sd?.icon ?? undefined,
                    iconRemoteKey: sd?.iconRemoteKey ?? undefined,
                    iconRemoteUrl: sd?.iconRemoteUrl ?? undefined,
                    volume: typeof sd?.volume === "number" ? sd.volume : 0.8,
                    fadeMs: typeof sd?.fadeMs === "number" ? sd.fadeMs : 500,
                    loop: Boolean(sd?.loop),
                    remoteKey: sd?.remoteKey ?? undefined,
                    remoteUrl: sd?.remoteUrl ?? undefined,
                  }))
                  .filter((x: any) => Number.isFinite(x.id) && x.id > 0);

                const serverLightChannels = Array.isArray((pull as any)?.lightChannels)
                  ? (pull as any).lightChannels.filter((ch: any) => String(ch?.sceneId ?? "") === sceneId)
                  : [];
                const normalizedLight = normalizeLightChannelsFromServer(serverLightChannels);
                const layoutRow =
                  (Array.isArray((pull as any)?.theaterLayouts) ? (pull as any).theaterLayouts : []).find(
                    (tl: any) => String(tl?.sceneId ?? "") === sceneId,
                  ) ?? null;
                const normalizedLayout = resolveInitialTheaterLayout(
                  projectName,
                  normalizeTheaterLayoutFromServer(layoutRow),
                  DEFAULT_THEATER_LAYOUT,
                );

                const serverLightFaders = (sceneRow as any)?.lightFaders ?? null;
                const shadowSceneData: any = {
                  name: sceneRow?.name ?? "script",
                  playlist: normalizedPlaylist,
                  sounds: normalizedSounds,
                  lightChannels: normalizedLight,
                  ...(serverLightFaders && typeof serverLightFaders === "object"
                    ? { lightFaders: serverLightFaders }
                    : {}),
                  ...((sceneRow as any)?.lightPrograms && typeof (sceneRow as any).lightPrograms === "object"
                    ? { lightPrograms: (sceneRow as any).lightPrograms }
                    : {}),
                  ...((sceneRow as any)?.lightChannelRoles &&
                  typeof (sceneRow as any).lightChannelRoles === "object"
                    ? { lightChannelRoles: (sceneRow as any).lightChannelRoles }
                    : {}),
                  ...(() => {
                    const bag = unpackProjectorMedia((sceneRow as any)?.projectorMedia);
                    return {
                      ...(bag.videos.length > 0 ? { videos: bag.videos } : {}),
                      ...(bag.holdImages.length > 0 ? { holdImages: bag.holdImages } : {}),
                      ...(bag.projector ? { projector: bag.projector } : {}),
                    };
                  })(),
                };
                const shadowSteps = applySceneFaderBindingsToSpotlights(
                  prevSteps.length ? prevSteps : [],
                  serverLightFaders,
                );
                dispatch(
                  sceneActions.setServerShadow({
                    sceneData: shadowSceneData,
                    steps: shadowSteps,
                    theaterLayout: normalizedLayout,
                    lightChannels: normalizedLight,
                  }),
                );
                serverShadowForDiff = store.getState().scene.serverShadow;
              }
            } catch (_) {
              // ignore (fallback: diff will consider everything changed)
            }
          }

          if (Array.isArray(payloadForServer.sounds) && payloadForServer.sounds.length) {
            const bySourceId = new Map<number, any>();
            const shadowSounds = (serverShadowForDiff?.sceneData as any)?.sounds ?? [];
            (Array.isArray(shadowSounds) ? shadowSounds : []).forEach((ss: any) => {
              const sid = typeof ss?.id === "number" ? ss.id : null;
              if (sid != null) bySourceId.set(sid, ss);
            });
            payloadForServer.sounds = payloadForServer.sounds.map((s: any) => {
              const { filePath: _fp, ...rest } = s;
              const sound = { ...rest };
              const sid = typeof sound?.id === "number" ? sound.id : null;
              const server = sid != null ? bySourceId.get(sid) : null;
              if (server) {
                if (!sound.remoteKey && server.remoteKey) sound.remoteKey = server.remoteKey;
                if (!sound.remoteUrl && server.remoteUrl) sound.remoteUrl = server.remoteUrl;
                if (!sound.iconRemoteKey && server.iconRemoteKey) sound.iconRemoteKey = server.iconRemoteKey;
                if (!sound.iconRemoteUrl && server.iconRemoteUrl) sound.iconRemoteUrl = server.iconRemoteUrl;
              }
              return sound;
            });
          }

          const changes: SyncChange[] = [];

          // Send Scene meta only when needed (name changed or scene not yet shadowed).
          const prevSceneName = (serverShadowForDiff?.sceneData as any)?.name ?? null;
          const nameChanged = String(prevSceneName ?? "") !== String(nextSceneName ?? "");
          const prevSceneRoles = (serverShadowForDiff?.sceneData as any)?.sceneRoles ?? null;
          const nextSceneRoles = (payloadForServer as any)?.sceneRoles ?? null;
          const sceneRolesChanged = stableStringify(prevSceneRoles) !== stableStringify(nextSceneRoles);
          const prevLightFaders = (serverShadowForDiff?.sceneData as any)?.lightFaders ?? null;
          const nextLightFaders = (payloadForServer as any)?.lightFaders ?? null;
          const lightFadersChanged = stableStringify(prevLightFaders) !== stableStringify(nextLightFaders);
          const prevLightPrograms = (serverShadowForDiff?.sceneData as any)?.lightPrograms ?? null;
          const nextLightPrograms = (payloadForServer as any)?.lightPrograms ?? null;
          const lightProgramsChanged = stableStringify(prevLightPrograms) !== stableStringify(nextLightPrograms);
          const prevLightChannelRoles = (serverShadowForDiff?.sceneData as any)?.lightChannelRoles ?? null;
          const nextLightChannelRoles = (payloadForServer as any)?.lightChannelRoles ?? null;
          const lightChannelRolesChanged =
            stableStringify(prevLightChannelRoles) !== stableStringify(nextLightChannelRoles);
          const prevProjectorMedia = packProjectorMedia({
            videos: (serverShadowForDiff?.sceneData as any)?.videos,
            holdImages: (serverShadowForDiff?.sceneData as any)?.holdImages,
            projector: (serverShadowForDiff?.sceneData as any)?.projector,
          });
          const nextProjectorMedia = packProjectorMedia({
            videos: (payloadForServer as any)?.videos,
            holdImages: (payloadForServer as any)?.holdImages,
            projector: (payloadForServer as any)?.projector,
          });
          const projectorMediaChanged =
            stableStringify(prevProjectorMedia) !== stableStringify(nextProjectorMedia);

          if (
            !serverShadowForDiff ||
            nameChanged ||
            sceneRolesChanged ||
            lightFadersChanged ||
            lightProgramsChanged ||
            lightChannelRolesChanged ||
            projectorMediaChanged
          ) {
            const scenePayload: any = {
              id: sceneId,
              projectId,
              name: nextSceneName,
              updatedAt: nowIso,
            };
            if (!serverShadowForDiff || sceneRolesChanged) {
              scenePayload.sceneRoles = nextSceneRoles;
            }
            if (!serverShadowForDiff || lightFadersChanged) {
              scenePayload.lightFaders = nextLightFaders;
            }
            if (!serverShadowForDiff || lightProgramsChanged) {
              scenePayload.lightPrograms = nextLightPrograms;
            }
            if (!serverShadowForDiff || lightChannelRolesChanged) {
              scenePayload.lightChannelRoles = nextLightChannelRoles;
            }
            if (!serverShadowForDiff || projectorMediaChanged) {
              scenePayload.projectorMedia = nextProjectorMedia;
            }
            changes.push({
              id: createId(),
              entityType: "Scene",
              entityId: sceneId,
              operation: "update",
              payload: scenePayload,
              createdAt: nowIso,
            });
          }

          // Playlist (scene-level)
          const nextPlaylist = Array.isArray(payloadForServer.playlist)
            ? (payloadForServer.playlist as any[])
            : [];
          const prevPlaylistById = new Map<number, { item: any; order: number }>();
          const shadowPlaylist = ((serverShadowForDiff?.sceneData as any)?.playlist ?? []) as any[];
          (Array.isArray(shadowPlaylist) ? shadowPlaylist : []).forEach((x: any, idx: number) => {
            const id = typeof x?.id === "number" ? x.id : null;
            if (id == null) return;
            // Redux state can be frozen (dev). Never mutate `x` in-place.
            const order = typeof x?.order === "number" ? x.order : idx;
            prevPlaylistById.set(id, { item: x, order });
          });
          const nextPlaylistIds = new Set(
            nextPlaylist.map((x: any) => (typeof x?.id === "number" ? x.id : null)).filter(Boolean),
          );
          nextPlaylist.forEach((it: any, order: number) => {
            const sourceId = typeof it?.id === "number" ? it.id : null;
            if (sourceId == null) return;
            const prevEntry = prevPlaylistById.get(sourceId) ?? null;
            const prev = prevEntry?.item ?? null;
            const nextPayload = {
              sceneId,
              sourceId,
              order: typeof it?.order === "number" ? it.order : order,
              title: String(it?.title ?? `Track ${sourceId}`),
              file: String(it?.file ?? ""),
              remoteUrl: it?.remoteUrl ?? null,
              remoteKey: it?.remoteKey ?? null,
              fadeMs: typeof it?.fadeMs === "number" ? it.fadeMs : 0,
              loop: Boolean(it?.loop),
            };
            const prevPayload = prev
              ? {
                  sceneId,
                  sourceId,
                  order: typeof prevEntry?.order === "number" ? prevEntry.order : Number(prev?.order ?? 0),
                  title: String(prev?.title ?? ""),
                  file: String(prev?.file ?? ""),
                  remoteUrl: prev?.remoteUrl ?? null,
                  remoteKey: prev?.remoteKey ?? null,
                  fadeMs: typeof prev?.fadeMs === "number" ? prev.fadeMs : 0,
                  loop: Boolean(prev?.loop),
                }
              : null;
            if (prevPayload && stableStringify(prevPayload) === stableStringify(nextPayload)) {
              return;
            }
            changes.push({
              id: createId(),
              entityType: "PlaylistItem",
              entityId: `${sceneId}:playlist:${sourceId}`,
              operation: prev ? "update" : "create",
              payload: nextPayload,
              createdAt: nowIso,
            });
          });
          Array.from(prevPlaylistById.keys()).forEach((id) => {
            if (!nextPlaylistIds.has(id)) {
              changes.push({
                id: createId(),
                entityType: "PlaylistItem",
                entityId: `${sceneId}:playlist:${id}`,
                operation: "delete",
                payload: { sceneId, sourceId: id, updatedAt: nowIso },
                createdAt: nowIso,
              });
            }
          });

          // Sounds (scene-level)
          const nextSounds = Array.isArray(payloadForServer.sounds)
            ? (payloadForServer.sounds as any[])
            : [];
          const prevSoundById = new Map<number, any>();
          const shadowSounds2 = ((serverShadowForDiff?.sceneData as any)?.sounds ?? []) as any[];
          (Array.isArray(shadowSounds2) ? shadowSounds2 : []).forEach((x: any) => {
            const id = typeof x?.id === "number" ? x.id : null;
            if (id != null) prevSoundById.set(id, x);
          });
          const nextSoundIds = new Set(
            nextSounds.map((x: any) => (typeof x?.id === "number" ? x.id : null)).filter(Boolean),
          );
          nextSounds.forEach((it: any) => {
            const sourceId = typeof it?.id === "number" ? it.id : null;
            if (sourceId == null) return;
            const prev = prevSoundById.get(sourceId) ?? null;
            const nextPayload = {
              sceneId,
              sourceId,
              title: String(it?.title ?? `Sound ${sourceId}`),
              file: String(it?.file ?? ""),
              icon: it?.icon ?? null,
              remoteUrl: it?.remoteUrl ?? null,
              remoteKey: it?.remoteKey ?? null,
              iconRemoteUrl: it?.iconRemoteUrl ?? null,
              iconRemoteKey: it?.iconRemoteKey ?? null,
              volume: typeof it?.volume === "number" ? it.volume : 1,
              fadeMs: typeof it?.fadeMs === "number" ? it.fadeMs : 0,
              loop: Boolean(it?.loop),
            };
            const prevPayload = prev
              ? {
                  sceneId,
                  sourceId,
                  title: String(prev?.title ?? ""),
                  file: String(prev?.file ?? ""),
                  icon: prev?.icon ?? null,
                  remoteUrl: prev?.remoteUrl ?? null,
                  remoteKey: prev?.remoteKey ?? null,
                  iconRemoteUrl: prev?.iconRemoteUrl ?? null,
                  iconRemoteKey: prev?.iconRemoteKey ?? null,
                  volume: typeof prev?.volume === "number" ? prev.volume : 1,
                  fadeMs: typeof prev?.fadeMs === "number" ? prev.fadeMs : 0,
                  loop: Boolean(prev?.loop),
                }
              : null;
            if (prevPayload && stableStringify(prevPayload) === stableStringify(nextPayload)) {
              return;
            }
            changes.push({
              id: createId(),
              entityType: "Sound",
              entityId: `${sceneId}:sound:${sourceId}`,
              operation: prev ? "update" : "create",
              payload: nextPayload,
              createdAt: nowIso,
            });
          });
          Array.from(prevSoundById.keys()).forEach((id) => {
            if (!nextSoundIds.has(id)) {
              changes.push({
                id: createId(),
                entityType: "Sound",
                entityId: `${sceneId}:sound:${id}`,
                operation: "delete",
                payload: { sceneId, sourceId: id, updatedAt: nowIso },
                createdAt: nowIso,
              });
            }
          });

          // Global light channels (scene-level)
          const prevLight = Array.isArray(serverShadowForDiff?.lightChannels)
            ? serverShadowForDiff!.lightChannels
            : Array.from({ length: 8 }, () => "");
          const nextLight = Array.isArray(payloadForServer.lightChannels)
            ? (payloadForServer.lightChannels as any[]).map((x: any) => String(x ?? ""))
            : Array.from({ length: 8 }, () => "");
          for (let i = 0; i < Math.max(prevLight.length, nextLight.length, 8); i++) {
            const a = String(prevLight[i] ?? "");
            const b = String(nextLight[i] ?? "");
            if (a === b) continue;
            changes.push({
              id: createId(),
              entityType: "GlobalLightChannel",
              entityId: `${sceneId}:lightChannel:${i}`,
              operation: "update",
              payload: { sceneId, index: i, raw: b, updatedAt: nowIso },
              createdAt: nowIso,
            });
          }

          // Theater layout (scene-level)
          const prevLayout = serverShadowForDiff?.theaterLayout ?? null;
          const nextLayout = (payloadForServer as any)?.theaterLayout ?? null;
          if (nextLayout && stableStringify(prevLayout ?? null) !== stableStringify(nextLayout ?? null)) {
            changes.push({
              id: createId(),
              entityType: "TheaterLayout",
              entityId: `${sceneId}:theaterLayout`,
              operation: prevLayout ? "update" : "create",
              payload: { sceneId, ...(nextLayout as any), updatedAt: nowIso },
              createdAt: nowIso,
            });
          }

          const prevSteps = Array.isArray(serverShadowForDiff?.steps) ? serverShadowForDiff!.steps : [];

          const prevById = new Map<number, { step: ScriptStep; order: number }>();
          prevSteps.forEach((s, idx) => prevById.set(s.id, { step: s, order: idx }));

          const newIds = new Set(liveSteps.map((s) => s.id));
          const stepFingerprint = (step: ScriptStep, order: number) =>
            stableStringify({
              title: step.title,
              markdown: step.markdown ?? "",
              playMarkdown: step.playMarkdown ?? null,
              explicationMarkdown: (step as any)?.explicationMarkdown ?? null,
              durationMin: step.durationMin ?? null,
              kanbanStatus: step.kanbanStatus ?? null,
              kanbanOrder: step.kanbanOrder ?? null,
              requisites: step.requisites ?? [],
              lightPlot: step.lightPlot ?? [],
              lightCues: (step as any)?.lightCues ?? [],
              lightKadrs: (step as any)?.lightKadrs ?? null,
              ...stepTheaterSyncPayload(step),
              theaterSpotlights: Array.isArray((step as any)?.theaterSpotlights)
                ? (step as any).theaterSpotlights.map((sp: TheaterSpotlight) =>
                    mapTheaterSpotlightToSync(sp),
                  )
                : [],
              order,
            });

          liveSteps.forEach((step, index) => {
            const stepKey = `${sceneId}:${step.id}`;
            const prev = prevById.get(step.id) ?? null;
            if (prev) {
              const a = stepFingerprint(prev.step, prev.order);
              const b = stepFingerprint(step, index);
              if (a === b) return;
            }
            changes.push({
              id: createId(),
              entityType: "Step",
              entityId: stepKey,
              operation: prev ? "update" : "create",
              payload: {
                id: stepKey,
                sceneId,
                sourceId: step.id,
                title: step.title,
                markdown: step.markdown ?? "",
                playMarkdown: step.playMarkdown ?? null,
                explicationMarkdown: (step as any)?.explicationMarkdown ?? null,
                durationMin: (step as any)?.durationMin ?? null,
                kanbanStatus: (step as any)?.kanbanStatus ?? null,
                kanbanOrder: (step as any)?.kanbanOrder ?? null,
                order: index,
                requisites: Array.isArray((step as any)?.requisites) ? (step as any).requisites : [],
                lightPlot: Array.isArray((step as any)?.lightPlot) ? (step as any).lightPlot : [],
                lightCues: Array.isArray((step as any)?.lightCues)
                  ? (step as any).lightCues
                  : [],
                lightKadrs: (step as any)?.lightKadrs ?? null,
                ...stepTheaterSyncPayload(step as ScriptStep),
                theaterSpotlights: Array.isArray((step as any)?.theaterSpotlights)
                  ? (step as any).theaterSpotlights.map((sp: TheaterSpotlight) =>
                      mapTheaterSpotlightToSync(sp),
                    )
                  : [],
                updatedAt: nowIso,
              },
              createdAt: nowIso,
            });
          });
          Array.from(prevById.keys()).forEach((id) => {
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
            // If some orchestra-image keys were removed locally, trigger GC on server.
            try {
              const prevKeys = serverShadowForDiff
                ? extractReferencedRemoteImageKeysFromSteps(serverShadowForDiff.steps)
                : new Set<string>();
              const nextKeys = extractReferencedRemoteImageKeysFromSteps(liveSteps);
              let removed = 0;
              prevKeys.forEach((k) => {
                if (!nextKeys.has(k)) removed += 1;
              });
              if (removed > 0) {
                void cleanupProjectImages(token, projectName).catch(() => null);
              }
            } catch (_) {}
            // after successful push: accept local state as new serverShadow baseline
            dispatch(
              sceneActions.setServerShadow({
                sceneData: {
                  ...(serverShadowForDiff?.sceneData ?? {}),
                  name: nextSceneName,
                  sceneRoles:
                    (payloadForServer as any)?.sceneRoles ??
                    (serverShadowForDiff?.sceneData as any)?.sceneRoles ??
                    undefined,
                  lightFaders:
                    (payloadForServer as any)?.lightFaders ??
                    (serverShadowForDiff?.sceneData as any)?.lightFaders ??
                    undefined,
                  lightPrograms:
                    (payloadForServer as any)?.lightPrograms ??
                    (serverShadowForDiff?.sceneData as any)?.lightPrograms ??
                    undefined,
                  lightChannelRoles:
                    (payloadForServer as any)?.lightChannelRoles ??
                    (serverShadowForDiff?.sceneData as any)?.lightChannelRoles ??
                    undefined,
                  videos: Array.isArray((payloadForServer as any)?.videos)
                    ? (payloadForServer as any).videos
                    : [],
                  holdImages: Array.isArray((payloadForServer as any)?.holdImages)
                    ? (payloadForServer as any).holdImages
                    : (serverShadowForDiff?.sceneData as any)?.holdImages ?? [],
                  projector:
                    (payloadForServer as any)?.projector ??
                    (serverShadowForDiff?.sceneData as any)?.projector ??
                    undefined,
                  playlist: Array.isArray(payloadForServer.playlist) ? payloadForServer.playlist : [],
                  sounds: Array.isArray(payloadForServer.sounds) ? payloadForServer.sounds : [],
                  lightChannels: Array.isArray((payloadForServer as any)?.lightChannels)
                    ? (payloadForServer as any).lightChannels.map((x: any) => String(x ?? ""))
                    : [],
                },
                steps: liveSteps,
                theaterLayout: liveTheaterLayout,
                lightChannels: Array.isArray((payloadForServer as any)?.lightChannels)
                  ? (payloadForServer as any).lightChannels.map((x: any) => String(x ?? ""))
                  : Array.isArray(showScriptUi.lightChannels)
                    ? showScriptUi.lightChannels.map((x: any) => String(x ?? ""))
                    : Array.from({ length: 8 }, () => ""),
              }),
            );
            dispatch(sceneActions.markSaved());
            if (projectName) {
              writeTheaterLayoutDraft(projectName, liveTheaterLayout);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to save/push scene:", error);
    }
  }, [projectName, accessToken, ensureRemoteProject, dispatch, showScriptUi.lightChannels]);

  saveStepsRef.current = saveStepsForLightPlot;

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
