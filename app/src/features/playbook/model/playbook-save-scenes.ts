import {
  packProjectorMedia,
} from "../../projector/model/playbook-projector-persist";
import type { ScriptScene, TheaterSpotlight } from "../../../shared/types/script";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  desktopReadProjectPlaybook,
  desktopSaveProjectPlaybook,
} from "../../../shared/platform/desktop-methods";
import { pruneSceneImages } from "../../../shared/utils/markdownImages";
import { createId } from "../../../shared/utils/createId";
import { stableStringify } from "../../../shared/utils/stableStringify";
import { dispatchSyncPush } from "../../../shared/api/rtk/sync-dispatch";
import type { SyncChange } from "../../../sync/api/types/sync";
import { cleanupProjectImages } from "../../../sync/api/projects";
import { flushDesktopOutbox } from "../../../sync/desktopOutbox";
import type { AppDispatch } from "../../../shared/store/store";
import { store } from "../../../shared/store/store";
import {
  selectShowScriptMarkdownUi,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import { sceneTheaterSyncPayload } from "../../theater/model/theater-scene-models";
import {
  prepareSceneLightBindings,
  mapTheaterSpotlightToSync,
} from "../../theater/model/theater-light-fader-bindings";
import { commitTheaterLayoutBaseline } from "../../theater/model/theater-layout-draft-storage";
import { playbookActions } from "./playbook-slice";
import {
  extractReferencedRemoteImageKeysFromScenes,
} from "./playbook-normalize";
import {
  resolveLightChannelsForPersist,
} from "../../../shared/components/light-console/light-channels-mutate";
import { prepareLightProgramsForPersist, buildCompleteLightFaders } from "../../../shared/components/light-console/light-console-data";
import { ensurePlaybookServerShadowForPush } from "./playbook-ensure-server-shadow";

export type SavePlaybookScenesDeps = {
  projectName: string | undefined;
  accessToken: string | null;
  ensureRemoteProject: (token: string) => Promise<string | null>;
  dispatch: AppDispatch;
};

export async function savePlaybookScenesForLightPlot(
  deps: SavePlaybookScenesDeps,
  opts?: { force?: boolean },
) {
  const { projectName, accessToken, ensureRemoteProject, dispatch } = deps;
  if (!projectName) return;
  const livePlaybook = store.getState().playbook;
  const liveScenes = livePlaybook.scenes;
  const livePlaybookData = livePlaybook.playbookData;
  const liveTheaterLayout = livePlaybook.theaterLayout;
  const liveServerShadow = livePlaybook.serverShadow;
  const liveHasLocalEdits = livePlaybook.hasLocalEdits;
  if (!livePlaybook.isPlaybookReady) return;

  const shadowSceneCount = Array.isArray(liveServerShadow?.scenes)
    ? liveServerShadow!.scenes.length
    : 0;
  const localBehindServer =
    shadowSceneCount > 1 && liveScenes.length < shadowSceneCount * 0.8;
  if (localBehindServer && !liveHasLocalEdits) {
    console.warn("[sync] skip push: local scenes fewer than server baseline", {
      local: liveScenes.length,
      server: shadowSceneCount,
    });
    return;
  }

  const shouldSave = liveHasLocalEdits || Boolean(opts?.force);
  if (!shouldSave) return;
  const desktopApi = getDesktopApi();
  const token = accessToken ?? localStorage.getItem("accessToken");

  try {
    const current =
      livePlaybookData ??
      (desktopApi ? await desktopReadProjectPlaybook(desktopApi, projectName, "script") : null);

    const images = pruneSceneImages(
      (current as any)?.images as
        | Record<string, { remoteKey?: string; remoteUrl?: string }>
        | undefined,
      liveScenes,
    );
    const liveShowScriptUi = selectShowScriptMarkdownUi(
      store.getState(),
      projectName || "fools",
      "script",
    );
    const preparedBindings = prepareSceneLightBindings(
      liveScenes,
      livePlaybookData?.lightFaders ?? (current as any)?.lightFaders,
    );
    const preparedScenes = preparedBindings.scenes;
    const preparedLightFaders =
      preparedBindings.lightFaders ??
      livePlaybookData?.lightFaders ??
      (current as any)?.lightFaders;
    const persistedLightChannels = resolveLightChannelsForPersist(
      liveShowScriptUi.lightChannels,
      livePlaybookData?.lightChannels,
    );
    const preparedLightPrograms = prepareLightProgramsForPersist({
      lightFaders: buildCompleteLightFaders(preparedLightFaders ?? undefined),
      lightPrograms: livePlaybookData?.lightPrograms ?? (current as any)?.lightPrograms,
      lightChannelsCount: persistedLightChannels.length,
      activeChannel: liveShowScriptUi.selectedLightSlot,
    });
    const payload: any = {
      ...(current ?? {}),
      ...(livePlaybookData ?? {}),
      scenes: preparedScenes,
      theaterLayout: liveTheaterLayout,
      lightFaders: preparedLightFaders,
      lightPrograms: preparedLightPrograms,
      lightChannelRoles: livePlaybookData?.lightChannelRoles ?? (current as any)?.lightChannelRoles,
      sceneRoles: livePlaybookData?.sceneRoles ?? (current as any)?.sceneRoles,
      videos: livePlaybookData?.videos ?? (current as any)?.videos ?? [],
      holdImages: livePlaybookData?.holdImages ?? (current as any)?.holdImages ?? [],
      projector: livePlaybookData?.projector ?? (current as any)?.projector,
      projectorMedia: packProjectorMedia({
        videos: livePlaybookData?.videos ?? (current as any)?.videos,
        holdImages: livePlaybookData?.holdImages ?? (current as any)?.holdImages,
        projector: livePlaybookData?.projector ?? (current as any)?.projector,
      }),
      images,
      lightChannels: persistedLightChannels,
    };
    delete payload.lightNotesRun;

    const commitSavedBaseline = (payloadForShadow: any, scenesForShadow: ScriptScene[]) => {
      dispatch(
        playbookActions.setServerShadow({
          playbookData: {
            ...(liveServerShadow?.playbookData ?? {}),
            name: payloadForShadow.name,
            sceneRoles: payloadForShadow.sceneRoles,
            lightFaders: payloadForShadow.lightFaders,
            lightPrograms: payloadForShadow.lightPrograms,
            lightChannelRoles: payloadForShadow.lightChannelRoles,
            videos: Array.isArray(payloadForShadow.videos) ? payloadForShadow.videos : [],
            holdImages: Array.isArray(payloadForShadow.holdImages)
              ? payloadForShadow.holdImages
              : [],
            projector: payloadForShadow.projector,
            playlist: Array.isArray(payloadForShadow.playlist) ? payloadForShadow.playlist : [],
            sounds: Array.isArray(payloadForShadow.sounds) ? payloadForShadow.sounds : [],
            lightChannels: Array.isArray(payloadForShadow.lightChannels)
              ? payloadForShadow.lightChannels.map((x: any) => String(x ?? ""))
              : [],
          },
          scenes: scenesForShadow,
          theaterLayout: liveTheaterLayout,
          lightChannels: Array.isArray(payloadForShadow.lightChannels)
            ? payloadForShadow.lightChannels.map((x: any) => String(x ?? ""))
            : Array.from({ length: 8 }, () => ""),
        }),
      );
      dispatch(playbookActions.markSaved());
      if (projectName) {
        commitTheaterLayoutBaseline(projectName, liveTheaterLayout);
      }
    };

    if (desktopApi) {
      const result = await desktopSaveProjectPlaybook(desktopApi, projectName, "script", payload);
      if (!result?.ok) {
        console.error("Failed to save scene:", result?.error);
        return;
      }
      if (!token) {
        commitSavedBaseline(payload, preparedScenes);
      }
    }

    if (token) {
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
        const nextSceneName = payloadForServer.name || `Сцена ${projectName}`;

        await ensurePlaybookServerShadowForPush(dispatch, token, projectName, sceneId);
        let serverShadowForDiff = store.getState().playbook.serverShadow;

        if (Array.isArray(payloadForServer.sounds) && payloadForServer.sounds.length) {
          const bySourceId = new Map<number, any>();
          const shadowSounds = (serverShadowForDiff?.playbookData as any)?.sounds ?? [];
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

        const prevSceneName = (serverShadowForDiff?.playbookData as any)?.name ?? null;
        const nameChanged = String(prevSceneName ?? "") !== String(nextSceneName ?? "");
        const prevSceneRoles = (serverShadowForDiff?.playbookData as any)?.sceneRoles ?? null;
        const nextSceneRoles = (payloadForServer as any)?.sceneRoles ?? null;
        const sceneRolesChanged = stableStringify(prevSceneRoles) !== stableStringify(nextSceneRoles);
        const prevLightFaders = (serverShadowForDiff?.playbookData as any)?.lightFaders ?? null;
        const nextLightFaders = (payloadForServer as any)?.lightFaders ?? null;
        const lightFadersChanged = stableStringify(prevLightFaders) !== stableStringify(nextLightFaders);
        const prevLightPrograms = (serverShadowForDiff?.playbookData as any)?.lightPrograms ?? null;
        const nextLightPrograms = (payloadForServer as any)?.lightPrograms ?? null;
        const lightProgramsChanged = stableStringify(prevLightPrograms) !== stableStringify(nextLightPrograms);
        const prevLightChannelRoles = (serverShadowForDiff?.playbookData as any)?.lightChannelRoles ?? null;
        const nextLightChannelRoles = (payloadForServer as any)?.lightChannelRoles ?? null;
        const lightChannelRolesChanged =
          stableStringify(prevLightChannelRoles) !== stableStringify(nextLightChannelRoles);
        const prevProjectorMedia = packProjectorMedia({
          videos: (serverShadowForDiff?.playbookData as any)?.videos,
          holdImages: (serverShadowForDiff?.playbookData as any)?.holdImages,
          projector: (serverShadowForDiff?.playbookData as any)?.projector,
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
            if (!(nextSceneRoles == null && prevSceneRoles != null)) {
              scenePayload.sceneRoles = nextSceneRoles;
            }
          }
          if (!serverShadowForDiff || lightFadersChanged) {
            if (!(nextLightFaders == null && prevLightFaders != null)) {
              scenePayload.lightFaders = nextLightFaders;
            }
          }
          if (!serverShadowForDiff || lightProgramsChanged) {
            if (!(nextLightPrograms == null && prevLightPrograms != null)) {
              scenePayload.lightPrograms = nextLightPrograms;
            }
          }
          if (!serverShadowForDiff || lightChannelRolesChanged) {
            if (!(nextLightChannelRoles == null && prevLightChannelRoles != null)) {
              scenePayload.lightChannelRoles = nextLightChannelRoles;
            }
          }
          if (!serverShadowForDiff || projectorMediaChanged) {
            if (!(nextProjectorMedia == null && prevProjectorMedia != null)) {
              scenePayload.projectorMedia = nextProjectorMedia;
            }
          }
          changes.push({
            id: createId(),
            entityType: "Playbook",
            entityId: sceneId,
            operation: "update",
            payload: scenePayload,
            createdAt: nowIso,
          });
        }

        const nextPlaylist = Array.isArray(payloadForServer.playlist)
          ? (payloadForServer.playlist as any[])
          : [];
        const prevPlaylistById = new Map<number, { item: any; order: number }>();
        const shadowPlaylist = ((serverShadowForDiff?.playbookData as any)?.playlist ?? []) as any[];
        (Array.isArray(shadowPlaylist) ? shadowPlaylist : []).forEach((x: any, idx: number) => {
          const id = typeof x?.id === "number" ? x.id : null;
          if (id == null) return;
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

        const nextSounds = Array.isArray(payloadForServer.sounds)
          ? (payloadForServer.sounds as any[])
          : [];
        const prevSoundById = new Map<number, any>();
        const shadowSounds2 = ((serverShadowForDiff?.playbookData as any)?.sounds ?? []) as any[];
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

        const prevLight = Array.isArray(serverShadowForDiff?.lightChannels)
          ? serverShadowForDiff!.lightChannels
          : [];
        const nextLight = Array.isArray(payloadForServer.lightChannels)
          ? (payloadForServer.lightChannels as any[]).map((x: any) => String(x ?? ""))
          : [];
        for (let i = 0; i < nextLight.length; i++) {
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
        for (let i = nextLight.length; i < prevLight.length; i++) {
          changes.push({
            id: createId(),
            entityType: "GlobalLightChannel",
            entityId: `${sceneId}:lightChannel:${i}`,
            operation: "delete",
            payload: { sceneId, index: i, updatedAt: nowIso },
            createdAt: nowIso,
          });
        }

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

        const prevScenes = Array.isArray(serverShadowForDiff?.scenes) ? serverShadowForDiff!.scenes : [];

        const prevById = new Map<number, { scene: ScriptScene; order: number }>();
        prevScenes.forEach((s, idx) => prevById.set(s.id, { scene: s, order: idx }));

        const newIds = new Set(preparedScenes.map((s) => s.id));
        const sceneFingerprint = (scene: ScriptScene, order: number) =>
          stableStringify({
            title: scene.title,
            markdown: scene.markdown ?? "",
            playMarkdown: scene.playMarkdown ?? null,
            explicationMarkdown: (scene as any)?.explicationMarkdown ?? null,
            durationMin: scene.durationMin ?? null,
            kanbanStatus: scene.kanbanStatus ?? null,
            kanbanOrder: scene.kanbanOrder ?? null,
            requisites: scene.requisites ?? [],
            lightPlot: scene.lightPlot ?? [],
            lightCues: (scene as any)?.lightCues ?? [],
            lightKadrs: (scene as any)?.lightKadrs ?? null,
            ...sceneTheaterSyncPayload(scene),
            theaterSpotlights: Array.isArray((scene as any)?.theaterSpotlights)
              ? (scene as any).theaterSpotlights.map((sp: TheaterSpotlight) =>
                  mapTheaterSpotlightToSync(sp),
                )
              : [],
            order,
          });

        preparedScenes.forEach((scene, index) => {
          const sceneKey = `${sceneId}:${scene.id}`;
          const prev = prevById.get(scene.id) ?? null;
          if (prev) {
            const a = sceneFingerprint(prev.scene, prev.order);
            const b = sceneFingerprint(scene, index);
            if (a === b) return;
          }
          changes.push({
            id: createId(),
            entityType: "Scene",
            entityId: sceneKey,
            operation: prev ? "update" : "create",
            payload: {
              id: sceneKey,
              playbookId: sceneId,
              sourceId: scene.id,
              title: scene.title,
              markdown: scene.markdown ?? "",
              playMarkdown: scene.playMarkdown ?? null,
              explicationMarkdown: (scene as any)?.explicationMarkdown ?? null,
              durationMin: (scene as any)?.durationMin ?? null,
              kanbanStatus: (scene as any)?.kanbanStatus ?? null,
              kanbanOrder: (scene as any)?.kanbanOrder ?? null,
              order: index,
              requisites: Array.isArray((scene as any)?.requisites) ? (scene as any).requisites : [],
              lightPlot: Array.isArray((scene as any)?.lightPlot) ? (scene as any).lightPlot : [],
              lightCues: Array.isArray((scene as any)?.lightCues) ? (scene as any).lightCues : [],
              lightKadrs: (scene as any)?.lightKadrs ?? null,
              ...sceneTheaterSyncPayload(scene as ScriptScene),
              theaterSpotlights: Array.isArray((scene as any)?.theaterSpotlights)
                ? (scene as any).theaterSpotlights.map((sp: TheaterSpotlight) =>
                    mapTheaterSpotlightToSync(sp),
                  )
                : [],
              updatedAt: nowIso,
            },
            createdAt: nowIso,
          });
        });
        const sceneDeletes: SyncChange[] = [];
        Array.from(prevById.keys()).forEach((id) => {
          if (!newIds.has(id)) {
            sceneDeletes.push({
              id: createId(),
              entityType: "Scene",
              entityId: `${sceneId}:${id}`,
              operation: "delete",
              payload: { id: `${sceneId}:${id}`, updatedAt: nowIso },
              createdAt: nowIso,
            });
          }
        });
        const sceneDeleteThreshold = Math.max(2, Math.ceil(prevScenes.length * 0.4));
        if (sceneDeletes.length >= sceneDeleteThreshold && !liveHasLocalEdits) {
          console.warn("[sync] skip mass scene delete in push", {
            deleteCount: sceneDeletes.length,
            prevScenes: prevScenes.length,
            liveScenes: liveScenes.length,
          });
        } else {
          changes.push(...sceneDeletes);
        }

        if (changes.length > 0) {
          await dispatchSyncPush({ changes });
          try {
            const prevKeys = serverShadowForDiff
              ? extractReferencedRemoteImageKeysFromScenes(serverShadowForDiff.scenes)
              : new Set<string>();
            const nextKeys = extractReferencedRemoteImageKeysFromScenes(preparedScenes);
            let removed = 0;
            prevKeys.forEach((k) => {
              if (!nextKeys.has(k)) removed += 1;
            });
            if (removed > 0) {
              void cleanupProjectImages(token, projectName).catch(() => null);
            }
          } catch (_) {
            /* ignore */
          }
          commitSavedBaseline(payloadForServer, preparedScenes);
        } else {
          commitSavedBaseline(payload, preparedScenes);
        }
      }
    } else if (!desktopApi) {
      commitSavedBaseline(payload, preparedScenes);
    }
  } catch (error) {
    console.error("Failed to save/push scene:", error);
  }
}
