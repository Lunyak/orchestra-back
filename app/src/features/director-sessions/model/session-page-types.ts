import type { ScriptStep } from "../../../shared/types/script";
import type { SceneRolesDataV1 } from "../../scene";
import type { DirectorSessionParticipant } from "../../../sync/api/director-sessions";

export type ProjectDataCache = Record<
  string,
  {
    steps: ScriptStep[];
    roleEmailsByKey: Record<string, string[]>;
    roleTitleByKey: Record<string, string>;
    sceneRoles?: SceneRolesDataV1 | null;
  }
>;

export type AvailabilityTimeRange = { from: string; to: string };

export type SessionsSideCalledStatusTone =
  | "muted"
  | "ok"
  | "warn"
  | "bad"
  | "confirmed";

export type SlotActorAvailability = "free" | "busy" | "unknown";

export type { DirectorSessionParticipant };

/** Кэш шагов сцены на странице детальной сессии (отличается от ProjectDataCache списка сессий). */
export type DirectorSessionProjectDataCache = Record<
  string,
  {
    steps: ScriptStep[];
    sceneId: string | null;
    sceneRoles: SceneRolesDataV1 | null;
  }
>;
