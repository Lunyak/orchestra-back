import { Navigate } from "react-router-dom";
import { theaterOrganizationPath } from "../../../app/router/paths";
import { useTheaterRehearsalsPage } from "../model/useTheaterRehearsalsPage";
import "../../director-sessions/ui/director-sessions.css";
import "../../rehearsals/ui/rehearsals.css";
import { TheaterCreateRehearsalModal } from "./TheaterCreateRehearsalModal";
import { TheaterRehearsalsCalendarColumn } from "./TheaterRehearsalsCalendarColumn";
import { TheaterRehearsalsDayPanel } from "./TheaterRehearsalsDayPanel";
import { TheaterRehearsalsHead } from "./TheaterRehearsalsHead";
import "./organizations.css";
import "./theater-rehearsals.css";

export function TheaterRehearsalsPage() {
  const vm = useTheaterRehearsalsPage();

  if (!vm.theaterId) {
    return <Navigate to={theaterOrganizationPath()} replace />;
  }

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="sessions-page rehearsals-page theater-rehearsals-page">
          <TheaterRehearsalsHead theaterId={vm.theaterId} />

          {vm.error ? (
            <div className="rehearsals-error" role="alert">
              {vm.error}
            </div>
          ) : null}

          <div className="sessions-layout theater-rehearsals-page__layout">
            <TheaterRehearsalsCalendarColumn
              theaterId={vm.theaterId}
              dotsByDate={vm.dotsByDate}
              eventsByDate={vm.eventsByDate}
              onStateChange={vm.setCalendarState}
            />

            <TheaterRehearsalsDayPanel
              selectedDateLabel={vm.selectedDateLabel}
              dayMetaLabel={vm.dayMetaLabel}
              canCreateRehearsal={vm.canCreateRehearsal}
              onCreate={vm.openCreateModal}
              loading={vm.loading}
              dayRehearsals={vm.dayRehearsals}
              bundleSessions={vm.bundleSessions}
              selectedRehearsalId={vm.selectedRehearsalId}
              onSelectRehearsal={vm.selectRehearsal}
              onOpenRehearsal={vm.openRehearsalDetails}
              selectedRehearsal={vm.selectedRehearsal}
              selectedCanManage={vm.selectedCanManage}
              selectedCanPublish={vm.selectedCanPublish}
              selectedPublished={vm.selectedPublished}
              publishError={vm.publishError}
              creating={vm.creating}
              publishing={vm.publishing}
              includeUnavailableInCall={vm.includeUnavailableInCall}
              onIncludeUnavailableChange={vm.setIncludeUnavailableInCall}
              onEdit={vm.openEditModal}
              onDelete={() => void vm.handleDeleteRehearsal()}
              onPublish={() => void vm.publishSelectedRehearsal()}
            />
          </div>
        </main>
      </div>

      <TheaterCreateRehearsalModal
        isOpen={vm.createModalOpen}
        onClose={vm.closeCreateModal}
        mode={vm.modalMode}
        dateLabel={vm.selectedDateLabel}
        title={vm.editTitle}
        onTitleChange={(nextTitle) => {
          vm.setEditTitle(nextTitle);
          vm.setCreateError("");
        }}
        createTime={vm.createTime}
        timeStepMin={vm.createTimeStepMin}
        onCreateTimeChange={(time) => {
          vm.setCreateTime(time);
          vm.setCreateError("");
        }}
        createError={vm.createError}
        creating={vm.creating}
        canSubmit={vm.canSubmitCreate}
        createTimeTaken={vm.createTimeTaken}
        onConfirm={vm.confirmModal}
      />
    </div>
  );
}
