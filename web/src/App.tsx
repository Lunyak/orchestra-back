import { type AxiosError } from "axios";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import "./App.css";
import { Header } from "./components/header/Header";
import { HeaderPlayer, type HeaderSound } from "./components/header/HeaderPlayer";
import { PlaylistSidebar, type PlaylistTrack } from "./components/playlist-sidebar/PlaylistSidebar";
import { ProjectPanel } from "./components/project-panel/ProjectPanel";
import {
  ScriptStepsSidebar,
  type ScriptStepsSidebarProps,
} from "./components/script-steps-sidebar/ScriptStepsSidebar";
import {
  ensureProject,
  fetchProjects,
  getApiBaseUrl,
  getPlayUrl,
  getProjectMembers,
  inviteToProject,
  syncPull,
  syncPush,
  type ProjectMemberInfo,
  type SyncChange,
} from "./sync/api";
import { login, register } from "./sync/auth";
import { ScriptStep, TheaterLayout } from "./types/script";

const ShowScript = lazy(() =>
  import("./components/show-script/ShowScript").then((module) => ({
    default: module.ShowScript,
  }))
);

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

function AppInner() {
  const [steps, setSteps] = useState<ScriptStep[]>([]);
  const [theaterLayout, setTheaterLayout] = useState<TheaterLayout>(
    DEFAULT_THEATER_LAYOUT
  );
  const [sceneData, setSceneData] = useState<{
    name?: string;
    steps?: ScriptStep[];
    playlist?: PlaylistTrack[];
    sounds?: HeaderSound[];
    theaterLayout?: TheaterLayout;
  } | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [projectName, setProjectName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [isSceneReady, setIsSceneReady] = useState(false);
  const activeView = "script" as const;
  const [currentPage, setCurrentPage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [showRequisites, setShowRequisites] = useState(() => {
    const stored = localStorage.getItem("showRequisites");
    return stored === "true";
  });
  const [showPlaylistSidebar, setShowPlaylistSidebar] = useState(true);
  const [showHeaderSounds, setShowHeaderSounds] = useState(true);
  const [isStepsCollapsed, setIsStepsCollapsed] = useState(false);
  const [isMobilePlaylistOpen, setIsMobilePlaylistOpen] = useState(false);
  const [isMobileStepsOpen, setIsMobileStepsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem("accessToken")
  );
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() =>
    localStorage.getItem("lastSyncAt")
  );
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const location = useLocation();
  const playlistPlayRef = useRef<(trackId: number) => void>();
  const selectedStepIdRef = useRef<number | null>(null);
  const restoredStepRef = useRef(false);
  const lightPlotSaveTimerRef = useRef<number | null>(null);
  /** Версия сцены с сервера (updatedAt). Пушим только если есть локальные правки. */
  const lastKnownServerSceneVersionRef = useRef<string | null>(null);
  const hasLocalEditsRef = useRef(false);
  const [lightChannels, setLightChannels] = useState<string[]>(
    Array.from({ length: 9 }, () => ""),
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberInfo[]>([]);
  const [isProjectOwner, setIsProjectOwner] = useState<boolean | null>(null);
  const initialSyncRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  const addStep = () => {
    hasLocalEditsRef.current = true;
    setSteps((prev) => {
      const nextId = prev.reduce((acc, step) => Math.max(acc, step.id), 0) + 1;
      const insertIndex = Math.min(currentPage + 1, prev.length);
      const sourceStep = prev[currentPage];
      const nextRequisites = sourceStep?.requisites
        ? sourceStep.requisites.map((item) => ({
          ...item,
          checked: false,
        }))
        : [];
      const nextItem: ScriptStep = {
        id: nextId,
        title: `Шаг ${nextId}`,
        markdown: "",
        requisites: nextRequisites,
      };
      const nextSteps = [...prev];
      nextSteps.splice(insertIndex, 0, nextItem);
      setCurrentPage(insertIndex);
      return nextSteps;
    });
  };

  const deleteStep = (id: number) => {
    hasLocalEditsRef.current = true;
    const nextSteps = steps.filter((step) => step.id !== id);
    if (nextSteps.length === 0) {
      const fallback = { id: 1, title: "Новый шаг", markdown: "" };
      setSteps([fallback]);
      setCurrentPage(0);
      return;
    }
    setSteps(nextSteps);
    setCurrentPage((prev) => Math.min(prev, nextSteps.length - 1));
  };

  const reorderSteps = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    hasLocalEditsRef.current = true;
    setSteps((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setCurrentPage((prev) => {
      if (prev === fromIndex) return toIndex;
      if (fromIndex < toIndex) {
        if (prev > fromIndex && prev <= toIndex) return prev - 1;
      } else if (fromIndex > toIndex) {
        if (prev < fromIndex && prev >= toIndex) return prev + 1;
      }
      return prev;
    });
  }, []);

  const loadProjects = useCallback(
    async (prefer?: string) => {
      if (!accessToken) return;
      try {
        const remoteProjects = await fetchProjects(accessToken);
        const slugs = remoteProjects.map((p) => p.slug);
        setProjects(slugs);
        const stored = localStorage.getItem("selectedProject") || "";
        const initial = prefer && slugs.includes(prefer)
          ? prefer
          : slugs.includes(stored)
            ? stored
            : slugs[0] || "";
        if (initial) {
          setProjectName(initial);
        }
      } catch (error) {
        console.error("[projects] failed to load:", error);
        setProjects([]);
      }
    },
    [accessToken],
  );

  const ensureRemoteProject = useCallback(
    async (token?: string | null) => {
      const tokenToUse = token ?? accessToken;
      if (!tokenToUse || !projectName) return null;
      const key = `projectId:${projectName}`;
      const existing = localStorage.getItem(key);
      if (existing) return existing;

      try {
        const project = await ensureProject(
          tokenToUse,
          projectName,
          `Проект ${projectName}`,
        );
        localStorage.setItem(key, project.id);
        return project.id;
      } catch (error) {
        console.error("[sync] ensureProject failed:", error);
        return null;
      }
    },
    [accessToken, projectName],
  );

  // lastSyncAt намеренно не включаем в зависимости, чтобы избежать бесконечного цикла pull
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const syncFromServer = useCallback(async (token?: string | null, projectOverride?: string) => {
    const tokenToUse = token ?? accessToken;
    const effectiveProject = projectOverride ?? projectName;
    if (!tokenToUse || !effectiveProject) return;
    try {
      const projectId = await ensureRemoteProject(tokenToUse);
      if (!projectId) return;

      const perProjectKey = `lastSyncAt:${effectiveProject}`;
      const effectiveLastSyncAt =
        localStorage.getItem(perProjectKey) ?? lastSyncAt;

      const { now, projects, scenes } = await syncPull(
        tokenToUse,
        effectiveLastSyncAt,
        effectiveProject,
      );

      const project = projects.find((p) => p.slug === effectiveProject);
      if (!project) return;

      const scene = scenes.find(
        (s: { projectId: string; updatedAt?: string | Date; rawJson?: unknown }) =>
          s.projectId === project.id
      );
      if (!scene) return;

      const raw = (scene.rawJson as Record<string, unknown>) ?? {};
      setSceneData(raw || null);
      setTheaterLayout((raw.theaterLayout as TheaterLayout) || DEFAULT_THEATER_LAYOUT);
      setSteps((raw.steps as ScriptStep[]) || []);
      const rawLightChannels =
        Array.isArray(raw.lightChannels) && raw.lightChannels.length > 0
          ? raw.lightChannels
          : [];
      const normalizedLightChannels = Array.from(
        { length: 9 },
        (_, index) =>
          rawLightChannels[index] != null ? String(rawLightChannels[index]) : "",
      );
      setLightChannels(normalizedLightChannels);

      setLastSyncAt(now);
      localStorage.setItem("lastSyncAt", now);
      localStorage.setItem(perProjectKey, now);

      lastKnownServerSceneVersionRef.current =
        scene.updatedAt != null ? String(scene.updatedAt) : null;
      hasLocalEditsRef.current = false;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 401) {
          setAccessToken(null);
          localStorage.removeItem("accessToken");
          return;
        }
      }
      console.error("[sync] pull failed:", error);
    }
  }, [accessToken, ensureRemoteProject, projectName, setAccessToken]);

  useEffect(() => {
    if (!accessToken) return;
    void loadProjects();
  }, [accessToken, loadProjects]);

  // WebSocket-подписка: при обновлении сцены на сервере (в т.ч. с десктопа)
  // автоматически тянем свежие данные через syncFromServer.
  useEffect(() => {
    if (!accessToken || !projectName) return;

    let cancelled = false;

    const setup = async () => {
      const projectId = await ensureRemoteProject();
      if (!projectId || cancelled) return;

      const socket = io("http://213.226.126.196:3000", {
        transports: ["websocket"],
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("join-project", { projectId });
      });

      socket.on("scene-updated", (payload: { projectId: string }) => {
        if (!payload?.projectId || payload.projectId !== projectId) return;
        void syncFromServer();
      });
    };

    void setup();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [accessToken, projectName, ensureRemoteProject, syncFromServer]);

  // Один автоматический pull после появления accessToken и выбранного проекта
  useEffect(() => {
    if (!accessToken || !projectName) return;
    if (initialSyncRef.current) return;
    initialSyncRef.current = true;
    void syncFromServer();
  }, [accessToken, projectName, syncFromServer]);

  const handleProjectChange = useCallback(
    (name: string) => {
      setProjectName(name);
      setSceneData(null);
      setSteps([]);
      setTheaterLayout(DEFAULT_THEATER_LAYOUT);
      setLightChannels(Array.from({ length: 9 }, () => ""));
      if (!accessToken) return;
      void syncFromServer(undefined, name);
    },
    [accessToken, syncFromServer],
  );

  useEffect(() => {
    if (!projectName) return;
    localStorage.setItem("selectedProject", projectName);
  }, [projectName]);

  useEffect(() => {
    localStorage.setItem("showRequisites", String(showRequisites));
  }, [showRequisites]);

  useEffect(() => {
    if (sceneData && steps.length > 0) {
      setIsSceneReady(true);
    } else {
      setIsSceneReady(false);
    }
  }, [sceneData, steps.length]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 980);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile && (isMobilePlaylistOpen || isMobileStepsOpen)) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, isMobilePlaylistOpen, isMobileStepsOpen]);

  const StepsSidebar = ScriptStepsSidebar as ComponentType<
    ScriptStepsSidebarProps & {
      showRequisites: boolean;
      onToggleRequisites: () => void;
      showPlaylist: boolean;
      onTogglePlaylist: () => void;
      showHeaderSounds: boolean;
      onToggleHeaderSounds: () => void;
    }
  >;

  const registerPlaylistPlay = useCallback((handler: (trackId: number) => void) => {
    playlistPlayRef.current = handler;
  }, []);

  const handleTrackLinkClick = useCallback((trackId: number) => {
    playlistPlayRef.current?.(trackId);
  }, []);

  const handleCreateProject = async () => {
    const value = newProjectName.trim();
    if (!value || !accessToken) return;
    try {
      const project = await ensureProject(
        accessToken,
        value,
        `Проект ${value}`,
      );
      setNewProjectName("");
      await loadProjects(project.slug);
    } catch (error) {
      console.error("createProject failed:", error);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectName || !accessToken) return;
    const confirmed = window.confirm(
      `Удалить проект "${projectName}"? Это пометит проект как удалённый на сервере.`,
    );
    if (!confirmed) return;
    try {
      const projectId =
        localStorage.getItem(`projectId:${projectName}`) ??
        (await ensureRemoteProject(accessToken));
      if (!projectId) {
        console.error("deleteProject failed: projectId not found");
        return;
      }
      const nowIso = new Date().toISOString();
      const change: SyncChange = {
        id: crypto.randomUUID(),
        entityType: "Project",
        entityId: projectId,
        operation: "delete",
        payload: {
          id: projectId,
          updatedAt: nowIso,
        },
        createdAt: nowIso,
      };
      await syncPush(accessToken, [change]);
      localStorage.removeItem(`projectId:${projectName}`);
      await loadProjects();
    } catch (error) {
      console.error("deleteProject failed:", error);
    }
  };

  useEffect(() => {
    selectedStepIdRef.current = steps[currentPage]?.id ?? null;
  }, [projectName, steps, currentPage]);

  useEffect(() => {
    if (!restoredStepRef.current) {
      restoredStepRef.current = true;
      const storedIdRaw = localStorage.getItem(`selectedStepId:${projectName}`);
      const storedId = storedIdRaw ? Number(storedIdRaw) : null;
      if (storedId && steps.length > 0) {
        const restoredIndex = steps.findIndex((step) => step.id === storedId);
        if (restoredIndex !== -1) {
          setCurrentPage(restoredIndex);
        }
      }
    }

    if (steps.length === 0) {
      setCurrentPage(0);
      return;
    }
    const selectedId = selectedStepIdRef.current;
    if (selectedId == null) return;
    const nextIndex = steps.findIndex((step) => step.id === selectedId);
    if (nextIndex !== -1 && nextIndex !== currentPage) {
      setCurrentPage(nextIndex);
      return;
    }
    if (currentPage > steps.length - 1) {
      setCurrentPage(steps.length - 1);
    }
  }, [projectName, steps, currentPage]);

  useEffect(() => {
    const selectedId = steps[currentPage]?.id;
    if (!selectedId) return;
    localStorage.setItem(`selectedStepId:${projectName}`, String(selectedId));
  }, [projectName, steps, currentPage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isToggleShortcut =
        key === "r" && (event.metaKey || event.ctrlKey) && !event.shiftKey;
      if (!isToggleShortcut) return;

      event.preventDefault();
      setIsEditing((prev) => !prev);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const saveStepsForLightPlot = useCallback(async () => {
    if (!projectName) return;
    try {
      const baseScene = sceneData ?? {};
      const fullPayload = {
        ...baseScene,
        name: baseScene.name || `Сцена ${projectName}`,
        steps,
        theaterLayout,
        lightChannels,
      };
      // Теперь сохраняем и плейлист (music) в rawJson,
      // чтобы web-правки плейлиста не затирали данные с десктопа.
      const payload = {
        ...fullPayload,
      };

      // Отправляем изменения сцены и шагов на сервер, если пользователь авторизован
      const token = accessToken || localStorage.getItem("accessToken");
      if (token) {
        const projectId =
          localStorage.getItem(`projectId:${projectName}`) ??
          (await ensureRemoteProject(token));

        if (projectId) {
          const sceneId = `${projectId}:script`;
          const nowIso = new Date().toISOString();

          const changes: SyncChange[] = [];

          changes.push({
            id: crypto.randomUUID(),
            entityType: "Scene",
            entityId: sceneId,
            operation: "update",
            payload: {
              id: sceneId,
              projectId,
              name: payload.name || `Сцена ${projectName}`,
              rawJson: payload,
              updatedAt: nowIso,
            },
            createdAt: nowIso,
          });

          const existingSteps: ScriptStep[] =
            ((sceneData?.steps as ScriptStep[]) ?? []);
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
                sceneId: sceneId,
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
              const stepKey = `${sceneId}:${id}`;
              changes.push({
                id: crypto.randomUUID(),
                entityType: "Step",
                entityId: stepKey,
                operation: "delete",
                payload: {
                  id: stepKey,
                  updatedAt: nowIso,
                },
                createdAt: nowIso,
              });
            }
          });

          if (changes.length > 0) {
            try {
              await syncPush(token, changes);
              hasLocalEditsRef.current = false;
            } catch (error) {
              console.error("[sync] push failed:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to save light plot steps:", error);
    }
  }, [accessToken, ensureRemoteProject, lightChannels, projectName, sceneData, steps, theaterLayout]);

  const handleLogout = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }, []);

  useEffect(() => {
    if (location.pathname !== "/settings" || !accessToken || !projectName) return;
    setIsProjectOwner(null);
    getProjectMembers(accessToken, projectName)
      .then((res) => {
        setProjectMembers(res.members ?? []);
        setIsProjectOwner(true);
      })
      .catch((err: unknown) => {
        const axiosError = err as AxiosError<{ message?: string }>;
        if (axiosError?.response?.status === 403) {
          setIsProjectOwner(false);
          setProjectMembers([]);
        } else {
          setIsProjectOwner(true);
          setProjectMembers([]);
        }
      });
  }, [location.pathname, accessToken, projectName]);

  const handleInvite = useCallback(async () => {
    const email = inviteEmail.trim();
    if (!email || !accessToken || !projectName) return;
    setInviteError(null);
    try {
      await inviteToProject(accessToken, projectName, email);
      setInviteEmail("");
      const res = await getProjectMembers(accessToken, projectName);
      setProjectMembers(res.members ?? []);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ message?: string }>;
      const msg =
        axiosError?.response?.data?.message ??
          axiosError?.response?.status === 404
          ? "Пользователь с таким email не найден"
          : "Не удалось пригласить";
      setInviteError(msg);
    }
  }, [accessToken, inviteEmail, projectName]);

  useEffect(() => {
    if (activeView !== "script" && activeView !== "light-plot" && activeView !== "theater") {
      return;
    }
    if (!isSceneReady || steps.length === 0) return;
    if (!hasLocalEditsRef.current) return;
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
  }, [activeView, isSceneReady, saveStepsForLightPlot, steps.length, theaterLayout]);

  const isSettingsRoute = location.pathname === "/settings";
  const shouldShowStepsSidebar = !isSettingsRoute && activeView === "script";

  const handleGetPlayUrl = useCallback(async (key: string): Promise<string | null> => {
    const token = accessToken || localStorage.getItem("accessToken");
    if (!token) return null;
    try {
      const { url } = await getPlayUrl(token, key);
      return url;
    } catch {
      return null;
    }
  }, [accessToken]);

  const playlistNode = !isSettingsRoute ? (
    <div className={`playlist-sidebar-wrapper ${isMobile ? "mobile" : ""} ${isMobilePlaylistOpen ? "open" : ""} ${(!isMobile && !showPlaylistSidebar) || (isMobile && !isMobilePlaylistOpen) ? "hidden" : ""}`}>
      {isMobile && (
        <button
          className="mobile-panel-close"
          onClick={() => setIsMobilePlaylistOpen(false)}
          aria-label="Закрыть плейлист"
        >
          ×
        </button>
      )}
      <PlaylistSidebar
        projectName={projectName || "fools"}
        tracks={sceneData?.playlist || []}
        sceneName="script"
        onRegisterPlayHandler={registerPlaylistPlay}
        onGetPlayUrl={handleGetPlayUrl}
        onPlaylistChange={async (next) => {
          // 1. Обновляем локальное состояние сцены
          setSceneData((prev) =>
            prev ? { ...prev, playlist: next } : { playlist: next },
          );

          // 2. Пытаемся сохранить сцену на сервере, чтобы плейлист не пропадал после перезагрузки
          const tokenToUse = accessToken || localStorage.getItem("accessToken");
          if (!tokenToUse || !projectName) return;

          const projectId = await ensureRemoteProject(tokenToUse);
          if (!projectId) return;

          const sceneId = `${projectId}:script`;
          const nowIso = new Date().toISOString();
          const payload = {
            ...(sceneData || {}),
            playlist: next,
          };

          const change: SyncChange = {
            id: crypto.randomUUID(),
            entityType: "Scene",
            entityId: sceneId,
            operation: "update",
            payload: {
              id: sceneId,
              projectId,
              name: payload.name || `Сцена ${projectName}`,
              rawJson: payload,
              updatedAt: nowIso,
            },
            createdAt: nowIso,
          };

          try {
            await syncPush(tokenToUse, [change]);
            console.log("[playlist] web playlist sync push completed");
          } catch (error) {
            console.error("[playlist] web playlist sync push failed", error);
          }
        }}
      />
    </div>
  ) : null;

  const stepsSidebarNode = ((!isMobile && shouldShowStepsSidebar) || (isMobile && isMobileStepsOpen && shouldShowStepsSidebar)) ? (
    <div className={`steps-sidebar-wrapper ${isMobile ? "mobile" : ""} ${isMobileStepsOpen ? "open" : ""}`}>
      {isMobile && (
        <button
          className="mobile-panel-close"
          onClick={() => setIsMobileStepsOpen(false)}
          aria-label="Закрыть шаги"
        >
          ×
        </button>
      )}
      <StepsSidebar
        steps={steps}
        currentIndex={currentPage}
        onSelect={setCurrentPage}
        onPrev={() => setCurrentPage(Math.max(0, currentPage - 1))}
        onNext={() => setCurrentPage(Math.min(steps.length - 1, currentPage + 1))}
        onDelete={deleteStep}
        onReorder={reorderSteps}
        isEditing={isEditing}
        onToggleEditing={() => setIsEditing((prev) => !prev)}
        onAddStep={addStep}
        showRequisites={showRequisites}
        onToggleRequisites={() => setShowRequisites((prev) => !prev)}
        showPlaylist={showPlaylistSidebar}
        onTogglePlaylist={() => setShowPlaylistSidebar((prev) => !prev)}
        showHeaderSounds={showHeaderSounds}
        onToggleHeaderSounds={() => setShowHeaderSounds((prev) => !prev)}
        isCollapsed={isStepsCollapsed}
        onToggleCollapsed={() => setIsStepsCollapsed((prev) => !prev)}
      />
    </div>
  ) : null;

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    try {
      const email = authEmail.trim();
      const password = authPassword;
      const res = isRegisterMode
        ? await register(email, password)
        : await login(email, password);
      setAccessToken(res.accessToken);
      localStorage.setItem("accessToken", res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);
      setAuthPassword("");
      void syncFromServer(res.accessToken);
    } catch (error: unknown) {
      console.error("Auth failed:", error);
      const axiosError = error as AxiosError<{ message?: string }>;
      setAuthError(axiosError?.response?.data?.message ?? "Ошибка");
    }
  };

  if (!accessToken) {
    return (
      <div className="app-layout login-layout">
        <form className="login-form" onSubmit={handleAuthSubmit}>
          <h1>{isRegisterMode ? "Регистрация" : "Вход"}</h1>
          <p className="login-form-subtitle">
            Войди в аккаунт, чтобы работать с проектами и сценарием онлайн.
          </p>
          <label>
            Email
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
            />
          </label>
          {authError && <div className="login-error">{authError}</div>}
          <button type="submit">
            {isRegisterMode ? "Создать аккаунт" : "Войти"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthError(null);
              setIsRegisterMode((prev) => !prev);
            }}
          >
            {isRegisterMode ? "У меня уже есть аккаунт" : "Создать новый аккаунт"}
          </button>
          <p className="login-form-footer">
            Сервер API: <code>{getApiBaseUrl()}</code>
          </p>
        </form>
      </div>
    );
  }

  const SpectacleLayout = (
    <div className="app-layout">
      {playlistNode}
      <div className="app-content">
        {showHeaderSounds && !isMobile && (
          <div className="sounds-bar">
            <HeaderPlayer
              projectName={projectName || "fools"}
              sceneName="script"
              sounds={sceneData?.sounds || []}
              onSoundsChange={(next) =>
                setSceneData((prev) =>
                  prev ? { ...prev, sounds: next } : { sounds: next },
                )
              }
            />
          </div>
        )}
        <main className="main-content">
          <Suspense fallback={<div className="view-loader">Загрузка сценария…</div>}>
            <ShowScript
              title={sceneData?.name}
              steps={steps}
              currentPage={currentPage}
              onStepsChange={(next) => {
                hasLocalEditsRef.current = true;
                setSteps(next);
              }}
              isEditing={isEditing}
              onTrackLinkClick={handleTrackLinkClick}
              showRequisites={showRequisites}
              projectName={projectName || "fools"}
              sceneName="script"
              canSave={isSceneReady}
              playlist={sceneData?.playlist || []}
              lightChannels={lightChannels}
              onLightChannelsChange={(next) => {
                hasLocalEditsRef.current = true;
                setLightChannels(next);
              }}
            />
          </Suspense>
        </main>
      </div>
      {stepsSidebarNode}
      {isMobile && !isSettingsRoute && (
        <div className="mobile-bottom-buttons">
          {shouldShowStepsSidebar && (
            <button
              className="mobile-bottom-btn"
              onClick={() => setIsMobileStepsOpen(true)}
              aria-label="Открыть шаги"
            >
              Шаги
            </button>
          )}
          {showPlaylistSidebar && (
            <button
              className="mobile-bottom-btn"
              onClick={() => setIsMobilePlaylistOpen(true)}
              aria-label="Открыть плейлист"
            >
              Плейлист
            </button>
          )}
        </div>
      )}
      {isMobile && (isMobilePlaylistOpen || isMobileStepsOpen) && (
        <div
          className="mobile-overlay"
          onClick={() => {
            setIsMobilePlaylistOpen(false);
            setIsMobileStepsOpen(false);
          }}
        />
      )}
    </div>
  );

  const TheaterPlaceholder = (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="view-placeholder">
            <h2>3D театр</h2>
            <p>Страница в разработке</p>
          </div>
        </main>
      </div>
    </div>
  );

  const LightPlotPlaceholder = (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="view-placeholder">
            <h2>Схема проекторов</h2>
            <p>Страница в разработке</p>
          </div>
        </main>
      </div>
    </div>
  );

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={SpectacleLayout} />
        <Route path="/theater" element={TheaterPlaceholder} />
        <Route path="/light-plot" element={LightPlotPlaceholder} />
        <Route
          path="/settings"
          element={
            <div className="app-layout">
              <div className="app-content">
                <main className="main-content settings-main">
                  <div className="settings-view">
                    <section className="settings-project-section">
                      <h2>Проект</h2>
                      <ProjectPanel
                        projects={projects}
                        projectName={projectName}
                        newProjectName={newProjectName}
                        onProjectChange={handleProjectChange}
                        onNewProjectNameChange={setNewProjectName}
                        onCreateProject={handleCreateProject}
                        onDeleteProject={handleDeleteProject}
                      />
                    </section>
                    <h2>Настройки проекта</h2>
                    <p>Текущий проект: {projectName || "—"}</p>
                    <section className="settings-invite">
                      {isProjectOwner === false ? (
                        <p className="settings-invite-forbidden">
                          Только владелец проекта может приглашать участников и просматривать список.
                        </p>
                      ) : (
                        <>
                          <h3>Пригласить в проект</h3>
                          <p className="settings-invite-hint">
                            Другие пользователи смогут подсоединиться к проекту после
                            регистрации. Укажите email зарегистрированного пользователя.
                          </p>
                          <div className="settings-invite-row">
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => {
                                setInviteEmail(e.target.value);
                                setInviteError(null);
                              }}
                              placeholder="email@example.com"
                              className="settings-invite-input"
                            />
                            <button
                              type="button"
                              onClick={handleInvite}
                              disabled={!inviteEmail.trim()}
                            >
                              Пригласить
                            </button>
                          </div>
                          {inviteError && (
                            <div className="settings-invite-error">{inviteError}</div>
                          )}
                          {projectMembers.length > 0 && (
                            <div className="settings-members">
                              <h4>Участники</h4>
                              <ul>
                                {projectMembers.map((m) => (
                                  <li key={m.id}>
                                    {m.user.email} — {m.role}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </section>
                    <button type="button" onClick={handleLogout}>
                      Выйти из аккаунта
                    </button>
                  </div>
                </main>
              </div>
            </div>
          }
        />
      </Routes>
    </>
  );
}

export default AppInner;

