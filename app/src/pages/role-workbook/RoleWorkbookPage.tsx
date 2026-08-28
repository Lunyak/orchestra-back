import cn from "classnames";
import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import { useRoleWorkbookPage } from "../../features/role-workbook/model/useRoleWorkbookPage";
import { RoleWorkbookActorWorkbook } from "../../features/role-workbook/ui/RoleWorkbookActorWorkbook";
import { RoleWorkbookHeader } from "../../features/role-workbook/ui/RoleWorkbookHeader";
import { RoleWorkbookOverview } from "../../features/role-workbook/ui/RoleWorkbookOverview";
import "./style.css";

export function RoleWorkbookPage() {
  const vm = useRoleWorkbookPage();

  if (!vm.accessToken) {
    return <div className="rolewb-page__message">Нужно войти, чтобы открыть страницу роли.</div>;
  }
  if (!vm.projectSlug) {
    return <div className="rolewb-page__message">Не выбран проект.</div>;
  }
  if (!vm.effectiveRoleId) {
    return <div className="rolewb-page__message">Роль не указана.</div>;
  }
  if (vm.pageBooting) {
    return <PageBootLoader label="Загрузка тетрадки роли…" />;
  }

  const {
    actorImages,
    actorFileInputRef,
    directorFileInputRef,
    directorRefsSectionRef,
    uploadActorImages,
    uploadDirectorImages,
    uploadReferenceImages,
    onReferenceRefsPaste,
    canAddReferenceImages,
    referenceUploading,
    referenceAuthorLabel,
    combinedReferenceImages,
    referenceColumns,
    directorRefsError,
    urlCacheRef,
    ensureImageUrl,
    lightboxIdx,
    setLightboxIdx,
    actorLightboxIdx,
    setActorLightboxIdx,
    imageFilesFromTransfer,
    urlTick,
  } = vm.referenceImages;

  return (
    <div className={cn("app-layout", "rolewb-layout")}>
      <div className="app-content">
        <main className="main-content">
          <div className={cn("rolewb-page", "rolewb-view")} onBlurCapture={vm.onBlurSave}>
            <RoleWorkbookHeader
              isActorWorkbookOpen={vm.isActorWorkbookOpen}
              activeWorkbookSection={vm.activeWorkbookSection}
              projectSlug={vm.projectSlug}
              roleDisplayTitle={String(vm.roleDisplayTitle)}
              selectedActorLabel={vm.selectedActorLabel}
              canEdit={vm.canEdit}
              onCloseActorWorkbook={vm.closeActorWorkbook}
              onCloseWorkbookSection={vm.closeWorkbookSection}
              onGoToProfile={vm.goToProfile}
            />

            <div className="rolewb-grid">
              {!vm.isActorWorkbookOpen ? (
                <RoleWorkbookOverview
                  accessToken={vm.accessToken}
                  remoteProjectId={vm.remoteProjectId}
                  roleInfo={vm.roleInfo}
                  roleLabel={vm.roleLabel}
                  canEditRoleAvatar={vm.canEditRoleAvatar}
                  updatingRoleAvatar={vm.updatingRoleAvatar}
                  onSaveAvatarKey={vm.saveRoleAvatarKey}
                  canViewActorWorkbook={vm.canViewActorWorkbook}
                  visibleActorTiles={vm.visibleActorTiles}
                  snapshotsByActorEmail={vm.snapshotsByActorEmail}
                  profilesByEmail={vm.profilesByEmail}
                  onOpenActorWorkbook={vm.openActorWorkbook}
                  error={vm.error}
                  deleteError={vm.deleteError}
                  canDeleteRole={vm.canDeleteRole}
                  deletingRole={vm.deletingRole}
                  onDeleteRole={() => void vm.deleteRole()}
                />
              ) : null}

              {vm.isActorWorkbookOpen && vm.canViewActorWorkbook ? (
                <RoleWorkbookActorWorkbook
                  accessToken={vm.accessToken}
                  effectiveRoleId={vm.effectiveRoleId}
                  roleLabel={vm.roleLabel}
                  roleDisplayTitle={String(vm.roleDisplayTitle)}
                  activeWorkbookSection={vm.activeWorkbookSection}
                  setActiveWorkbookSection={vm.setActiveWorkbookSection}
                  canEdit={vm.canEdit}
                  draft={vm.draft}
                  projectRoles={vm.projectRoles}
                  inboundMentions={vm.inboundMentions}
                  profilesByEmail={vm.profilesByEmail}
                  sceneArcsForView={vm.sceneArcsForView}
                  sceneOptionsForQuestions={vm.sceneOptionsForQuestions}
                  desiredSceneArcsCount={vm.desiredSceneArcsCount}
                  isDirectorView={vm.isDirectorView}
                  saving={vm.saving}
                  snapshotUpdatedAt={vm.snapshotUpdatedAt}
                  lastSavedAtIso={vm.lastSavedAtIso}
                  error={vm.error}
                  onDraftFieldChange={vm.onDraftFieldChange}
                  onChangeRelationshipEntries={vm.onChangeRelationshipEntries}
                  onChangeDirectorQuestions={vm.onChangeDirectorQuestions}
                  onChangeSceneArcText={vm.setSceneArcText}
                  referenceImagesProps={{
                    canEdit: vm.canEdit,
                    canEditDirectorRefs: vm.canEditDirectorRefs,
                    canAddReferenceImages,
                    referenceAuthorLabel,
                    referenceUploading,
                    directorRefsError,
                    combinedReferenceImages,
                    referenceColumns,
                    actorImages,
                    directorImages: vm.directorImages,
                    actorFileInputRef,
                    directorFileInputRef,
                    directorRefsSectionRef,
                    urlCacheRef,
                    ensureImageUrl,
                    uploadActorImages,
                    uploadDirectorImages,
                    uploadReferenceImages,
                    onReferenceRefsPaste,
                    imageFilesFromTransfer,
                    lightboxIdx,
                    setLightboxIdx,
                    actorLightboxIdx,
                    setActorLightboxIdx,
                    onRemoveActorImage: vm.removeActorRefImage,
                    onRemoveDirectorImage: vm.removeDirectorRefImage,
                    urlTick,
                  }}
                />
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
