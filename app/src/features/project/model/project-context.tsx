import React, { createContext, useCallback, useEffect, useState } from "react";
import { syncPush } from "../../../sync/api/entity-sync";
import { ensureProject, fetchProjects, updateProject } from "../../../sync/api/projects";
import { getDesktopApi as getPlatformDesktopApi } from "../../../shared/platform/desktop-api";
import { createId } from "../../../shared/utils/createId";
import type { ProjectSummary } from "../../../sync/api/types/project";
import { useAuth } from "../../auth/model/auth-context";
import { isDirectorSessionsSlug } from "../../director-sessions/directorSessionsSync";

export interface ProjectContextValue {
  projects: string[];
  projectItems: ProjectSummary[];
  projectName: string;
  currentProject: ProjectSummary | null;
  currentProjectDisplayName: string;
  setProjectName: (name: string) => void;
  loadProjects: (prefer?: string) => Promise<void>;
  /** true после первой попытки загрузки списка проектов (успех/ошибка). */
  isProjectsLoaded: boolean;
  /** true пока идёт загрузка списка проектов. */
  projectsLoading: boolean;
  onProjectChange: (name: string) => void;
  createProject: (name: string) => Promise<void>;
  updateProjectDisplayName: (name: string) => Promise<void>;
  deleteProject: (name: string) => Promise<void>;
  ensureRemoteProject: (token?: string | null) => Promise<string | null>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const PROJECT_DISPLAY_NAME_KEY_PREFIX = "projectDisplayName:";

const CYRILLIC_TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function projectDisplayNameKey(slug: string) {
  return `${PROJECT_DISPLAY_NAME_KEY_PREFIX}${slug}`;
}

function readStoredProjectDisplayName(slug: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(projectDisplayNameKey(slug));
  } catch {
    return null;
  }
}

function storeProjectDisplayName(slug: string, name: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(projectDisplayNameKey(slug), name);
  } catch {
    // ignore
  }
}

function removeStoredProjectDisplayName(slug: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(projectDisplayNameKey(slug));
  } catch {
    // ignore
  }
}

function slugifyProjectName(name: string): string {
  const transliterated = Array.from(name.trim().toLowerCase().normalize("NFKD"))
    .map((char) => {
      if (CYRILLIC_TRANSLIT[char] != null) return CYRILLIC_TRANSLIT[char];
      if (/[a-z0-9]/.test(char)) return char;
      return "-";
    })
    .join("");

  return transliterated
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function makeUniqueProjectSlug(name: string, usedSlugs: string[]): string {
  const used = new Set(usedSlugs.map((slug) => slug.trim()).filter(Boolean));
  const base = slugifyProjectName(name) || `project-${Date.now().toString(36)}`;
  if (!used.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function desktopProjectSummary(slug: string): ProjectSummary {
  return {
    id: slug,
    slug,
    name: readStoredProjectDisplayName(slug) || slug,
    description: null,
  };
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, logout } = useAuth();
  const [projects, setProjects] = useState<string[]>([]);
  const [projectItems, setProjectItems] = useState<ProjectSummary[]>([]);
  const [projectName, setProjectName] = useState("");
  const [isProjectsLoaded, setIsProjectsLoaded] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const ensureRemoteInFlightRef = React.useRef<Record<string, Promise<string | null> | undefined>>({});

  const currentProject = React.useMemo(
    () => projectItems.find((project) => project.slug === projectName) ?? null,
    [projectItems, projectName],
  );
  const currentProjectDisplayName = currentProject?.name || projectName;

  const getDesktopApi = useCallback(() => {
    const api = getPlatformDesktopApi();
    if (!api) return null;
    if (
      typeof api.listProjects !== "function" ||
      typeof api.createProject !== "function" ||
      typeof api.deleteProject !== "function"
    ) {
      return null;
    }
    return api as {
      listProjects: () => Promise<string[]>;
      createProject: (
        name: string
      ) => Promise<{ ok: boolean; name?: string; error?: string }>;
      deleteProject: (name: string) => Promise<{ ok: boolean; error?: string }>;
    };
  }, []);

  const loadProjects = useCallback(async (prefer?: string) => {
    setProjectsLoading(true);
    try {
      const desktopApi = getDesktopApi();
      let listRaw: ProjectSummary[] = desktopApi
        ? (await desktopApi.listProjects()).map(desktopProjectSummary)
        : accessToken
          ? await fetchProjects(accessToken)
          : [];
      if (listRaw.length === 0 && import.meta.env.DEV) {
        try {
          const res = await fetch("/local-project-dev/projects");
          if (res.ok) {
            const data = (await res.json()) as { projects?: string[] };
            listRaw = (Array.isArray(data.projects) ? data.projects : []).map((slug) =>
              desktopProjectSummary(slug),
            );
          }
        } catch {
          /* dev local list unavailable */
        }
      }
      const items = listRaw.filter((project) => !isDirectorSessionsSlug(project.slug));
      const list = items.map((project) => project.slug);
      setProjectItems(items);
      setProjects(list);
      const stored = localStorage.getItem("selectedProject") || "";
      // Не затирать выбранный проект при каждом loadProjects (смена токена, повторный mount):
      // иначе при несовпадении stored со списком на мгновение или при сортировке list[0] — «прыжок»
      // на другой slug (часто первый по алфавиту).
      setProjectName((prev) => {
        if (prefer && list.includes(prefer)) return prefer;
        if (prev && list.includes(prev)) return prev;
        if (stored && list.includes(stored)) return stored;
        return list[0] || "";
      });
    } catch (error: any) {
      console.error("[projects] failed to load:", error);
      
      // При 401 — токен невалидный, нужен повторный логин
      if (error?.response?.status === 401) {
        console.warn("[projects] Unauthorized (401) — logging out");
        logout();
      }
      
      setProjects([]);
      setProjectItems([]);
    } finally {
      setProjectsLoading(false);
      setIsProjectsLoaded(true);
    }
  }, [accessToken, getDesktopApi, logout]);

  const ensureRemoteProject = useCallback(
    async (token?: string | null) => {
      const tokenToUse = token ?? accessToken;
      if (!tokenToUse || !projectName) return null;
      const key = `projectId:${projectName}`;
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const inFlightKey = `${tokenToUse}:${projectName}`;
      const inFlight = ensureRemoteInFlightRef.current[inFlightKey];
      if (inFlight) return await inFlight;
      try {
        const p = ensureProject(
          tokenToUse,
          projectName,
          currentProjectDisplayName || `Проект ${projectName}`,
        )
          .then((project) => {
            localStorage.setItem(key, project.id);
            return project.id;
          })
          .catch((error) => {
            console.error("[sync] ensureProject failed:", error);
            return null;
          })
          .finally(() => {
            delete ensureRemoteInFlightRef.current[inFlightKey];
          });
        ensureRemoteInFlightRef.current[inFlightKey] = p;
        return await p;
      } catch (error) {
        console.error("[sync] ensureProject failed:", error);
        return null;
      }
    },
    [accessToken, currentProjectDisplayName, projectName]
  );

  const onProjectChange = useCallback(
    (name: string) => {
      setProjectName(name);
      // Scene will react to projectName change and clear/load its state
    },
    []
  );

  const createProject = useCallback(
    async (name: string) => {
      const value = name.trim();
      if (!value) return;
      const slug = makeUniqueProjectSlug(value, projects);
      const desktopApi = getDesktopApi();
      if (desktopApi) {
        const result = await desktopApi.createProject(slug);
        if (!result?.ok || !result.name) {
          console.error("createProject failed:", result?.error);
          return;
        }
        storeProjectDisplayName(result.name, value);
        await loadProjects(result.name);
        return;
      }
      if (!accessToken) return;
      try {
        const project = await ensureProject(accessToken, slug, value);
        await loadProjects(project.slug);
      } catch (error) {
        console.error("createProject failed:", error);
      }
    },
    [accessToken, getDesktopApi, loadProjects, projects]
  );

  const updateProjectDisplayName = useCallback(
    async (name: string) => {
      const value = name.trim();
      if (!projectName || !value) return;

      storeProjectDisplayName(projectName, value);
      setProjectItems((prev) =>
        prev.map((project) =>
          project.slug === projectName ? { ...project, name: value } : project,
        ),
      );

      if (!accessToken || getDesktopApi()) return;
      try {
        const updated = await updateProject(accessToken, projectName, { name: value });
        setProjectItems((prev) =>
          prev.map((project) =>
            project.slug === updated.slug ? { ...project, ...updated } : project,
          ),
        );
      } catch (error: any) {
        if (error?.response?.status === 404) {
          const ensured = await ensureProject(accessToken, projectName, value);
          setProjectItems((prev) => {
            const exists = prev.some((project) => project.slug === ensured.slug);
            if (!exists) return [...prev, ensured];
            return prev.map((project) =>
              project.slug === ensured.slug
                ? { ...project, ...ensured, name: value }
                : project,
            );
          });
          storeProjectDisplayName(projectName, value);
          return;
        }
        await loadProjects(projectName);
        throw error;
      }
    },
    [accessToken, getDesktopApi, loadProjects, projectName],
  );

  const deleteProject = useCallback(
    async (name: string) => {
      if (!name) return;
      const desktopApi = getDesktopApi();
      if (!desktopApi) {
        console.warn("deleteProject is available only in desktop mode");
        return;
      }
      const projectMeta = projectItems.find((project) => project.slug === name);
      const confirmLabel = projectMeta?.name ?? name;
      const typed = window.prompt(
        `Чтобы удалить проект, введите его название:\n${confirmLabel}`,
      );
      if (!typed?.trim()) return;

      const projectId = accessToken
        ? localStorage.getItem(`projectId:${name}`)
        : null;
      const result = await desktopApi.deleteProject(name);
      if (!result?.ok) {
        console.error("deleteProject failed:", result?.error);
        return;
      }
      if (accessToken && projectId) {
        try {
          const nowIso = new Date().toISOString();
          await syncPush(
            accessToken,
            [
              {
                id: createId(),
                entityType: "Project",
                entityId: projectId,
                operation: "delete",
                payload: { id: projectId, updatedAt: nowIso },
                createdAt: nowIso,
              },
            ],
            { destructiveConfirm: typed.trim() },
          );
        } catch (err) {
          console.error("deleteProject sync failed:", err);
        }
        localStorage.removeItem(`projectId:${name}`);
      }
      removeStoredProjectDisplayName(name);
      await loadProjects();
    },
    [accessToken, getDesktopApi, loadProjects, projectItems]
  );

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (cancelled) return;
      await loadProjects();
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [loadProjects]);

  useEffect(() => {
    if (projectName) {
      localStorage.setItem("selectedProject", projectName);
    }
  }, [projectName]);

  const value: ProjectContextValue = {
    projects,
    projectItems,
    projectName,
    currentProject,
    currentProjectDisplayName,
    setProjectName,
    loadProjects,
    isProjectsLoaded,
    projectsLoading,
    onProjectChange,
    createProject,
    updateProjectDisplayName,
    deleteProject,
    ensureRemoteProject,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = React.useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
