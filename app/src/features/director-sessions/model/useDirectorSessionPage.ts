import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo } from "react";
import { useAuth } from "../../auth";
import type { TeamProfile } from "../../../sync/api/profile";
import { useDirectorSessionMaterial } from "./useDirectorSessionMaterial";
import { useDirectorSessionMembers } from "./useDirectorSessionMembers";
import { useDirectorSessionProjects } from "./useDirectorSessionProjects";
import { useDirectorSessionRoute } from "./useDirectorSessionRoute";
import { useDirectorSessionSlotDerived } from "./useDirectorSessionSlotDerived";
import { useDirectorSessionSlotEditors } from "./useDirectorSessionSlotEditors";
import { useDirectorSessionSync } from "./useDirectorSessionSync";
import { SLOT_SCENE_PICKER_CUSTOM_SLUG } from "./session-page-utils";

dayjs.locale("ru");

export type DirectorSessionPageViewModel = ReturnType<
  typeof useDirectorSessionPage
>;

export function useDirectorSessionPage() {
  const { accessToken } = useAuth();
  const route = useDirectorSessionRoute();
  const {
    sid,
    slId,
    theaterId,
    isTheaterContext,
    sessionHref,
    sessionsListHref,
    navigate,
    selectSlot,
    closeSlot,
    onNoSlotsLeft,
  } = route;

  const sync = useDirectorSessionSync({ accessToken, sid, slId });
  const {
    sessions,
    session,
    slot,
    error,
    loading,
    busyConflictError,
    setBusyConflictError,
    dismissBusyConflictError,
    persistSessions,
    updateSlot,
    slotNotesDraft,
    onSlotNotesChange,
    onSlotNotesBlur,
  } = sync;

  const projects = useDirectorSessionProjects({
    accessToken,
    sid,
    slId,
    theaterId,
    isTheaterContext,
    slotProjectSlug: slot?.ref?.projectSlug ?? "",
  });
  const {
    visibleProjects,
    projectLabelBySlug,
    projectFilter,
    setProjectFilter,
    rolesSlug,
    scenePickerProjects,
  } = projects;

  const members = useDirectorSessionMembers({
    accessToken,
    theaterId,
    isTheaterContext,
    rolesSlug,
  });
  const {
    membersLoading,
    roleEmailsByKey,
    roleTitleByKey,
    teamProfiles,
    theaterMembers,
    theaterScheduleProfiles,
    theaterScheduleProfilesLoading,
    availabilityError,
  } = members;

  const material = useDirectorSessionMaterial({
    accessToken,
    session,
    projectFilter,
    rolesSlug,
  });
  const {
    dataCache,
    scenesLoading,
    scenesError,
    roleEmailsByProjectSlug,
  } = material;

  const editors = useDirectorSessionSlotEditors({
    slot,
    projectFilter,
    setProjectFilter,
    visibleProjects,
    rolesSlug,
    roleEmailsByKey,
    roleEmailsByProjectSlug,
    dataCache,
    theaterMembers,
    updateSlot,
  });
  const {
    participantsModalOpen,
    setParticipantsModalOpen,
    sceneModalOpen,
    setSceneModalOpen,
    openSceneModal,
    closeSceneModal,
    openParticipantsModal,
    closeParticipantsModal,
    selectedParticipantEmailsList,
    selectedTheaterMembers,
    applySlotParticipants,
    assignSceneToSlot,
    assignProgRunToSlot,
    assignCustomSlotTitle,
    clearSlotProgRun,
    onRoleRehearsalPicksChange,
  } = editors;

  const derived = useDirectorSessionSlotDerived({
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
  });
  const {
    sessionDateKey,
    profilesForSlotTones,
    slotRehearsalToneClassById,
    emailsBySlotId,
    headerTimeLabel,
    slotTimeLabel,
    selectableScenes,
    slotsBySceneRefInSession,
    selectedScene,
    selectedSceneLabel,
    selectedSceneProjectLabel,
    slotDisplayById,
    slotRoleKeysForPicker,
    slotChartEmailSet,
    selectedSceneIdForPicker,
    isProgRunSelectedForPicker,
    initialCustomTitleForPicker,
  } = derived;

  const scheduleProfiles = useMemo((): TeamProfile[] => {
    if (slot?.ref) return teamProfiles;
    if (isTheaterContext) return theaterScheduleProfiles;
    return teamProfiles;
  }, [slot?.ref, isTheaterContext, teamProfiles, theaterScheduleProfiles]);

  const scheduleMembersLoading = Boolean(
    slot?.ref
      ? membersLoading
      : isTheaterContext
        ? theaterScheduleProfilesLoading
        : membersLoading,
  );

  return {
    accessToken,
    sid,
    slId,
    theaterId,
    isTheaterContext,
    loading,
    error,
    session,
    sessions,
    slot,
    sessionsListHref,
    sessionHref,
    navigate,
    selectSlot,
    closeSlot,
    onNoSlotsLeft,
    persistSessions,
    busyConflictError,
    dismissBusyConflictError,
    setBusyConflictError,
    slotRehearsalToneClassById,
    slotDisplayById,
    emailsBySlotId,
    profilesForSlotTones,
    sessionDateKey,
    projectFilter,
    setProjectFilter,
    visibleProjects,
    scenePickerProjects,
    sceneModalOpen,
    setSceneModalOpen,
    openSceneModal,
    closeSceneModal,
    participantsModalOpen,
    setParticipantsModalOpen,
    openParticipantsModal,
    closeParticipantsModal,
    selectableScenes,
    scenesLoading,
    scenesError,
    availabilityError,
    selectedSceneIdForPicker,
    isProgRunSelectedForPicker,
    initialCustomTitleForPicker,
    slotsBySceneRefInSession,
    assignSceneToSlot,
    assignProgRunToSlot,
    assignCustomSlotTitle,
    clearSlotProgRun,
    selectedScene,
    selectedSceneLabel,
    selectedSceneProjectLabel,
    scheduleProfiles,
    scheduleMembersLoading,
    slotChartEmailSet,
    slotRoleKeysForPicker,
    roleTitleByKey,
    roleEmailsByKey,
    teamProfiles,
    updateSlot,
    onRoleRehearsalPicksChange,
    theaterMembers,
    selectedTheaterMembers,
    selectedParticipantEmailsList,
    applySlotParticipants,
    slotNotesDraft,
    onSlotNotesChange,
    onSlotNotesBlur,
    headerTimeLabel,
    slotTimeLabel,
    SLOT_SCENE_PICKER_CUSTOM_SLUG,
  };
}
