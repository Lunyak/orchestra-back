import { useEffect, useMemo, useState } from "react";
import { useProject } from "../../project";
import { fetchTheaterRehearsals } from "../../../sync/api/workspaces";
import {
  isSlotScenePickerCustomSlug,
  SLOT_SCENE_PICKER_CUSTOM_SLUG,
} from "./session-page-utils";

type TheaterProjectOption = { slug: string; name: string };

export function useDirectorSessionProjects(args: {
  accessToken: string | null | undefined;
  sid: string;
  slId: string;
  theaterId: string;
  isTheaterContext: boolean;
  slotProjectSlug: string;
}) {
  const { accessToken, sid, slId, theaterId, isTheaterContext, slotProjectSlug } =
    args;
  const { projects, projectItems } = useProject();

  const [theaterProjects, setTheaterProjects] = useState<
    TheaterProjectOption[] | null
  >(null);

  useEffect(() => {
    if (!isTheaterContext || !accessToken || !theaterId) {
      setTheaterProjects(null);
      return;
    }
    let cancelled = false;
    void fetchTheaterRehearsals(accessToken, theaterId)
      .then((response) => {
        if (cancelled) return;
        setTheaterProjects(
          response.projects.map((project) => ({
            slug: project.slug,
            name: project.name || project.slug,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setTheaterProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, isTheaterContext, theaterId]);

  const visibleProjects = useMemo(() => {
    if (isTheaterContext) {
      if (!theaterProjects) return [];
      return theaterProjects
        .map((project) => project.slug)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru"));
    }
    return (Array.isArray(projects) ? projects : [])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "ru"));
  }, [isTheaterContext, projects, theaterProjects]);

  const projectLabelBySlug = useMemo(() => {
    const labels = new Map(
      projectItems.map((project) => [
        project.slug,
        project.name || project.slug,
      ]),
    );
    for (const project of theaterProjects ?? []) {
      labels.set(project.slug, project.name || project.slug);
    }
    return labels;
  }, [projectItems, theaterProjects]);

  const projectFilterStorageKey = useMemo(
    () => `directorSessions:session:${sid}:${slId || "all"}:project`,
    [sid, slId],
  );

  const [projectFilter, setProjectFilter] = useState<string>(() => {
    try {
      return (
        (typeof window !== "undefined"
          ? localStorage.getItem(projectFilterStorageKey)
          : null) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("selectedProject")
          : null) ||
        ""
      );
    } catch (_) {
      return "";
    }
  });

  const rolesSlug = useMemo(() => {
    const fromSlot = slotProjectSlug.trim();
    if (fromSlot) return fromSlot;
    if (isSlotScenePickerCustomSlug(projectFilter)) return "";
    return projectFilter;
  }, [slotProjectSlug, projectFilter]);

  useEffect(() => {
    if (!visibleProjects.length) return;
    setProjectFilter((prev) => {
      if (isSlotScenePickerCustomSlug(prev)) return prev;
      const chosen = prev && visibleProjects.includes(prev) ? prev : "";
      return chosen || visibleProjects[0] || "";
    });
  }, [visibleProjects]);

  useEffect(() => {
    try {
      if (projectFilter && !isSlotScenePickerCustomSlug(projectFilter))
        localStorage.setItem(projectFilterStorageKey, projectFilter);
    } catch (_) {}
  }, [projectFilter, projectFilterStorageKey]);

  const scenePickerProjects = useMemo(
    () =>
      visibleProjects.map((slug) => ({
        slug,
        label: projectLabelBySlug.get(slug) ?? slug,
      })),
    [visibleProjects, projectLabelBySlug],
  );

  return {
    visibleProjects,
    projectLabelBySlug,
    projectFilter,
    setProjectFilter,
    rolesSlug,
    scenePickerProjects,
    SLOT_SCENE_PICKER_CUSTOM_SLUG,
  };
}
