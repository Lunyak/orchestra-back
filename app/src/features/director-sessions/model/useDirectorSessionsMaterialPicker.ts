import { useEffect, useMemo, useState } from "react";
import { useLazyProjectMaterialQuery } from "../api/director-sessions-api";
import {
  computePlannedEmailsForSession,
  normalizeEmail,
  type DirectorRehearsalSession,
  type ProjectDataCache,
} from "..";

const PROJECT_FILTER_STORAGE_KEY = "directorSessions:materialsProject";

function readInitialProjectFilter(): string {
  try {
    return (
      (typeof window !== "undefined"
        ? localStorage.getItem(PROJECT_FILTER_STORAGE_KEY)
        : null) ||
      (typeof window !== "undefined"
        ? localStorage.getItem("selectedProject")
        : null) ||
      ""
    );
  } catch {
    return "";
  }
}

function plannedEmailsFingerprint(emails: string[] | undefined): string {
  return [...(emails ?? []).map((e) => normalizeEmail(String(e))).filter(Boolean)]
    .sort()
    .join("|");
}

export type UseDirectorSessionsMaterialPickerArgs = {
  accessToken: string | null;
  projects: string[];
  projectItems: Array<{ slug: string; name?: string | null }>;
  sessions: DirectorRehearsalSession[];
  activeSession: DirectorRehearsalSession | null | undefined;
  sessionsForSelectedDay: DirectorRehearsalSession[];
  persist: (next: DirectorRehearsalSession[]) => Promise<void>;
};

export function useDirectorSessionsMaterialPicker({
  accessToken,
  projects,
  projectItems,
  sessions,
  activeSession,
  sessionsForSelectedDay,
  persist,
}: UseDirectorSessionsMaterialPickerArgs) {
  const [fetchProjectMaterial] = useLazyProjectMaterialQuery();
  const [projectFilter, setProjectFilter] = useState(readInitialProjectFilter);
  const [dataCache, setDataCache] = useState<ProjectDataCache>({});
  const [scenesLoading, setScenesLoading] = useState(false);

  const visibleProjects = useMemo(
    () =>
      (Array.isArray(projects) ? projects : [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [projects],
  );

  const projectLabelBySlug = useMemo(
    () =>
      new Map(
        projectItems.map((project) => [
          project.slug,
          project.name || project.slug,
        ]),
      ),
    [projectItems],
  );

  const loadProjectData = async (slug: string) => {
    if (!accessToken) return;
    if (!slug || dataCache[slug]) return;
    setScenesLoading(true);
    try {
      const data = await fetchProjectMaterial(slug).unwrap();
      setDataCache((prev) => ({ ...prev, [slug]: data }));
    } catch (error) {
      console.error("loadProjectData failed:", slug, error);
      setDataCache((prev) => ({
        ...prev,
        [slug]: {
          scenes: [],
          roleEmailsByKey: {},
          roleTitleByKey: {},
          sceneRoles: null,
        },
      }));
    } finally {
      setScenesLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    if ((sessions ?? []).length === 0) return;
    if (scenesLoading) return;

    let cancelled = false;

    void (async () => {
      const list = sessions ?? [];
      const rawBySessionId = new Map<string, string[]>();

      for (const session of list) {
        const slugs = Array.from(
          new Set(
            (session.slots ?? [])
              .map((slot) => String((slot as { ref?: { projectSlug?: string } })?.ref?.projectSlug ?? "").trim())
              .filter(Boolean),
          ),
        );
        const cacheReady =
          slugs.length === 0 ||
          slugs.every((slug) => Object.prototype.hasOwnProperty.call(dataCache, slug));
        if (!cacheReady) continue;

        const computed = computePlannedEmailsForSession(session, dataCache);
        rawBySessionId.set(session.id, computed.emails);
      }

      if (cancelled) return;

      let changed = false;
      const nextSessions = list.map((session) => {
        if (!rawBySessionId.has(session.id)) return session;
        const raw = rawBySessionId.get(session.id) ?? [];
        if (plannedEmailsFingerprint(session.plannedEmails) === plannedEmailsFingerprint(raw)) {
          return session;
        }
        changed = true;
        return { ...session, plannedEmails: raw };
      });
      if (!changed) return;
      void persist(nextSessions);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist меняется каждый рендер
  }, [accessToken, dataCache, sessions, scenesLoading]);

  useEffect(() => {
    const first =
      (projectFilter && visibleProjects.includes(projectFilter) ? projectFilter : "") ||
      visibleProjects[0] ||
      "";
    if (first && first !== projectFilter) setProjectFilter(first);
  }, [projectFilter, visibleProjects]);

  useEffect(() => {
    if (!projectFilter) return;
    try {
      localStorage.setItem(PROJECT_FILTER_STORAGE_KEY, projectFilter);
    } catch {
      // ignore
    }
  }, [projectFilter]);

  useEffect(() => {
    if (!projectFilter) return;
    void loadProjectData(projectFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  useEffect(() => {
    if (!activeSession) return;
    const slugs = Array.from(
      new Set(
        (activeSession.slots ?? [])
          .map((slot) => slot.ref?.projectSlug)
          .filter(Boolean) as string[],
      ),
    );
    slugs.forEach((slug) => {
      if (!dataCache[slug]) void loadProjectData(slug);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id, activeSession?.slots?.length]);

  useEffect(() => {
    const slugs = new Set<string>();
    for (const session of sessionsForSelectedDay) {
      for (const slot of session.slots ?? []) {
        const slug = slot.ref?.projectSlug;
        if (slug) slugs.add(slug);
      }
    }
    slugs.forEach((slug) => {
      if (!dataCache[slug]) void loadProjectData(slug);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsForSelectedDay]);

  return {
    projectFilter,
    setProjectFilter,
    dataCache,
    scenesLoading,
    visibleProjects,
    projectLabelBySlug,
  };
}
