import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from "classnames";
import { RehearsalPlanSectionChrome } from "../../../../shared/components/rehearsal-plan/RehearsalPlanSectionChrome";
import { useDirectorSessionPage } from "../../model/useDirectorSessionPage";
import { DirectorSessionSlotsPanel } from "../DirectorSessionSlotsPanel";
import { DirectorSessionPageHead } from "./DirectorSessionPageHead";
import { DirectorSessionSlotDetail } from "./DirectorSessionSlotDetail";
import "../director-sessions.css";
import "./style.css";

export function DirectorSessionPage() {
  const vm = useDirectorSessionPage();
  const {
    accessToken,
    sid,
    slId,
    isTheaterContext,
    loading,
    error,
    session,
    sessions,
    slot,
    sessionsListHref,
    selectSlot,
    closeSlot,
    onNoSlotsLeft,
    persistSessions,
    busyConflictError,
    dismissBusyConflictError,
    slotRehearsalToneClassById,
    slotDisplayById,
    emailsBySlotId,
    profilesForSlotTones,
    sessionDateKey,
    projectFilter,
    setProjectFilter,
    visibleProjects,
    scenePickerProjects,
    selectableScenes,
    scenesLoading,
    scenesError,
    availabilityError,
    slotsBySceneRefInSession,
    assignSceneToSlot,
    assignProgRunToSlot,
    assignCustomSlotTitle,
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
    onRoleRehearsalPicksChange,
    theaterMembers,
    selectedTheaterMembers,
    selectedParticipantEmailsList,
    applySlotParticipants,
    slotNotesDraft,
    onSlotNotesChange,
    onSlotNotesBlur,
  } = vm;

  if (!accessToken) {
    return (
      <div className="director-session-page__message">
        Нужно войти, чтобы открыть страницу сессии.
      </div>
    );
  }
  if (!sid) {
    return (
      <div className="director-session-page__message">Некорректный адрес.</div>
    );
  }

  const pageTitle =
    session?.title ?? (isTheaterContext ? "Репетиция" : "Сессия");

  const pageBody = (
    <>
      <DirectorSessionPageHead
        sessionsListHref={sessionsListHref}
        isTheaterContext={isTheaterContext}
        title={pageTitle}
      />

      {loading ? <PageLoader variant="view" label="Загрузка…" /> : null}
      {error ? (
        <div className="settings-invite-error director-session-page__error">
          {error}
        </div>
      ) : null}

      {session && !loading ? (
        <div className="director-session-page__grid">
          <DirectorSessionSlotsPanel
            session={session}
            sessions={sessions}
            slotToneClassById={slotRehearsalToneClassById}
            slotDisplayById={slotDisplayById}
            emailsBySlotId={emailsBySlotId}
            profilesByEmail={profilesForSlotTones}
            sessionDateKey={sessionDateKey}
            selectedSlotId={slId || null}
            onSelectSlot={selectSlot}
            onRequestCloseSlot={closeSlot}
            onNoSlotsLeft={onNoSlotsLeft}
            persistSessions={persistSessions}
            busyConflictError={busyConflictError}
            onDismissBusyConflictError={dismissBusyConflictError}
            slotSettings={
              slot ? (
                <DirectorSessionSlotDetail
                  slot={slot}
                  isTheaterContext={isTheaterContext}
                  selectedSceneLabel={selectedSceneLabel}
                  selectedSceneProjectLabel={selectedSceneProjectLabel}
                  selectedScene={selectedScene}
                  projectFilter={projectFilter}
                  onProjectFilterChange={setProjectFilter}
                  visibleProjects={visibleProjects}
                  scenePickerProjects={scenePickerProjects}
                  selectableScenes={selectableScenes}
                  scenesLoading={scenesLoading}
                  scenesError={scenesError}
                  availabilityError={availabilityError}
                  sessionStartsAt={session.startsAt ?? null}
                  slotsBySceneRefInSession={slotsBySceneRefInSession}
                  onSelectScene={assignSceneToSlot}
                  onSelectProgRun={assignProgRunToSlot}
                  onSelectCustom={assignCustomSlotTitle}
                  sessionDateKey={sessionDateKey}
                  scheduleProfiles={scheduleProfiles}
                  scheduleMembersLoading={scheduleMembersLoading}
                  slotChartEmailSet={slotChartEmailSet}
                  slotRoleKeysForPicker={slotRoleKeysForPicker}
                  roleTitleByKey={roleTitleByKey}
                  roleEmailsByKey={roleEmailsByKey}
                  teamProfiles={teamProfiles}
                  onRolePicksChange={onRoleRehearsalPicksChange}
                  theaterMembers={theaterMembers}
                  selectedTheaterMembers={selectedTheaterMembers}
                  selectedParticipantEmails={selectedParticipantEmailsList}
                  onApplyParticipants={applySlotParticipants}
                  slotNotesDraft={slotNotesDraft}
                  onSlotNotesChange={onSlotNotesChange}
                  onSlotNotesBlur={onSlotNotesBlur}
                />
              ) : undefined
            }
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "director-session-page",
        isTheaterContext && "director-session-page--theater",
      )}
    >
      {isTheaterContext ? (
        pageBody
      ) : (
        <RehearsalPlanSectionChrome activeTab="sessions">
          {pageBody}
        </RehearsalPlanSectionChrome>
      )}
    </div>
  );
}
