import { Modal } from "../../../shared/core/modal/Modal";
import {
  useFormatPlayTextModal,
  type FormatPlayTextModalProps,
} from "../model/useFormatPlayTextModal";
import { FormatPlayTextLineEditSection } from "./FormatPlayTextLineEditSection";
import { FormatPlayTextMetaStatus } from "./FormatPlayTextMetaStatus";
import { FormatPlayTextModalActions } from "./FormatPlayTextModalActions";
import { FormatPlayTextPreviewSection } from "./FormatPlayTextPreviewSection";
import { FormatPlayTextRoleMarkersSection } from "./FormatPlayTextRoleMarkersSection";
import { FormatPlayTextSettingsSection } from "./FormatPlayTextSettingsSection";
import { FormatPlayTextSplitSection } from "./FormatPlayTextSplitSection";
import "./format-play-text-modal.css";

export type { FormatPlayTextModalProps };

export function FormatPlayTextModal(props: FormatPlayTextModalProps) {
  const vm = useFormatPlayTextModal(props);
  const editingLineNo = vm.editingLineNo;

  return (
    <Modal
      isOpen={vm.isOpen}
      onClose={vm.onClose}
      panelClassName="format-play-text-modal"
      ariaLabelledBy={vm.titleId}
    >
      <header className="format-play-text-modal__header">
        <h2 id={vm.titleId} className="format-play-text-modal__title">
          Отформатировать текст пьесы
        </h2>
        <p className="format-play-text-modal__subtitle">
          Роли — из «Действующие лица». Псевдонимы — отдельным тоглом. Правка строк — в превью.
        </p>
      </header>

      <div className="format-play-text-modal__body">
        <FormatPlayTextSettingsSection
          cleanOcr={vm.cleanOcr}
          setCleanOcr={vm.setCleanOcr}
          removeOcrNoise={vm.removeOcrNoise}
          setRemoveOcrNoise={vm.setRemoveOcrNoise}
          formatCastList={vm.formatCastList}
          setFormatCastList={vm.setFormatCastList}
          protectTitlePage={vm.protectTitlePage}
          setProtectTitlePage={vm.setProtectTitlePage}
          mergeBrokenLines={vm.mergeBrokenLines}
          setMergeBrokenLines={vm.setMergeBrokenLines}
          wrapRoleLabels={vm.wrapRoleLabels}
          setWrapRoleLabels={vm.setWrapRoleLabels}
          trimExtraSpaces={vm.trimExtraSpaces}
          setTrimExtraSpaces={vm.setTrimExtraSpaces}
          stripLabelDots={vm.stripLabelDots}
          setStripLabelDots={vm.setStripLabelDots}
        />

        <FormatPlayTextRoleMarkersSection
          markersFieldId={vm.markersFieldId}
          customRoleFieldId={vm.customRoleFieldId}
          useRoleMarkers={vm.useRoleMarkers}
          setUseRoleMarkers={vm.setUseRoleMarkers}
          useRoleAliases={vm.useRoleAliases}
          setUseRoleAliases={vm.setUseRoleAliases}
          castListDetected={vm.castListDetected}
          hasSourceText={vm.hasSourceText}
          roleEntries={vm.roleEntries}
          enabledRoleCount={vm.enabledRoleCount}
          aliasDrafts={vm.aliasDrafts}
          customRoleDraft={vm.customRoleDraft}
          setCustomRoleDraft={vm.setCustomRoleDraft}
          editingNameId={vm.editingNameId}
          nameEditDraft={vm.nameEditDraft}
          setNameEditDraft={vm.setNameEditDraft}
          refreshDetectedRoles={vm.refreshDetectedRoles}
          setAllRolesEnabled={vm.setAllRolesEnabled}
          toggleRoleEntry={vm.toggleRoleEntry}
          handleAliasChange={vm.handleAliasChange}
          handleAliasBlur={vm.handleAliasBlur}
          startNameEdit={vm.startNameEdit}
          cancelNameEdit={vm.cancelNameEdit}
          saveNameEdit={vm.saveNameEdit}
          addCustomRole={vm.addCustomRole}
        />

        <FormatPlayTextSplitSection
          splitIntoScenes={vm.splitIntoScenes}
          setSplitIntoScenes={vm.setSplitIntoScenes}
          sceneChunksCount={vm.sceneChunks.length}
        />

        <FormatPlayTextPreviewSection
          sourceText={vm.sourceText}
          displayPreviewText={vm.displayPreviewText}
          displayWarnings={vm.displayWarnings}
          editingLineNo={editingLineNo}
          previewWarningByLine={vm.previewWarningByLine}
          openLineEdit={vm.openLineEdit}
        />

        {editingLineNo !== null ? (
          <FormatPlayTextLineEditSection
            lineEditFieldId={vm.lineEditFieldId}
            editingLineNo={editingLineNo}
            lineEditDraft={vm.lineEditDraft}
            setLineEditDraft={vm.setLineEditDraft}
            saveLineEdit={vm.saveLineEdit}
            cancelLineEdit={vm.cancelLineEdit}
          />
        ) : null}

        <FormatPlayTextMetaStatus
          hasUnmatchedMarkers={vm.hasUnmatchedMarkers}
          unmatchedMarkers={vm.preview.stats.unmatchedMarkers}
          displayWarningsCount={vm.displayWarnings.length}
          warningsSummary={vm.warningsSummary}
          stats={vm.preview.stats}
          lineEditCount={vm.lineEditCount}
          useRoleMarkers={vm.useRoleMarkers}
          enabledRoleCount={vm.enabledRoleCount}
          splitBlocked={vm.splitBlocked}
          splitIntoScenes={vm.splitIntoScenes}
          sceneChunksCount={vm.sceneChunks.length}
          previewUnchanged={vm.previewUnchanged}
        />
      </div>

      <FormatPlayTextModalActions
        onClose={vm.onClose}
        canApply={vm.canApply}
        applyDisabledTitle={vm.applyDisabledTitle}
        onApply={vm.handleApply}
      />
    </Modal>
  );
}
