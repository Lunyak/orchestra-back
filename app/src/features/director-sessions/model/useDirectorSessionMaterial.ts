import { useEffect, useMemo, useState } from "react";
import { useAppDispatch } from "../../../shared/store/hooks";
import { projectApi } from "../../project/api/project-api";
import { useLazyProjectMaterialQuery } from "../api/director-sessions-api";
import { projectMaterialToDirectorSessionCache } from "./build-project-data-cache";
import { projectSlugsFromSession } from "./director-session-page-helpers";
import {
  isSlotScenePickerCustomSlug,
  roleMapsFromProjectRoles,
} from "./session-page-utils";
import type { DirectorSessionProjectDataCache } from "./session-page-types";
import type { DirectorRehearsalSession } from "../directorSessionsSync";

export function useDirectorSessionMaterial(args: {
  accessToken: string | null | undefined;
  session: DirectorRehearsalSession | null;
  projectFilter: string;
  rolesSlug: string;
}) {
  const { accessToken, session, projectFilter, rolesSlug } = args;
  const dispatch = useAppDispatch();
  const [fetchProjectMaterial] = useLazyProjectMaterialQuery();

  const [dataCache, setDataCache] = useState<DirectorSessionProjectDataCache>(
    {},
  );
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesError, setScenesError] = useState<string | null>(null);
  const [roleEmailsByProjectSlug, setRoleEmailsByProjectSlug] = useState<
    Record<string, Record<string, string[]>>
  >({});

  const loadProjectData = async (slug: string) => {
    if (!accessToken) return;
    if (!slug || isSlotScenePickerCustomSlug(slug)) return;
    if (dataCache[slug]) return;
    setScenesLoading(true);
    setScenesError(null);
    try {
      const data = await fetchProjectMaterial(slug).unwrap();
      setDataCache((p) => ({
        ...p,
        [slug]: projectMaterialToDirectorSessionCache(data),
      }));
    } catch (e: unknown) {
      const err = e as { message?: string; data?: { message?: string } };
      setScenesError(
        err?.data?.message ?? err?.message ?? "Не удалось загрузить сцены",
      );
      setDataCache((p) => ({
        ...p,
        [slug]: { scenes: [], sceneId: null, sceneRoles: null },
      }));
    } finally {
      setScenesLoading(false);
    }
  };

  const projectSlugsInSession = useMemo(
    () => projectSlugsFromSession(session),
    [session?.id, session?.slots],
  );

  const projectDataLoadedSig = useMemo(
    () =>
      projectSlugsInSession.filter((slug) => dataCache[slug] != null).join("|"),
    [dataCache, projectSlugsInSession],
  );

  useEffect(() => {
    if (!accessToken || projectSlugsInSession.length === 0) return;
    for (const slug of projectSlugsInSession) {
      if (dataCache[slug] != null) continue;
      void loadProjectData(slug);
    }
  }, [accessToken, projectSlugsInSession.join("|"), projectDataLoadedSig]);

  useEffect(() => {
    if (!accessToken || projectSlugsInSession.length === 0) {
      setRoleEmailsByProjectSlug({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        projectSlugsInSession.map(async (slug) => {
          try {
            const rolesRes = await dispatch(
              projectApi.endpoints.projectRoles.initiate(slug),
            ).unwrap();
            return [
              slug,
              roleMapsFromProjectRoles(rolesRes.roles).roleEmailsByKey,
            ] as const;
          } catch {
            return [slug, {}] as const;
          }
        }),
      );
      if (!cancelled) {
        setRoleEmailsByProjectSlug(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, dispatch, projectSlugsInSession.join("|")]);

  useEffect(() => {
    if (!projectFilter || isSlotScenePickerCustomSlug(projectFilter)) return;
    void loadProjectData(projectFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  useEffect(() => {
    if (!rolesSlug || rolesSlug === projectFilter) return;
    if (isSlotScenePickerCustomSlug(rolesSlug)) return;
    void loadProjectData(rolesSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesSlug, projectFilter]);

  return {
    dataCache,
    scenesLoading,
    scenesError,
    roleEmailsByProjectSlug,
    loadProjectData,
  };
}
