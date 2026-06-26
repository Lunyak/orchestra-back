import type { ScriptScene } from "../../../shared/types/script";
import type { PlaybookRolesDataV1 } from "../../playbook";
import type { DirectorSessionParticipant } from "../../../sync/api/director-sessions";

export type ProjectDataCache = Record<
  string,
  {
    scenes: ScriptScene[];
    roleEmailsByKey: Record<string, string[]>;
    roleTitleByKey: Record<string, string>;
    sceneRoles?: PlaybookRolesDataV1 | null;
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
  sceneLabel: string;
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
  sceneLabel: string;
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

/** Кэш сцен сценария на странице детальной сессии (отличается от ProjectDataCache списка сессий). */
export type DirectorSessionProjectDataCache = Record<
  string,
  {
    scenes: ScriptScene[];
    sceneId: string | null;
    sceneRoles: PlaybookRolesDataV1 | null;
  }
>;
