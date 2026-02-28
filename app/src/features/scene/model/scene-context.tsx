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
        const {
          now,
          projects,
          scenes,
          steps: serverSteps,
          playlistItems,
          sounds,
        } = await syncPull(
          tokenToUse,
          effectiveLastSyncAt,
          effectiveProject,
          { steps: true, playlist: true, sounds: true },
        );
        const project = projects.find((p: any) => p.slug === effectiveProject);
        if (!project) return;
        const expectedSceneId = `${project.id}:script`;
        const scene =
          scenes.find((s: any) => s.id === expectedSceneId) ??
          scenes.find((s: any) => s.projectId === project.id && s.name === "script") ??
          scenes.find((s: any) => s.projectId === project.id);
        if (!scene) return;
        const normalizedSteps = (Array.isArray(serverSteps) ? serverSteps : [])
          .filter((st: any) => String(st?.sceneId ?? "") === String(scene.id))
          .sort((a: any, b: any) => (Number(a?.order ?? 0) - Number(b?.order ?? 0)))
          .map((st: any) => ({
            id: Number(st?.sourceId ?? 0),
            title: String(st?.title ?? ""),
            markdown: String(st?.markdown ?? ""),
            playMarkdown: st?.playMarkdown ?? undefined,
            durationMin: st?.durationMin ?? undefined,
            kanbanStatus: st?.kanbanStatus ?? undefined,
            kanbanOrder: st?.kanbanOrder ?? undefined,
            cast: (st?.cast as any) ?? undefined,
            requisites: Array.isArray(st?.requisites)
              ? st.requisites.map((r: any) => ({
                  id: Number(r?.sourceId ?? r?.id ?? 0),
                  label: String(r?.label ?? ""),
                  checked: Boolean(r?.checked),
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
            theaterModels: Array.isArray(st?.theaterModels)
              ? st.theaterModels.map((m: any) => ({
                  id: Number(m?.sourceId ?? m?.id ?? 0),
                  name: String(m?.name ?? ""),
                  type: m?.type ?? undefined,
                  builtin: m?.builtin ?? undefined,
                  allowOutOfBounds: Boolean(m?.allowOutOfBounds),
                  position: m?.position,
                  rotation: m?.rotation,
                  scale: m?.scale,
                }))
              : [],
            theaterSpotlights: Array.isArray(st?.theaterSpotlights)
              ? st.theaterSpotlights.map((sp: any) => ({
                  id: Number(sp?.sourceId ?? sp?.id ?? 0),
                  label: String(sp?.label ?? ""),
                  position: sp?.position,
                  target: sp?.target,
                  angleDeg: Number(sp?.angleDeg ?? 0),
                  intensity: Number(sp?.intensity ?? 0),
                  color: sp?.color ?? undefined,
                  enabled: Boolean(sp?.enabled),
                  channel: sp?.channel ?? undefined,
                  isRgb: sp?.isRgb ?? undefined,
                }))
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

        const minimalSceneData: any = {
          name: scene.name,
          playlist: normalizedPlaylist,
          sounds: normalizedSounds,
        };
        dispatch(
          sceneActions.hydrateScene({
            sceneData: minimalSceneData,
            theaterLayout: DEFAULT_THEATER_LAYOUT,
            steps: normalizedSteps.length ? normalizedSteps : steps,
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

          // Web path: use server state as "prev" baseline for diffs (playlist/sounds).
          // Also preserve remoteKey/remoteUrl for sounds if desktop stored only filePath.
          let serverSounds: any[] = [];
          let serverPlaylistItems: any[] = [];
          try {
            const pull = await syncPull(token, null, projectName, { sounds: true, playlist: true });
            serverSounds = Array.isArray((pull as any)?.sounds)
              ? (pull as any).sounds.filter((ss: any) => String(ss?.sceneId ?? "") === sceneId)
              : [];
            serverPlaylistItems = Array.isArray((pull as any)?.playlistItems)
              ? (pull as any).playlistItems.filter((pi: any) => String(pi?.sceneId ?? "") === sceneId)
              : [];
          } catch (_) {}

          if (Array.isArray(payloadForServer.sounds) && payloadForServer.sounds.length) {
            const bySourceId = new Map<number, any>();
            serverSounds.forEach((ss: any) => {
              const sid = typeof ss?.sourceId === "number" ? ss.sourceId : null;
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
                updatedAt: nowIso,
              },
              createdAt: nowIso,
            },
          ];

          // Playlist (scene-level)
          const nextPlaylist = Array.isArray(payloadForServer.playlist)
            ? (payloadForServer.playlist as any[])
            : [];
          const prevPlaylistIds = new Set(
            serverPlaylistItems
              .map((x: any) => (typeof x?.sourceId === "number" ? x.sourceId : null))
              .filter(Boolean),
          );
          const nextPlaylistIds = new Set(
            nextPlaylist.map((x: any) => (typeof x?.id === "number" ? x.id : null)).filter(Boolean),
          );
          nextPlaylist.forEach((it: any, order: number) => {
            const sourceId = typeof it?.id === "number" ? it.id : null;
            if (sourceId == null) return;
            changes.push({
              id: createId(),
              entityType: "PlaylistItem",
              entityId: `${sceneId}:playlist:${sourceId}`,
              operation: prevPlaylistIds.has(sourceId) ? "update" : "create",
              payload: {
                sceneId,
                sourceId,
                order: typeof it?.order === "number" ? it.order : order,
                title: String(it?.title ?? `Track ${sourceId}`),
                file: String(it?.file ?? ""),
                remoteUrl: it?.remoteUrl ?? null,
                remoteKey: it?.remoteKey ?? null,
                fadeMs: typeof it?.fadeMs === "number" ? it.fadeMs : 0,
                loop: Boolean(it?.loop),
              },
              createdAt: nowIso,
            });
          });
          prevPlaylistIds.forEach((id) => {
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
          const prevSoundIds = new Set(
            serverSounds
              .map((x: any) => (typeof x?.sourceId === "number" ? x.sourceId : null))
              .filter(Boolean),
          );
          const nextSoundIds = new Set(
            nextSounds.map((x: any) => (typeof x?.id === "number" ? x.id : null)).filter(Boolean),
          );
          nextSounds.forEach((it: any) => {
            const sourceId = typeof it?.id === "number" ? it.id : null;
            if (sourceId == null) return;
            changes.push({
              id: createId(),
              entityType: "Sound",
              entityId: `${sceneId}:sound:${sourceId}`,
              operation: prevSoundIds.has(sourceId) ? "update" : "create",
              payload: {
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
              },
              createdAt: nowIso,
            });
          });
          prevSoundIds.forEach((id) => {
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
          const prevLight = Array.isArray((current as any)?.lightChannels)
            ? ((current as any).lightChannels as any[])
            : [];
          const nextLight = Array.isArray(payloadForServer.lightChannels)
            ? (payloadForServer.lightChannels as any[])
            : [];
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
          const prevLayout = (current as any)?.theaterLayout ?? null;
          const nextLayout = (payloadForServer as any)?.theaterLayout ?? null;
          if (nextLayout && JSON.stringify(prevLayout ?? null) !== JSON.stringify(nextLayout ?? null)) {
            changes.push({
              id: createId(),
              entityType: "TheaterLayout",
              entityId: `${sceneId}:theaterLayout`,
              operation: prevLayout ? "update" : "create",
              payload: { sceneId, ...(nextLayout as any), updatedAt: nowIso },
              createdAt: nowIso,
            });
          }

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

