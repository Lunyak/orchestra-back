import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from "classnames";
import { Link } from "react-router-dom";
import { usePremiseDetailPage } from "../../features/premises/model/usePremiseDetailPage";
import { getOrganizationInitials } from "../../features/premises/model/premise-detail-helpers";
import { premiseKindLabel } from "../../features/premises/model/premise-utils";
import { MapPinIcon } from "../../features/premises/ui/MapPinIcon";
import { PremiseDetailMembersTab } from "../../features/premises/ui/PremiseDetailMembersTab";
import { PremiseDetailOverviewTab } from "../../features/premises/ui/PremiseDetailOverviewTab";
import { PremiseDetailRentalsTab } from "../../features/premises/ui/PremiseDetailRentalsTab";
import { PremiseDetailScheduleTab } from "../../features/premises/ui/PremiseDetailScheduleTab";
import { PremiseDetailSettingsTab } from "../../features/premises/ui/PremiseDetailSettingsTab";
import { PremiseDetailSlotModal } from "../../features/premises/ui/PremiseDetailSlotModal";
import "../../features/rehearsals/ui/rehearsals.css";
import "../../features/director-sessions/ui/director-sessions.css";
import "./style.css";

export function PremiseDetailPage() {
  const vm = usePremiseDetailPage();
  const {
    accessToken,
    premisesPath,
    premise,
    premiseLoading,
    premiseError,
    activeTab,
    setActiveTab,
    membersData,
    rentalsData,
    canManagePremise,
    todaySlots,
    pendingSlots,
    occupiedHours,
    occupiedDays,
    unpaidAmountRub,
    hasTrackedSlots,
    trackedSlotGroups,
    memberProfileByEmail,
    rentalActionId,
    rentalActionError,
    openEditSlot,
    handleBookingRequestReview,
    premiseId,
    slotsFetching,
    dots,
    selectedWorkingDay,
    freeIntervals,
    daySlots,
    expandedSlotIds,
    setCalendarState,
    openCreateSlot,
    openCreateSlotForInterval,
    handleDeleteSlot,
    canEditSlot,
    toggleSlotExpanded,
    calendarSelectedDateLabel,
    userEmail,
    handleRentalPayment,
    handleRentalStatus,
    handleDownloadAgreement,
    handleGenerateAgreement,
    handleUploadAgreement,
    handleCreateAgreement,
    memberEmail,
    setMemberEmail,
    memberRole,
    setMemberRole,
    memberCanBook,
    setMemberCanBook,
    memberError,
    addingMember,
    handleAddMember,
    updateMember,
    removeMember,
    settingsName,
    setSettingsName,
    settingsKind,
    setSettingsKind,
    settingsAddress,
    setSettingsAddress,
    settingsCapacity,
    setSettingsCapacity,
    settingsAvailability,
    settingsNotes,
    setSettingsNotes,
    settingsError,
    updatingPremise,
    deletingPremise,
    updateAvailabilityDay,
    handleSaveSettings,
    handleDeletePremise,
    slotModalOpen,
    setSlotModalOpen,
    editingSlot,
    slotForm,
    setSlotForm,
    bookingActors,
    bookingActorOptions,
    selectedBookingActorValue,
    slotError,
    creatingRental,
    updatingSlot,
    updateRentalScheduleDay,
    saveSlot,
  } = vm;

  if (!accessToken) {
    return (
      <div className="app-layout premises-layout">
        <div className="app-content">
          <main className="main-content main-content-premises">
            <div className="premises-view">
              <div className="rehearsals-muted">Нужно войти.</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (premiseLoading) {
    return <PageLoader label="Загрузка…" />;
  }

  if (premiseError || !premise) {
    return (
      <div className="app-layout premises-layout">
        <div className="app-content">
          <main className="main-content main-content-premises">
            <div className="premises-view">
              <div className="rehearsals-error">
                Помещение не найдено или нет доступа
              </div>
              <Link to={premisesPath} className="director-session-page__back">
                ← Все помещения
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout premises-layout">
      <div className="app-content">
        <main className="main-content main-content-premises">
          <div className="premises-view">
            <div className="rehearsals-page sessions-page">
              <div className="rehearsals-head premises-page__header">
                <div className="premises-page__header-main">
                  <div className="premises-page__title-row">
                    <span
                      className="premises-page__organization-logo"
                      aria-hidden
                    >
                      {getOrganizationInitials(premise.ownerTitle)}
                    </span>
                    <div className="rehearsals-meta">{premise.name}</div>
                    <span
                      className={cn(
                        "premises-page__kind",
                        premise.kind === "OWNED"
                          ? "premises-page__kind--owned"
                          : "premises-page__kind--rented",
                      )}
                    >
                      {premiseKindLabel(premise.kind)}
                    </span>
                  </div>
                  {premise.address ? (
                    <p className="rehearsals-muted premises-page__address">
                      <MapPinIcon />
                      <span>{premise.address}</span>
                    </p>
                  ) : null}
                  {premise.notes ? (
                    <p className="rehearsals-muted premises-page__subtitle">
                      {premise.notes}
                    </p>
                  ) : null}
                </div>
                <div className="premises-page__header-actions">
                  <Link
                    to={premisesPath}
                    className="director-session-page__back"
                  >
                    ← Все помещения
                  </Link>
                </div>
              </div>

              <div
                className="premises-tabs"
                role="tablist"
                aria-label="Разделы помещения"
              >
                {(
                  [
                    ["overview", "Обзор"],
                    ["schedule", "Расписание"],
                    ["rentals", "Аренды"],
                    ["members", "Участники"],
                    ["settings", "Настройки"],
                  ] as const
                ).map(([tab, label]) => {
                  if (
                    (tab === "members" || tab === "settings") &&
                    !premise.canManage
                  ) {
                    return null;
                  }
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      className={cn(
                        "premises-tabs__button",
                        isActive && "premises-tabs__button--active",
                      )}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab)}
                    >
                      {label}
                      {tab === "members" && membersData?.members.length
                        ? ` ${membersData.members.length}`
                        : null}
                    </button>
                  );
                })}
              </div>

              {activeTab === "overview" ? (
                <PremiseDetailOverviewTab
                  todaySlots={todaySlots}
                  pendingSlots={pendingSlots}
                  occupiedHours={occupiedHours}
                  occupiedDays={occupiedDays}
                  unpaidAmountRub={unpaidAmountRub}
                  hasTrackedSlots={hasTrackedSlots}
                  trackedSlotGroups={trackedSlotGroups}
                  memberProfileByEmail={memberProfileByEmail}
                  canManagePremise={canManagePremise}
                  rentalActionId={rentalActionId}
                  onOpenSlot={openEditSlot}
                  onBookingRequestReview={handleBookingRequestReview}
                />
              ) : null}

              {activeTab === "schedule" ? (
                <PremiseDetailScheduleTab
                  premiseId={premiseId}
                  canBook={premise.canBook}
                  canManagePremise={canManagePremise}
                  calendarSelectedDateLabel={calendarSelectedDateLabel}
                  slotsFetching={slotsFetching}
                  dots={dots}
                  selectedWorkingDay={selectedWorkingDay}
                  freeIntervals={freeIntervals}
                  daySlots={daySlots}
                  expandedSlotIds={expandedSlotIds as Set<string>}
                  memberProfileByEmail={memberProfileByEmail}
                  rentalActionId={rentalActionId}
                  onCalendarStateChange={setCalendarState}
                  onOpenCreateSlot={openCreateSlot}
                  onOpenCreateSlotForInterval={openCreateSlotForInterval}
                  onOpenEditSlot={openEditSlot}
                  onDeleteSlot={handleDeleteSlot}
                  canEditSlot={canEditSlot}
                  onToggleSlotExpanded={toggleSlotExpanded}
                  onBookingRequestReview={handleBookingRequestReview}
                />
              ) : null}

              {activeTab === "rentals" ? (
                <PremiseDetailRentalsTab
                  canBook={premise.canBook}
                  canManage={premise.canManage}
                  userEmail={userEmail}
                  rentals={rentalsData?.rentals ?? []}
                  memberProfileByEmail={memberProfileByEmail}
                  rentalActionId={rentalActionId}
                  rentalActionError={rentalActionError}
                  onOpenCreateSlot={openCreateSlot}
                  onRentalPayment={handleRentalPayment}
                  onRentalStatus={handleRentalStatus}
                  onDownloadAgreement={handleDownloadAgreement}
                  onGenerateAgreement={handleGenerateAgreement}
                  onUploadAgreement={handleUploadAgreement}
                  onCreateAgreement={handleCreateAgreement}
                />
              ) : null}

              {activeTab === "members" && premise.canManage ? (
                <PremiseDetailMembersTab
                  premiseId={premiseId}
                  members={membersData?.members ?? []}
                  memberProfileByEmail={memberProfileByEmail}
                  memberEmail={memberEmail}
                  memberRole={memberRole}
                  memberCanBook={memberCanBook}
                  memberError={memberError}
                  addingMember={addingMember}
                  onMemberEmailChange={setMemberEmail}
                  onMemberRoleChange={setMemberRole}
                  onMemberCanBookChange={setMemberCanBook}
                  onAddMember={handleAddMember}
                  onUpdateMember={updateMember}
                  onRemoveMember={removeMember}
                />
              ) : null}

              {activeTab === "settings" && premise.canManage ? (
                <PremiseDetailSettingsTab
                  settingsName={settingsName}
                  settingsKind={settingsKind}
                  settingsAddress={settingsAddress}
                  settingsCapacity={settingsCapacity}
                  settingsAvailability={settingsAvailability}
                  settingsNotes={settingsNotes}
                  settingsError={settingsError}
                  updatingPremise={updatingPremise}
                  deletingPremise={deletingPremise}
                  onSettingsNameChange={setSettingsName}
                  onSettingsKindChange={setSettingsKind}
                  onSettingsAddressChange={setSettingsAddress}
                  onSettingsCapacityChange={setSettingsCapacity}
                  onSettingsNotesChange={setSettingsNotes}
                  onUpdateAvailabilityDay={updateAvailabilityDay}
                  onSaveSettings={handleSaveSettings}
                  onDeletePremise={handleDeletePremise}
                />
              ) : null}
            </div>
          </div>
        </main>
      </div>

      <PremiseDetailSlotModal
        isOpen={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        editingSlot={editingSlot}
        canManagePremise={canManagePremise}
        slotForm={slotForm}
        setSlotForm={setSlotForm}
        bookingActors={bookingActors}
        bookingActorOptions={bookingActorOptions}
        selectedBookingActorValue={selectedBookingActorValue}
        slotError={slotError}
        creatingRental={creatingRental}
        updatingSlot={updatingSlot}
        onUpdateRentalScheduleDay={updateRentalScheduleDay}
        onSave={saveSlot}
      />
    </div>
  );
}
