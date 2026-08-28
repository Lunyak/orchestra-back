import dayjs from "dayjs";
import { useMemo } from "react";
import type { TeamProfile } from "../../../sync/api/profile";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import { useProfilesBatchQuery } from "../../profile/api/profile-api";
import {
  buildEmailsBySlotId,
  buildFreeRolesNormSet,
  buildSelectableScenes,
  buildSlotChartEmailSet,
  buildSlotDisplayById,
  buildSlotRehearsalToneClassById,
  buildSlotsBySceneRefInSession,
  collectSlotPlannerEmails,
  filterProjectScenesForPicker,
  formatSlotTimeLabel,
  mergeProfilesByEmail,
  resolveSelectedSceneLabel,
  resolveSelectedSceneProjectLabel,
  sessionDateKeyFromStartsAt,
  slotWindowFromSession,
} from "./director-session-page-helpers";
import { isSlotScenePickerCustomSlug } from "./session-page-utils";
import type { DirectorSessionProjectDataCache } from "./session-page-types";
import {
  getNormalizedRoleKeysForAllScenes,
  getNormalizedRoleKeysForSlotScene,
  type DirectorSlotPlannedData,
} from "./session-slot-planned";

export function useDirectorSessionSlotDerived(args: {
  accessToken: string | null | undefined;
  session: DirectorRehearsalSession | null;
  slot: DirectorSessionSlot | null;
  dataCache: DirectorSessionProjectDataCache;
  roleEmailsByProjectSlug: Record<string, Record<string, string[]>>;
  roleEmailsByKey: Record<string, string[]>;
  roleTitleByKey: Record<string, string>;
  teamProfiles: TeamProfile[];
  projectFilter: string;
  projectLabelBySlug: Map<string, string>;
  selectedParticipantEmailsList: string[];
}) {
  const {
    accessToken,
    session,
    slot,
    dataCache,
    roleEmailsByProjectSlug,
    roleEmailsByKey,
    roleTitleByKey,
    teamProfiles,
    projectFilter,
    projectLabelBySlug,
    selectedParticipantEmailsList,
  } = args;

  const sessionDateKey = useMemo(
    () => sessionDateKeyFromStartsAt(session?.startsAt),
    [session?.startsAt],
  );

  const slotWindow = useMemo(
    () => slotWindowFromSession(session, slot),
    [session, slot],
  );

  const slotPlannerEmails = useMemo(
    () =>
      collectSlotPlannerEmails(session, dataCache, roleEmailsByProjectSlug),
    [session, session?.slots, dataCache, roleEmailsByProjectSlug],
  );

  const { data: plannerProfiles = [] } = useProfilesBatchQuery(
    slotPlannerEmails,
    { skip: !accessToken || slotPlannerEmails.length === 0 },
  );

  const profilesForSlotTones = useMemo(
    () => mergeProfilesByEmail(teamProfiles, plannerProfiles),
    [teamProfiles, plannerProfiles],
  );

  const slotRehearsalToneClassById = useMemo(
    () =>
      buildSlotRehearsalToneClassById({
        session,
        sessionDateKey,
        dataCache,
        roleEmailsByProjectSlug,
        profilesForSlotTones,
      }),
    [
      session?.id,
      session?.startsAt,
      session?.slots,
      sessionDateKey,
      dataCache,
      roleEmailsByProjectSlug,
      profilesForSlotTones,
    ],
  );

  const emailsBySlotId = useMemo(
    () => buildEmailsBySlotId(session, dataCache, roleEmailsByProjectSlug),
    [session, session?.slots, dataCache, roleEmailsByProjectSlug],
  );

  const freeRolesNormSet = useMemo(
    () =>
      buildFreeRolesNormSet({
        roleEmailsByKey,
        sessionDateKey,
        slotWindow,
        profilesForSlotTones,
      }),
    [roleEmailsByKey, sessionDateKey, slotWindow, profilesForSlotTones],
  );

  const headerTimeLabel = useMemo(() => {
    if (!session?.startsAt) return "";
    return dayjs(session.startsAt).format("D MMMM YYYY, HH:mm");
  }, [session?.startsAt]);

  const slotTimeLabel = useMemo(
    () => formatSlotTimeLabel(session, slot),
    [session, slot],
  );

  const projectScenes = useMemo(
    () =>
      filterProjectScenesForPicker(
        dataCache,
        projectFilter,
        isSlotScenePickerCustomSlug(projectFilter),
      ),
    [dataCache, projectFilter],
  );

  const selectableScenes = useMemo(
    () =>
      buildSelectableScenes({
        projectFilter,
        isCustomSlug: isSlotScenePickerCustomSlug(projectFilter),
        projectScenes,
        freeRolesNormSet,
        dataCache,
        roleTitleByKey,
      }),
    [freeRolesNormSet, projectScenes, dataCache, projectFilter, roleTitleByKey],
  );

  const slotsBySceneRefInSession = useMemo(
    () => buildSlotsBySceneRefInSession(session),
    [session?.id, session?.slots],
  );

  const selectedScene = useMemo(() => {
    if (!slot?.ref) return null;
    const slug = slot.ref.projectSlug;
    const id = slot.ref.sceneId;
    const data = dataCache[slug];
    return data?.scenes?.find((s) => s.id === id) ?? null;
  }, [dataCache, slot?.ref]);

  const selectedSceneLabel = useMemo(
    () => resolveSelectedSceneLabel({ slot, selectedScene }),
    [selectedScene, slot?.isProgRun, slot?.title],
  );

  const selectedSceneProjectLabel = useMemo(
    () => resolveSelectedSceneProjectLabel({ slot, projectLabelBySlug }),
    [slot?.ref?.projectSlug, slot?.title, projectLabelBySlug],
  );

  const slotDisplayById = useMemo(
    () =>
      buildSlotDisplayById({
        session,
        dataCache,
        projectLabelBySlug,
      }),
    [dataCache, projectLabelBySlug, session?.slots],
  );

  const slotPlannedInput = useMemo((): DirectorSlotPlannedData | null => {
    if (!slot?.ref) return null;
    const slug = String(slot.ref.projectSlug ?? "").trim();
    const cached = dataCache[slug];
    return {
      scenes: cached?.scenes ?? [],
      sceneRoles: cached?.sceneRoles ?? null,
      roleEmailsByKey,
    };
  }, [slot?.ref, dataCache, roleEmailsByKey]);

  const slotRoleKeysForPicker = useMemo(() => {
    if (!slot?.ref || !slotPlannedInput) return [];
    if (slot.isProgRun) {
      return getNormalizedRoleKeysForAllScenes(
        slotPlannedInput.scenes,
        slotPlannedInput.sceneRoles,
      );
    }
    const sceneId = slot.ref.sceneId;
    const scene = slotPlannedInput.scenes.find((s) => s.id === sceneId) ?? null;
    return getNormalizedRoleKeysForSlotScene(
      scene,
      slotPlannedInput.sceneRoles,
      sceneId,
    );
  }, [slot?.ref, slot?.isProgRun, slotPlannedInput]);

  const slotChartEmailSet = useMemo(
    () =>
      buildSlotChartEmailSet({
        slot,
        slotPlannedInput,
        selectedParticipantEmailsList,
      }),
    [
      slot?.ref,
      slot?.isProgRun,
      slot?.roleRehearsalPicks,
      slotPlannedInput,
      selectedParticipantEmailsList,
    ],
  );

  const selectedSceneIdForPicker = useMemo(() => {
    if (!slot) return null;
    if (!slot.isProgRun && slot.ref?.projectSlug === projectFilter) {
      return Number(slot.ref.sceneId) || null;
    }
    return null;
  }, [slot, projectFilter]);

  const isProgRunSelectedForPicker = Boolean(
    slot?.isProgRun && slot.ref?.projectSlug === projectFilter,
  );

  const initialCustomTitleForPicker =
    slot && !slot.ref ? String(slot.title ?? "").trim() : "";

  return {
    sessionDateKey,
    slotWindow,
    profilesForSlotTones,
    slotRehearsalToneClassById,
    emailsBySlotId,
    freeRolesNormSet,
    headerTimeLabel,
    slotTimeLabel,
    selectableScenes,
    slotsBySceneRefInSession,
    selectedScene,
    selectedSceneLabel,
    selectedSceneProjectLabel,
    slotDisplayById,
    slotPlannedInput,
    slotRoleKeysForPicker,
    slotChartEmailSet,
    selectedSceneIdForPicker,
    isProgRunSelectedForPicker,
    initialCustomTitleForPicker,
  };
}
