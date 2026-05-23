import type { SceneRolesDataV1 } from "../../scene";
import type { SyncPullResponse } from "../../../sync/api/types/sync";
import { normalizeEmail, normalizeRoleKey } from "./session-page-utils";
import type {
  DirectorSessionProjectDataCache,
  ProjectDataCache,
} from "./session-page-types";

export function buildProjectDataCacheFromPull(
  pull: SyncPullResponse,
  slug: string,
  roles: Array<{ key?: string; title?: string; emails?: string[] }> | null | undefined,
): ProjectDataCache[string] {
  const roleEmailsByKey: Record<string, string[]> = {};
  const roleTitleByKey: Record<string, string> = {};
  (roles ?? []).forEach((r) => {
    const key = normalizeRoleKey(String(r?.key ?? r?.title ?? ""));
    if (!key) return;
    const emails = Array.isArray(r?.emails)
      ? r.emails.map((e) => normalizeEmail(String(e))).filter(Boolean)
      : [];
    roleEmailsByKey[key] = Array.from(new Set(emails));
    roleTitleByKey[key] = String(r?.title ?? r?.key ?? key).trim() || key;
  });

  const proj = (pull.projects ?? []).find((p) => p.slug === slug);
  const scene = proj
    ? (pull.scenes ?? []).find((s) => String(s?.id ?? "") === `${proj.id}:script`)
    : null;
  const sceneId = String(scene?.id ?? "");
  const steps = (Array.isArray(pull.steps) ? pull.steps : [])
    .filter((st) => String(st?.sceneId ?? "") === sceneId)
    .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
    .map((st) => ({
      id: Number(st?.sourceId ?? 0),
      title: String(st?.title ?? ""),
      markdown: String(st?.markdown ?? ""),
      playMarkdown: st?.playMarkdown ?? undefined,
      explicationMarkdown: st?.explicationMarkdown ?? undefined,
      durationMin: st?.durationMin ?? undefined,
      kanbanStatus: st?.kanbanStatus ?? undefined,
      kanbanOrder: st?.kanbanOrder ?? undefined,
    }))
    .filter((x) => Number.isFinite(x.id) && x.id > 0);

  const sceneRoles = ((scene as { sceneRoles?: SceneRolesDataV1 } | null)?.sceneRoles ??
    null) as SceneRolesDataV1 | null;

  return { steps, roleEmailsByKey, roleTitleByKey, sceneRoles };
}

/** Материалы из RTK projectMaterial → кэш детальной страницы сессии. */
export function projectMaterialToDirectorSessionCache(
  data: ProjectDataCache[string],
): DirectorSessionProjectDataCache[string] {
  return {
    steps: data.steps,
    sceneId: null,
    sceneRoles: data.sceneRoles ?? null,
  };
}
