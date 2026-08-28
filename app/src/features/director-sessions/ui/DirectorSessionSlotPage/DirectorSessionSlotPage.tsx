import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { useDirectorSessionSlotPage } from "../../model/useDirectorSessionSlotPage";
import { DirectorSessionSlotPageHead } from "./DirectorSessionSlotPageHead";
import { DirectorSessionSlotScenePicker } from "./DirectorSessionSlotScenePicker";
import { DirectorSessionSlotSelection } from "./DirectorSessionSlotSelection";
import "../director-sessions.css";
import "./DirectorSessionSlotPage.css";

export function DirectorSessionSlotPage() {
  const vm = useDirectorSessionSlotPage();

  if (!vm.accessToken) {
    return (
      <div className="director-session-slot-page__message">
        Нужно войти, чтобы открыть слот.
      </div>
    );
  }
  if (!vm.sid || !vm.slId) {
    return (
      <div className="director-session-slot-page__message">
        Некорректный URL слота.
      </div>
    );
  }

  const showContent = Boolean(vm.session && vm.slot && !vm.loading && !vm.error);

  return (
    <div className="director-session-slot-page">
      <DirectorSessionSlotPageHead
        sessionBackHref={vm.sessionBackHref}
        headerTimeLabel={vm.headerTimeLabel}
        slotTimeLabel={vm.slotTimeLabel}
      />

      {vm.loading ? <PageLoader variant="view" label="Загрузка…" /> : null}
      {vm.error ? (
        <div className="settings-invite-error director-session-slot-page__error">
          {vm.error}
        </div>
      ) : null}

      {showContent && vm.session && vm.slot ? (
        <div className="director-session-slot-page__grid">
          <DirectorSessionSlotSelection
            slot={vm.slot}
            selectedProjectLabel={vm.selectedProjectLabel}
            selectedScene={vm.selectedScene}
            selectedScenePreviewText={vm.selectedScenePreviewText}
            sessionDateKey={vm.sessionDateKey}
            teamProfiles={vm.teamProfiles}
            membersLoading={vm.membersLoading}
            slotChartEmailSet={vm.slotChartEmailSet}
            slotRoleKeysForPicker={vm.slotRoleKeysForPicker}
            roleTitleByKey={vm.roleTitleByKey}
            roleEmailsByKey={vm.roleEmailsByKey}
            onRolePicksChange={vm.onRoleRehearsalPicksChange}
            slotNotesDraft={vm.slotNotesDraft}
            onSlotNotesChange={vm.onSlotNotesChange}
            onSlotNotesBlur={vm.onSlotNotesBlur}
            onClearMaterial={vm.clearSlotMaterial}
            onDone={vm.goBackToSession}
          />
          <DirectorSessionSlotScenePicker
            slot={vm.slot}
            projectFilter={vm.projectFilter}
            onProjectFilterChange={vm.setProjectFilter}
            visibleProjects={vm.visibleProjects}
            projectLabelBySlug={vm.projectLabelBySlug}
            query={vm.query}
            onQueryChange={vm.setQuery}
            onlySelectable={vm.onlySelectable}
            onOnlySelectableChange={vm.setOnlySelectable}
            membersLoading={vm.membersLoading}
            rolesLoading={vm.rolesLoading}
            slotWindowLabel={vm.slotWindowLabel}
            scenesLoading={vm.scenesLoading}
            scenesError={vm.scenesError}
            availabilityError={vm.availabilityError}
            scenesForList={vm.scenesForList}
            onSelectScene={vm.assignSceneToSlot}
          />
        </div>
      ) : null}
    </div>
  );
}
