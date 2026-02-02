import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import { Header } from "./components/header/Header";
import { type HeaderSound } from "./components/header/HeaderPlayer";
import { PlaylistSidebar, type PlaylistTrack } from "./components/playlist-sidebar/PlaylistSidebar";
import { ProjectPanel } from "./components/project-panel/ProjectPanel";
import {
  ScriptStepsSidebar,
  type ScriptStepsSidebarProps,
} from "./components/script-steps-sidebar/ScriptStepsSidebar";
import { ensureProject, syncPull, syncPush, type SyncChange } from "./sync/api";
import { login, register } from "./sync/auth";
import { ScriptStep, TheaterLayout } from "./types/script";
const LightPlotPage = lazy(() =>
  import("./components/light-plot/LightPlotPage").then((module) => ({
    default: module.LightPlotPage,
  }))
);
const ShowScript = lazy(() =>
  import("./components/show-script/ShowScript").then((module) => ({
    default: module.ShowScript,
  }))
);
const TheaterScene = lazy(() =>
  import("./components/theater/TheaterScene").then((module) => ({
    default: module.TheaterScene,
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
  const [swapTheaterPanels, setSwapTheaterPanels] = useState(true);
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
  const [activeView, setActiveView] = useState<"script" | "theater" | "light-plot">(
    () => {
      const raw = localStorage.getItem("activeView");
      if (raw === "script" || raw === "theater" || raw === "light-plot") {
        return raw;
      }
      return "script";
    },
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [showRequisites, setShowRequisites] = useState(true);
  const [showPlaylistSidebar, setShowPlaylistSidebar] = useState(true);
  const [showHeaderSounds, setShowHeaderSounds] = useState(true);
  const [isStepsCollapsed, setIsStepsCollapsed] = useState(false);
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
  const navigate = useNavigate();
  const playlistPlayRef = useRef<(trackId: number) => void>();
  const selectedStepIdRef = useRef<number | null>(null);
  const restoredStepRef = useRef(false);
  const lightPlotSaveTimerRef = useRef<number | null>(null);
  const [theaterControlsHost, setTheaterControlsHost] =
    useState<HTMLDivElement | null>(null);
  const setTheaterControlsHostRef = useCallback(
    (node: HTMLDivElement | null) => {
      setTheaterControlsHost(node);
    },
    []
  );

  const addStep = () => {
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

  const loadProjects = useCallback(async (prefer?: string) => {
    try {
      const list = await window.api.listProjects();
      setProjects(list);
      const stored = localStorage.getItem("selectedProject") || "";
      const initial = prefer && list.includes(prefer)
        ? prefer
        : list.includes(stored)
          ? stored
          : list[0] || "";
      if (initial) {
        setProjectName(initial);
      }
    } catch (error) {
      console.error("[projects] failed to load:", error);
      setProjects([]);
    }
  }, []);

  const ensureRemoteProject = useCallback(async (token?: string | null) => {
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
  }, [accessToken, projectName]);

  const syncFromServer = useCallback(async (token?: string | null) => {
    const tokenToUse = token ?? accessToken;
    if (!tokenToUse || !projectName) return;
    try {
      const projectId = await ensureRemoteProject(tokenToUse);
      if (!projectId) return;

      const perProjectKey = `lastSyncAt:${projectName}`;
      const effectiveLastSyncAt =
        localStorage.getItem(perProjectKey) ?? lastSyncAt;

      const { now, projects, scenes } = await syncPull(
        tokenToUse,
        effectiveLastSyncAt,
      );

      const project = projects.find((p) => p.slug === projectName);
      if (!project) return;

      const scene = scenes.find((s: any) => s.projectId === project.id);
      if (!scene) return;

      const raw = (scene.rawJson as any) ?? {};
      setSceneData(raw || null);
      setTheaterLayout(raw.theaterLayout || DEFAULT_THEATER_LAYOUT);
      setSteps(raw.steps || []);

      setLastSyncAt(now);
      localStorage.setItem("lastSyncAt", now);
      localStorage.setItem(perProjectKey, now);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        // токен больше невалиден — выходим и просим залогиниться снова
        setAccessToken(null);
        localStorage.removeItem("accessToken");
        return;
      }
      console.error("[sync] pull failed:", error);
    }
  }, [accessToken, ensureRemoteProject, lastSyncAt, projectName, setAccessToken]);

  useEffect(() => {
    let isCancelled = false;
    const init = async () => {
      if (isCancelled) return;
      await loadProjects();
    };
    void init();
    return () => {
      isCancelled = true;
    };
  }, [loadProjects]);

  // Автосинхрон при смене проекта и наличии токена
  useEffect(() => {
    if (!accessToken || !projectName) return;
    void syncFromServer();
  }, [accessToken, projectName, syncFromServer]);

  useEffect(() => {
    if (!projectName) return;
    localStorage.setItem("selectedProject", projectName);
  }, [projectName]);

  useEffect(() => {
    localStorage.setItem("activeView", activeView);
  }, [activeView]);

  useEffect(() => {
    if (!projectName) return;
    let isCancelled = false;
    setIsSceneReady(false);
    const loadScene = async () => {
      try {
        const scene = await window.api.readProjectScene(projectName, "script");
        if (isCancelled) return;
        setSceneData(scene || null);
        setTheaterLayout(scene?.theaterLayout || DEFAULT_THEATER_LAYOUT);
        setSteps(scene?.steps || []);
        setCurrentPage(0);
        selectedStepIdRef.current = null;
        restoredStepRef.current = false;
        setIsSceneReady(true);
      } catch (error) {
        if (!isCancelled) {
          setSceneData(null);
          setTheaterLayout(DEFAULT_THEATER_LAYOUT);
          setSteps([]);
          setCurrentPage(0);
          selectedStepIdRef.current = null;
          restoredStepRef.current = false;
          setIsSceneReady(false);
        }
      }
    };
    void loadScene();
    return () => {
      isCancelled = true;
    };
  }, [projectName]);

  const StepsSidebar = ScriptStepsSidebar as ComponentType<
    ScriptStepsSidebarProps & {
      showRequisites: boolean;
      onToggleRequisites: () => void;
    }
  >;
  const LightPlotView = LightPlotPage as ComponentType<{
    steps: ScriptStep[];
    currentPage: number;
    onStepsChange: React.Dispatch<React.SetStateAction<ScriptStep[]>>;
  }>;

  const registerPlaylistPlay = useCallback((handler: (trackId: number) => void) => {
    playlistPlayRef.current = handler;
  }, []);

  const handleTrackLinkClick = useCallback((trackId: number) => {
    playlistPlayRef.current?.(trackId);
  }, []);

  const handleCreateProject = async () => {
    const value = newProjectName.trim();
    if (!value) return;
    const result = await window.api.createProject(value);
    if (!result?.ok || !result.name) {
      console.error("createProject failed:", result?.error);
      return;
    }
    setNewProjectName("");
    await loadProjects(result.name);
  };

  const handleDeleteProject = async () => {
    if (!projectName) return;
    const confirmed = window.confirm(
      `Удалить проект "${projectName}"? Это удалит все файлы проекта.`,
    );
    if (!confirmed) return;
    const result = await window.api.deleteProject(projectName);
    if (!result?.ok) {
      console.error("deleteProject failed:", result?.error);
      return;
    }
    await loadProjects();
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

      // Всегда предотвращаем Reload (Cmd+R в Electron перезагружает окно и теряются несохранённые данные)
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
      const current = await window.api.readProjectScene(projectName, "script");
      const payload = { ...current, steps, theaterLayout };
      const result = await window.api.saveProjectScene(projectName, "script", payload);
      if (!result?.ok) {
        console.error("Failed to save light plot steps:", result?.error);
      }

      // Отправляем изменения сцены и шагов на сервер, если пользователь авторизован
      const token = accessToken || localStorage.getItem("accessToken");
      console.log("[sync] saveStepsForLightPlot: checking sync conditions", {
        hasToken: !!token,
        projectName,
        stepsCount: steps.length,
      });

      if (token) {
        const projectId =
          localStorage.getItem(`projectId:${projectName}`) ??
          (await ensureRemoteProject(token));
        console.log("[sync] saveStepsForLightPlot: projectId", { projectId });

        if (projectId) {
          // Генерируем стабильный sceneId для сцены "script" (можно расширить для других типов сцен)
          // Используем формат projectId:sceneType для уникальности и предсказуемости
          const sceneId = `${projectId}:script`;
          const nowIso = new Date().toISOString();

          const changes: SyncChange[] = [];

          // 1) Сцена целиком (для совместимости и хранения rawJson)
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

          // 2) Индивидуальные шаги (create/update)
          const existingSteps: ScriptStep[] = (current?.steps as ScriptStep[]) ?? [];
          const existingIds = new Set(existingSteps.map((s) => s.id));
          const newIds = new Set(steps.map((s) => s.id));

          // create/update
          steps.forEach((step, index) => {
            const stepKey = `${sceneId}:${step.id}`;
            changes.push({
              id: crypto.randomUUID(),
              entityType: "Step",
              entityId: stepKey,
              operation: existingIds.has(step.id) ? "update" : "create",
              payload: {
                id: stepKey,
                sceneId: sceneId, // Используем тот же sceneId, что и для Scene
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

          // 3) Удалённые шаги (delete)
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

          console.log("[sync] prepared changes for push", {
            changesCount: changes.length,
            changes: changes.map((c) => ({
              entityType: c.entityType,
              operation: c.operation,
              entityId: c.entityId,
            })),
          });

          if (changes.length > 0) {
            try {
              await syncPush(token, changes);
              console.log("[sync] push completed successfully");
            } catch (error) {
              console.error("[sync] push failed:", error);
            }
          } else {
            console.warn("[sync] no changes to push, skipping");
          }
        }
      }
    } catch (error) {
      console.error("Failed to save light plot steps:", error);
    }
  }, [accessToken, ensureRemoteProject, projectName, steps, theaterLayout]);

  const handleLogout = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem("accessToken");
    // Опционально можно очищать lastSyncAt и кэшированные projectId, если захочешь
  }, []);

  useEffect(() => {
    // Автосохранение и пуш шагов работает теперь и в видах "script", "light-plot" и "theater"
    if (
      activeView !== "script" &&
      activeView !== "light-plot" &&
      activeView !== "theater"
    ) {
      return;
    }
    if (!isSceneReady || steps.length === 0) return;
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
  const shouldShowStepsSidebar =
    !isSettingsRoute &&
    (activeView === "script" ||
      activeView === "light-plot" ||
      activeView === "theater");
  const isTheaterView = activeView === "theater";
  const shouldSwapPanels = isTheaterView && swapTheaterPanels;
  const playlistNode = showPlaylistSidebar && !isSettingsRoute ? (
    <PlaylistSidebar
      projectName={projectName || "fools"}
      tracks={sceneData?.playlist || []}
      sceneName="script"
      onRegisterPlayHandler={registerPlaylistPlay}
    />
  ) : null;
  const theaterControlsNode = isTheaterView ? (
    <aside
      ref={setTheaterControlsHostRef}
      className="theater-settings-sidebar"
    />
  ) : null;
  const stepsSidebarNode = shouldShowStepsSidebar ? (
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
      setAuthPassword("");
      // После логина можно сразу подтянуть данные, передаем токен напрямую
      void syncFromServer(res.accessToken);
    } catch (error: any) {
      console.error("Auth failed:", error);
      setAuthError(error?.response?.data?.message ?? "Ошибка");
    }
  };

  if (!accessToken) {
    return (
      <div className="app-layout login-layout">
        <form className="login-form" onSubmit={handleAuthSubmit}>
          <h1>{isRegisterMode ? "Регистрация" : "Вход"}</h1>
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
        </form>
      </div>
    );
  }

  const handleViewChange = (view: "script" | "theater" | "light-plot" | "settings") => {
    if (view === "settings") {
      navigate("/settings");
      return;
    }
    if (location.pathname !== "/") {
      navigate("/");
    }
    setActiveView(view);
  };

  const SpectacleLayout = (
    <div className="app-layout">
      {isTheaterView ? (
        <>
          {showPlaylistSidebar && (
            <div style={{ display: shouldSwapPanels ? "none" : "block" }}>
              {playlistNode}
            </div>
          )}
          {shouldSwapPanels ? theaterControlsNode : null}
        </>
      ) : (
        playlistNode
      )}
      <div className="app-content">
        <div className="project-panel-container">
          <div className="project-panel-content">
            <ProjectPanel
              projects={projects}
              projectName={projectName}
              newProjectName={newProjectName}
              view={activeView}
              onProjectChange={setProjectName}
              onNewProjectNameChange={setNewProjectName}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onViewChange={handleViewChange}
            />
          </div>
        </div>
        <Header
          projectName={projectName || "fools"}
          sceneName="script"
          sounds={sceneData?.sounds || []}
          showSounds={showHeaderSounds}
        />
        <main
          className={`main-content${activeView === "theater" ? " main-content-theater" : ""}`}
        >
          {activeView === "theater" && (
            <Suspense fallback={<div className="view-loader">Загрузка 3D театра…</div>}>
              <TheaterScene
                projectName={projectName || "fools"}
                steps={steps}
                currentPage={currentPage}
                onStepsChange={setSteps}
                theaterLayout={theaterLayout}
                onTheaterLayoutChange={setTheaterLayout}
                isPanelsSwapped={shouldSwapPanels}
                onTogglePanels={() => setSwapTheaterPanels((prev) => !prev)}
                controlsHost={shouldSwapPanels ? theaterControlsHost : null}
                controlsInPanel={shouldSwapPanels}
              />
            </Suspense>
          )}
          {activeView === "light-plot" && (
            <Suspense fallback={<div className="view-loader">Загрузка схемы…</div>}>
              <LightPlotView
                steps={steps}
                currentPage={currentPage}
                onStepsChange={setSteps}
              />
            </Suspense>
          )}
          {activeView === "script" && (
            <Suspense fallback={<div className="view-loader">Загрузка сценария…</div>}>
              <ShowScript
                title={sceneData?.name}
                steps={steps}
                currentPage={currentPage}
                onStepsChange={setSteps}
                isEditing={isEditing}
                onTrackLinkClick={handleTrackLinkClick}
                showRequisites={showRequisites}
                projectName={projectName || "fools"}
                sceneName="script"
                canSave={isSceneReady}
              />
            </Suspense>
          )}
        </main>
      </div>
      {stepsSidebarNode}
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={SpectacleLayout} />
      <Route
        path="/settings"
        element={
          <div className="app-layout">
            <div className="app-content">
              <div className="project-panel-container">
                <div className="project-panel-content">
                  <ProjectPanel
                    projects={projects}
                    projectName={projectName}
                    newProjectName={newProjectName}
                    view={"script"}
                    onProjectChange={setProjectName}
                    onNewProjectNameChange={setNewProjectName}
                    onCreateProject={handleCreateProject}
                    onDeleteProject={handleDeleteProject}
                    onViewChange={handleViewChange}
                  />
                </div>
              </div>
              <main className="main-content">
                <div className="settings-view">
                  <h2>Настройки проекта</h2>
                  <p>Текущий проект: {projectName || "—"}</p>
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
  );
}

export default AppInner;
