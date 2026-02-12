import React, { createContext, useCallback, useEffect, useState } from "react";
import { ensureProject, fetchProjects, syncPush } from "../../../sync/api";
import { getDesktopApi as getPlatformDesktopApi } from "../../../shared/platform/desktop-api";
import { useAuth } from "../../auth/model/auth-context";

export interface ProjectContextValue {
  projects: string[];
  projectName: string;
  setProjectName: (name: string) => void;
  loadProjects: (prefer?: string) => Promise<void>;
  onProjectChange: (name: string) => void;
  createProject: (name: string) => Promise<void>;
  deleteProject: (name: string) => Promise<void>;
  ensureRemoteProject: (token?: string | null) => Promise<string | null>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, logout } = useAuth();
  const [projects, setProjects] = useState<string[]>([]);
  const [projectName, setProjectName] = useState("");

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
    try {
      const desktopApi = getDesktopApi();
      const list = desktopApi
        ? await desktopApi.listProjects()
        : accessToken
          ? (await fetchProjects(accessToken)).map((project) => project.slug)
          : [];
      setProjects(list);
      const stored = localStorage.getItem("selectedProject") || "";
      const initial =
        prefer && list.includes(prefer)
          ? prefer
          : list.includes(stored)
            ? stored
            : list[0] || "";
      if (initial) {
        setProjectName(initial);
      }
    } catch (error: any) {
      console.error("[projects] failed to load:", error);
      
      // При 401 — токен невалидный, нужен повторный логин
      if (error?.response?.status === 401) {
        console.warn("[projects] Unauthorized (401) — logging out");
        logout();
      }
      
      setProjects([]);
    }
  }, [accessToken, getDesktopApi, logout]);

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
          `Проект ${projectName}`
        );
        localStorage.setItem(key, project.id);
        return project.id;
      } catch (error) {
        console.error("[sync] ensureProject failed:", error);
        return null;
      }
    },
    [accessToken, projectName]
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
      const desktopApi = getDesktopApi();
      if (desktopApi) {
        const result = await desktopApi.createProject(value);
        if (!result?.ok || !result.name) {
          console.error("createProject failed:", result?.error);
          return;
        }
        await loadProjects(result.name);
        return;
      }
      if (!accessToken) return;
      try {
        await ensureProject(accessToken, value, `Проект ${value}`);
        await loadProjects(value);
      } catch (error) {
        console.error("createProject failed:", error);
      }
    },
    [accessToken, ensureProject, getDesktopApi, loadProjects]
  );

  const deleteProject = useCallback(
    async (name: string) => {
      if (!name) return;
      const desktopApi = getDesktopApi();
      if (!desktopApi) {
        console.warn("deleteProject is available only in desktop mode");
        return;
      }
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
          await syncPush(accessToken, [
            {
              id: crypto.randomUUID(),
              entityType: "Project",
              entityId: projectId,
              operation: "delete",
              payload: { id: projectId, updatedAt: nowIso },
              createdAt: nowIso,
            },
          ]);
        } catch (err) {
          console.error("deleteProject sync failed:", err);
        }
        localStorage.removeItem(`projectId:${name}`);
      }
      await loadProjects();
    },
    [accessToken, getDesktopApi, loadProjects]
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
    projectName,
    setProjectName,
    loadProjects,
    onProjectChange,
    createProject,
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
