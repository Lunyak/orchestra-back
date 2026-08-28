import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import React, { useEffect, useState } from "react";
import "../../director-session-detail/director-session-detail.css";
import { RehearsalPlanSectionChrome } from "../../../shared/components/rehearsal-plan/RehearsalPlanSectionChrome";
import "../../rehearsals/ui/rehearsals.css";
import "./director-sessions.css";
import {
  useDirectorSessionsPage,
  type DirectorSessionsPageViewModel,
} from "../model/useDirectorSessionsPage";
import { DirectorSessionsCalendarStage } from "./DirectorSessionsCalendarStage";
import { DirectorSessionsDayStage } from "./DirectorSessionsDayStage";
import { DirectorSessionsSessionStage } from "./DirectorSessionsSessionStage";
import type { SessionsBrowseStage } from "./DirectorSessionsShared";
import { CallBotSettingsTrigger } from "../../call-bot/ui/CallBotSettingsTrigger";

export type { DirectorSessionsPageViewModel } from "../model/useDirectorSessionsPage";
export { useDirectorSessionsPage } from "../model/useDirectorSessionsPage";

dayjs.locale("ru");

export function DirectorSessionsPageView({
  vm,
}: {
  vm: DirectorSessionsPageViewModel;
}) {
  const {
    projectName,
    setActiveSessionId,
    navigateToSessionPage,
    activeSession,
    deleteSession,
    createSessionForSelectedDate,
    createSessionAtDate,
    setCalendarState,
    dotsByDate,
    eventsByDate,
    sessionsForSelectedDay,
    calendarSelectedDateLabel,
    updateActiveSession,
    sessionDateInputId,
    sessionTimeInputId,
    getLocalDateTimeParts,
    toDateKey,
    activeSlotId,
    setActiveSlotId,
    formatSlotTime,
    slotInsights,
    slotGatherStatusBySlotId,
    daySessionPreviewsById,
    publishError,
    saveError,
    sendingAvailabilityReminders,
    availabilityReminderMessage,
    sessionCommentDraft,
    onSessionCommentChange,
    onSessionCommentBlur,
    publishActiveSession,
    publishing,
    includeUnavailableInCall,
    setIncludeUnavailableInCall,
    activeSessionPublished,
    sendAvailabilityReminders,
    sessionMissingAvailabilityEmails,
    sessionsSideCalledRowsBySlotId,
    sessionIdFromUrl,
    navigate,
    activeSessionId,
  } = vm;

  const [browseStage, setBrowseStage] = useState<SessionsBrowseStage>(() =>
    sessionIdFromUrl ? "session" : "calendar",
  );

  useEffect(() => {
    if (sessionIdFromUrl && activeSessionId) {
      setBrowseStage("session");
    }
  }, [sessionIdFromUrl, activeSessionId]);

  const goCalendar = () => {
    setActiveSessionId(null);
    setActiveSlotId(null);
    setBrowseStage("calendar");
  };

  const goDay = () => {
    setActiveSlotId(null);
    setBrowseStage("day");
  };

  const openDay = (dateKey: string) => {
    setCalendarState((prev) => ({ ...prev, selectedDate: dateKey }));
    setActiveSessionId(null);
    setActiveSlotId(null);
    setBrowseStage("day");
  };

  const openSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setActiveSlotId(null);
    setBrowseStage("session");
  };

  const handleCreateSession = async () => {
    const createdSession = await createSessionForSelectedDate();
    if (createdSession) setBrowseStage("session");
  };

  const handleCalendarDoubleClick = async (dateKey: string) => {
    const createdSession = await createSessionAtDate(dateKey);
    if (createdSession) setBrowseStage("session");
  };

  const toggleSlot = (slotId: string) => {
    setActiveSlotId((prev) => (prev === slotId ? null : slotId));
  };

  return (
    <div className="rehearsals-page sessions-page">
      <RehearsalPlanSectionChrome activeTab="sessions">
        <div className="sessions-flow">
          {browseStage === "calendar" || browseStage === "day" ? (
            <div className="sessions-bot-settings-trigger">
              <CallBotSettingsTrigger />
            </div>
          ) : null}
          {browseStage === "calendar" ? (
            <DirectorSessionsCalendarStage
              dotsByDate={dotsByDate}
              eventsByDate={eventsByDate}
              onStateChange={setCalendarState}
              onDayClick={openDay}
              onDayDoubleClick={(date) => void handleCalendarDoubleClick(date)}
            />
          ) : null}

          {browseStage === "day" ? (
            <DirectorSessionsDayStage
              calendarSelectedDateLabel={calendarSelectedDateLabel}
              saveError={saveError}
              sessionsForSelectedDay={sessionsForSelectedDay}
              daySessionPreviewsById={daySessionPreviewsById}
              onBack={goCalendar}
              onCreateSession={() => void handleCreateSession()}
              onOpenSession={openSession}
              onNavigateToSessionPage={navigateToSessionPage}
              onDeleteSession={(sessionId) => void deleteSession(sessionId)}
            />
          ) : null}

          {browseStage === "session" && activeSession ? (
            <DirectorSessionsSessionStage
              projectName={projectName}
              activeSession={activeSession}
              activeSessionPublished={activeSessionPublished}
              calendarSelectedDateLabel={calendarSelectedDateLabel}
              sessionDateInputId={sessionDateInputId}
              sessionTimeInputId={sessionTimeInputId}
              sessionCommentDraft={sessionCommentDraft}
              onSessionCommentChange={onSessionCommentChange}
              onSessionCommentBlur={onSessionCommentBlur}
              updateActiveSession={updateActiveSession}
              getLocalDateTimeParts={getLocalDateTimeParts}
              toDateKey={toDateKey}
              formatSlotTime={formatSlotTime}
              activeSlotId={activeSlotId}
              onToggleSlot={toggleSlot}
              slotInsights={slotInsights}
              slotGatherStatusBySlotId={slotGatherStatusBySlotId}
              sessionsSideCalledRowsBySlotId={sessionsSideCalledRowsBySlotId}
              publishError={publishError}
              saveError={saveError}
              availabilityReminderMessage={availabilityReminderMessage}
              includeUnavailableInCall={includeUnavailableInCall}
              setIncludeUnavailableInCall={setIncludeUnavailableInCall}
              publishing={publishing}
              onPublish={() => void publishActiveSession()}
              sendingAvailabilityReminders={sendingAvailabilityReminders}
              sessionMissingAvailabilityEmails={
                sessionMissingAvailabilityEmails
              }
              onSendAvailabilityReminders={() =>
                void sendAvailabilityReminders()
              }
              onBack={goDay}
              onNavigate={navigate}
            />
          ) : null}

          {browseStage === "session" && !activeSession ? (
            <div className="rehearsals-muted sessions-main-empty">
              Сессия не найдена.{" "}
              <button
                type="button"
                className="sessions-nav-back"
                onClick={goDay}
              >
                Вернуться к списку
              </button>
            </div>
          ) : null}
        </div>
      </RehearsalPlanSectionChrome>
    </div>
  );
}

type DirectorSessionsPageProps = {
  projectSlug?: string;
  filterByProject?: boolean;
};

export function DirectorSessionsPage({
  projectSlug,
  filterByProject = true,
}: DirectorSessionsPageProps) {
  const vm = useDirectorSessionsPage({ projectSlug, filterByProject });
  if (vm.needsAuth) {
    return (
      <div className="rehearsals-page sessions-page">
        <div className="rehearsals-muted">Нужно войти.</div>
      </div>
    );
  }
  if (vm.loading) {
    return <PageBootLoader label="Загрузка сессий…" />;
  }
  if (vm.error) {
    return (
      <div className="rehearsals-page sessions-page">
        <div className="rehearsals-error">{vm.error}</div>
      </div>
    );
  }
  return <DirectorSessionsPageView vm={vm} />;
}
