import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ScriptStep, TheaterLayout } from "../../../shared/types/script";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { pruneSceneImages } from "../../../shared/utils/markdownImages";
import {
  syncPull,
  syncPush,
  type SyncChange,
} from "../../../sync/api";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../../project/model/project-context";

const DEFAULT_THEATER_LAYOUT: TheaterLayout = {
  hallWidth: 9,
  hallDepth: 6,
  wallHeight: 6,
  audienceStartZ: 3,
  seatRows: 4,
  seatsPerRow: 7,
  seatSpacing: 1.1,
  rowSpacing: 0.8,
  rowRise: 0.25,
  aisleWidth: 1.2,
  aisleCenterX: 0,
  doorWidth: 1.2,
  doorHeight: 2.2,
  doorZ: -6,
};

export interface SceneData {
  name?: string;
  steps?: ScriptStep[];
  playlist?: any[];
  sounds?: any[];
  theaterLayout?: TheaterLayout;
}

export interface SceneContextValue {
  sceneData: SceneData | null;
  setSceneData: React.Dispatch<React.SetStateAction<SceneData | null>>;
  steps: ScriptStep[];
  setSteps: React.Dispatch<React.SetStateAction<ScriptStep[]>>;
  theaterLayout: TheaterLayout;
  setTheaterLayout: React.Dispatch<React.SetStateAction<TheaterLayout>>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  isSceneReady: boolean;
  addStep: (atPage?: number) => void;
  deleteStep: (id: number) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  saveStepsForLightPlot: () => Promise<void>;
  pushSceneAfterSoundsSave: () => Promise<void>;
  syncFromServer: (token?: string | null, projectOverride?: string) => Promise<void>;
  registerPlaylistPlay: (handler: (trackId: number) => void) => void;
  handleTrackLinkClick: (trackId: number) => void;
}

const SceneContext = createContext<SceneContextValue | null>(null);

export function SceneProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, setAccessToken } = useAuth();
  const { projectName, ensureRemoteProject } = useProject();

  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  const [steps, setStepsState] = useState<ScriptStep[]>([]);
  const [theaterLayout, setTheaterLayoutState] = useState<TheaterLayout>(DEFAULT_THEATER_LAYOUT);
  const [currentPage, setCurrentPage] = useState(0);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [, setLastSyncAt] = useState<string | null>(() =>
    localStorage.getItem("lastSyncAt")
  );

  const playlistPlayRef = useRef<(trackId: number) => void>();
  const selectedStepIdRef = useRef<number | null>(null);
  const restoredStepRef = useRef(false);
  const lightPlotSaveTimerRef = useRef<number | null>(null);
  const hasLocalEditsRef = useRef(false);

  const syncFromServer = useCallback(
    async (token?: string | null, projectOverride?: string) => {
      // Берём актуальный токен из localStorage (интерцептор обновляет его при refresh)
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
          effectiveProject
        );
        const project = projects.find((p: any) => p.slug === effectiveProject);
        if (!project) return;
        const scene = scenes.find((s: any) => s.projectId === project.id);
        if (!scene) return;
        const raw = (scene.rawJson as any) ?? {};
        hasLocalEditsRef.current = false;
        setSceneData(raw || null);
        setTheaterLayoutState(raw.theaterLayout || DEFAULT_THEATER_LAYOUT);
        setStepsState((prev) => (raw.steps?.length ? raw.steps : prev));
        setLastSyncAt(now);
        localStorage.setItem("lastSyncAt", now);
        localStorage.setItem(perProjectKey, now);
      } catch (error: any) {
        if (error?.response?.status === 401) {
          setAccessToken(null);
          localStorage.removeItem("accessToken");
          return;
        }
        console.error("[sync] pull failed:", error);
      }
    },
    [accessToken, projectName, setAccessToken, ensureRemoteProject]
  );

  useEffect(() => {
    if (!projectName) return;
    setSceneData(null);
    setStepsState([]);
    setTheaterLayoutState(DEFAULT_THEATER_LAYOUT);
    setCurrentPage(0);
    selectedStepIdRef.current = null;
    restoredStepRef.current = false;
    setIsSceneReady(false);

    let cancelled = false;
    const loadScene = async () => {
      const desktopApi = getDesktopApi();
      if (!desktopApi) {
        if (cancelled) return;
        setSceneData(null);
        setTheaterLayoutState(DEFAULT_THEATER_LAYOUT);
        setStepsState([]);
        setCurrentPage(0);
        setIsSceneReady(true);
        return;
      }
      try {
        const scene = await desktopApi.readProjectScene(projectName, "script");
        if (cancelled) return;
        hasLocalEditsRef.current = false;
        setSceneData(scene || null);
        setTheaterLayoutState(scene?.theaterLayout ?? DEFAULT_THEATER_LAYOUT);
        setStepsState(scene?.steps ?? []);
        setCurrentPage(0);
        selectedStepIdRef.current = null;
        restoredStepRef.current = false;
        setIsSceneReady(true);
      } catch (error) {
        if (!cancelled) {
          setSceneData(null);
          setTheaterLayoutState(DEFAULT_THEATER_LAYOUT);
          setStepsState([]);
          setCurrentPage(0);
          setIsSceneReady(false);
        }
      }
    };
    void loadScene();
    return () => {
      cancelled = true;
    };
  }, [projectName]);

  // Один sync при появлении (токен, проект); при смене проекта — один sync для новой пары
  const lastSyncedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!accessToken || !projectName) return;
    const key = `${accessToken}:${projectName}`;
    if (lastSyncedKeyRef.current === key) return;
    lastSyncedKeyRef.current = key;
    void syncFromServer(accessToken, projectName);
  }, [accessToken, projectName, syncFromServer]);

  const setSteps = useCallback((action: React.SetStateAction<ScriptStep[]>) => {
    hasLocalEditsRef.current = true;
    setStepsState(action);
  }, []);
  const setTheaterLayout = useCallback((action: React.SetStateAction<TheaterLayout>) => {
    hasLocalEditsRef.current = true;
    setTheaterLayoutState(action);
  }, []);

  const addStep = useCallback(() => {
    hasLocalEditsRef.current = true;
    setStepsState((prev) => {
      const nextId = prev.reduce((acc, step) => Math.max(acc, step.id), 0) + 1;
      const insertIndex = Math.min(currentPage + 1, prev.length);
      const sourceStep = prev[currentPage];
      const nextRequisites = sourceStep?.requisites
        ? sourceStep.requisites.map((item) => ({ ...item, checked: false }))
        : [];
      const nextItem: ScriptStep = {
        id: nextId,
        title: `Шаг ${nextId}`,
        markdown: "",
        requisites: nextRequisites,
      };
      const next = [...prev];
      next.splice(insertIndex, 0, nextItem);
      setCurrentPage(insertIndex);
      return next;
    });
  }, [currentPage]);

  const deleteStep = useCallback((id: number) => {
    hasLocalEditsRef.current = true;
    setStepsState((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        setCurrentPage(0);
        return [{ id: 1, title: "Новый шаг", markdown: "" }];
      }
      setCurrentPage((p) => Math.min(p, next.length - 1));
      return next;
    });
  }, []);

  const reorderSteps = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    hasLocalEditsRef.current = true;
    setStepsState((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setCurrentPage((prev) => {
      if (prev === fromIndex) return toIndex;
      if (fromIndex < toIndex && prev > fromIndex && prev <= toIndex) return prev - 1;
      if (fromIndex > toIndex && prev < fromIndex && prev >= toIndex) return prev + 1;
      return prev;
    });
  }, []);

  const saveStepsForLightPlot = useCallback(async () => {
    if (!projectName || !hasLocalEditsRef.current) return;
    const desktopApi = getDesktopApi();
    if (!desktopApi) return;
    const token = accessToken ?? localStorage.getItem("accessToken");
    try {
      const current = await desktopApi.readProjectScene(projectName, "script");
      const images = pruneSceneImages(current?.images as Record<string, { remoteKey?: string; remoteUrl?: string }> | undefined, steps);
      const payload = { ...current, steps, theaterLayout, images };
      const result = await desktopApi.saveProjectScene(projectName, "script", payload);
      if (!result?.ok) {
        console.error("Failed to save light plot steps:", result?.error);
      }
      if (token) {
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
              id: crypto.randomUUID(),
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
          const existingSteps: ScriptStep[] = (current?.steps as ScriptStep[]) ?? [];
          const existingIds = new Set(existingSteps.map((s) => s.id));
          const newIds = new Set(steps.map((s) => s.id));
          steps.forEach((step, index) => {
            const stepKey = `${sceneId}:${step.id}`;
            changes.push({
              id: crypto.randomUUID(),
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
                id: crypto.randomUUID(),
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
            hasLocalEditsRef.current = false;
          }
        }
      }
    } catch (error) {
      console.error("Failed to save light plot steps:", error);
    }
  }, [accessToken, projectName, steps, theaterLayout, ensureRemoteProject]);

  /** Как в плейлисте: звуки уже с remoteKey/remoteUrl (загружаются при добавлении). Просто пушим сцену с диска. */
  const pushSceneAfterSoundsSave = useCallback(async () => {
    const desktopApi = getDesktopApi();
    if (!desktopApi) return;
    const token = accessToken ?? localStorage.getItem("accessToken");
    if (!token || !projectName) return;
    try {
      const scene = await desktopApi.readProjectScene(projectName, "script");
      if (!scene) return;
      const projectId =
        localStorage.getItem(`projectId:${projectName}`) ??
        (await ensureRemoteProject(token));
      if (!projectId) return;

      const sceneId = `${projectId}:script`;
      const nowIso = new Date().toISOString();
      const soundsForServer = Array.isArray(scene.sounds)
        ? scene.sounds.map((s: any) => {
            const { filePath: _fp, ...rest } = s;
            return rest;
          })
        : scene.sounds;
      const payloadForServer = { ...scene, sounds: soundsForServer };

      await syncPush(token, [
        {
          id: crypto.randomUUID(),
          entityType: "Scene",
          entityId: sceneId,
          operation: "update",
          payload: {
            id: sceneId,
            projectId,
            name: (payloadForServer.name as string) || `Сцена ${projectName}`,
            rawJson: payloadForServer,
            updatedAt: nowIso,
          },
          createdAt: nowIso,
        },
      ]);
    } catch (error) {
      console.error("[sync] push scene after sounds save failed:", error);
    }
  }, [accessToken, projectName, ensureRemoteProject]);

  const registerPlaylistPlay = useCallback((handler: (trackId: number) => void) => {
    playlistPlayRef.current = handler;
  }, []);

  const handleTrackLinkClick = useCallback((trackId: number) => {
    playlistPlayRef.current?.(trackId);
  }, []);

  useEffect(() => {
    selectedStepIdRef.current = steps[currentPage]?.id ?? null;
  }, [projectName, steps, currentPage]);

  useEffect(() => {
    if (!restoredStepRef.current) {
      restoredStepRef.current = true;
      const storedIdRaw = localStorage.getItem(`selectedStepId:${projectName}`);
      const storedId = storedIdRaw ? Number(storedIdRaw) : null;
      if (storedId != null && steps.length > 0) {
        const idx = steps.findIndex((s) => s.id === storedId);
        if (idx !== -1) setCurrentPage(idx);
      }
    }
    if (steps.length === 0) {
      setCurrentPage(0);
      return;
    }
    const selectedId = selectedStepIdRef.current;
    if (selectedId != null) {
      const nextIndex = steps.findIndex((s) => s.id === selectedId);
      if (nextIndex !== -1 && nextIndex !== currentPage) setCurrentPage(nextIndex);
    }
    if (currentPage > steps.length - 1) setCurrentPage(steps.length - 1);
  }, [projectName, steps, currentPage]);

  useEffect(() => {
    const selectedId = steps[currentPage]?.id;
    if (selectedId != null) {
      localStorage.setItem(`selectedStepId:${projectName}`, String(selectedId));
    }
  }, [projectName, steps, currentPage]);

  useEffect(() => {
    if (!isSceneReady || steps.length === 0 || !hasLocalEditsRef.current) return;
    if (lightPlotSaveTimerRef.current) {
      window.clearTimeout(lightPlotSaveTimerRef.current);
    }
    lightPlotSaveTimerRef.current = window.setTimeout(() => {
      void saveStepsForLightPlot();
    }, 600);
    return () => {
      if (lightPlotSaveTimerRef.current) {
        window.clearTimeout(lightPlotSaveTimerRef.current);
      }
    };
  }, [isSceneReady, steps.length, theaterLayout, saveStepsForLightPlot]);

  const value: SceneContextValue = {
    sceneData,
    setSceneData,
    steps,
    setSteps,
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

  return (
    <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
  );
}

export function useScene(): SceneContextValue {
  const ctx = React.useContext(SceneContext);
  if (!ctx) throw new Error("useScene must be used within SceneProvider");
  return ctx;
}

export { DEFAULT_THEATER_LAYOUT };

