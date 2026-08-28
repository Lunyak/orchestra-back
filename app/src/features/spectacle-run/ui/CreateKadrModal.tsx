import { Modal } from "../../../shared/core/modal/Modal";
import {
  useCreateKadrModal,
  type CreateKadrModalProps,
} from "../model/useCreateKadrModal";
import { CreateKadrModalSoundSection } from "./CreateKadrModalSoundSection";
import { CreateKadrModalProjectorSection } from "./CreateKadrModalProjectorSection";
import { CreateKadrModalLightSection } from "./CreateKadrModalLightSection";
import { CreateKadrModalMetaSections } from "./CreateKadrModalMetaSections";
import { CreateKadrModalImageSection } from "./CreateKadrModalImageSection";
import { CreateKadrRequisitesSection } from "./CreateKadrRequisitesSection";
import "@shared/components/create-kadr-modal/create-kadr-modal.css";

export type { CreateKadrModalProps };

export function CreateKadrModal(props: CreateKadrModalProps) {
  const vm = useCreateKadrModal(props);

  return (
    <Modal
      isOpen={vm.isOpen}
      onClose={vm.onClose}
      panelClassName="create-kadr-modal"
      ariaLabel={vm.modalTitle}
    >
      <header className="create-kadr-modal__header">
        <h2 className="create-kadr-modal__title" id="create-kadr-modal-title">
          {vm.modalTitle}
        </h2>
        <button type="button" className="create-kadr-modal__close" onClick={vm.onClose}>
          ×
        </button>
      </header>

      <div className="create-kadr-modal__body">
        <label className="create-kadr-modal__field">
          <span className="create-kadr-modal__label">Название</span>
          <input
            type="text"
            className="create-kadr-modal__input"
            value={vm.draft.title}
            placeholder="Необязательно"
            onChange={(e) => vm.setTitle(e.target.value)}
          />
        </label>

        <CreateKadrModalSoundSection
          playTrackId={vm.draft.playTrackId}
          playlistLength={vm.playlist.length}
          playlistOptions={vm.playlistOptions}
          sounds={vm.sounds}
          soundIds={vm.draft.soundIds}
          onPlayTrackChange={vm.setPlayTrackId}
          onToggleSound={vm.toggleSound}
        />

        <CreateKadrModalProjectorSection
          projectorCtx={vm.projectorCtx}
          projectorValue={vm.projectorValue}
          projectorOptions={vm.projectorOptions}
          isProjectorVideo={vm.isProjectorVideo}
          projectorVideoMuted={vm.projectorVideoMuted}
          projectorPreviewMode={vm.projectorPreviewMode}
          projectorPreviewVideoId={vm.projectorPreviewVideoId}
          projectorPreviewHoldId={vm.projectorPreviewHoldId}
          projectorPreviewTitle={vm.projectorPreviewTitle}
          onProjectorChange={vm.setProjectorCue}
          onToggleMuted={vm.toggleProjectorMuted}
        />

        <CreateKadrModalLightSection
          blackout={vm.draft.blackout}
          programId={vm.draft.programId}
          programOptions={vm.programOptions}
          lightChannels={vm.lightChannels}
          recordChannels={vm.draft.recordChannels}
          channelsLabel={vm.channelsLabel}
          faderOptions={vm.faderOptions}
          includedFaderKeys={vm.draft.includedFaderKeys}
          faderLevels={vm.draft.faderLevels}
          onToggleBlackout={vm.toggleBlackout}
          onProgramChange={vm.setProgramId}
          onToggleChannel={vm.toggleChannel}
          onToggleFader={vm.toggleFader}
          onFaderLevelChange={vm.setFaderLevel}
        />

        <CreateKadrModalMetaSections
          commentText={vm.draft.commentText}
          transitionText={vm.draft.transitionText}
          blackoutDurationSec={vm.draft.blackoutDurationSec}
          smokeDurationSec={vm.draft.smokeDurationSec}
          onCommentChange={vm.setCommentText}
          onTransitionChange={vm.setTransitionText}
          onToggleBlackoutDuration={vm.toggleBlackoutDuration}
          onToggleSmokeDuration={vm.toggleSmokeDuration}
          onBlackoutDurationChange={vm.setBlackoutDurationSec}
          onSmokeDurationChange={vm.setSmokeDurationSec}
        />

        <CreateKadrModalImageSection
          imageInputRef={vm.imageInputRef}
          imageBusy={vm.imageBusy}
          imageError={vm.imageError}
          imagePreviewUrl={vm.imagePreviewUrl}
          imageMarkdown={vm.draft.imageMarkdown}
          onPasteImage={vm.handlePasteImage}
          onImageFile={vm.handleImageFile}
        />

        <CreateKadrRequisitesSection
          sceneRequisites={vm.sceneRequisites}
          onSceneRequisitesChange={vm.handleSceneRequisitesChange}
          draftCues={vm.draft.requisites}
          onToggleCue={vm.toggleRequisiteCue}
          onCueActionChange={vm.setRequisiteAction}
          assigneeOptions={vm.assigneeOptions}
          accessToken={vm.accessToken}
          projectSlug={vm.projectName}
        />
      </div>

      <footer className="create-kadr-modal__foot">
        <button type="button" className="create-kadr-modal__btn" onClick={vm.onClose}>
          Отмена
        </button>
        <button
          type="button"
          className="create-kadr-modal__btn create-kadr-modal__btn--primary"
          onClick={vm.handleSubmit}
        >
          {vm.submitLabel}
        </button>
      </footer>
    </Modal>
  );
}
