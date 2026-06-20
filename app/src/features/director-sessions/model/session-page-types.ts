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

export type SlotInsight = {
  slotId: string;
  time: string;
  projectLabel: string;
  stepLabel: string;
  title: string;
  ready: boolean;
  missingRoles: string[];
  actors: string[];
};

/** ok — все явки; warn — ждём явки; bad — не собирается; none — нет материала */
export type SlotGatherStatus = "ok" | "warn" | "bad" | "none";

export type DaySessionSlotPreview = {
  slotId: string;
  time: string;
  projectLabel: string;
  stepLabel: string;
  gatherStatus: SlotGatherStatus;
  durationMin: number;
};

export type DaySessionPreview = {
  sessionId: string;
  slots: DaySessionSlotPreview[];
  slotsOkCount: number;
  slotsWithMaterialCount: number;
  commentPreview: string;
};

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
