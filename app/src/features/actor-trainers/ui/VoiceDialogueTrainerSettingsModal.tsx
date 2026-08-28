import { Modal } from "../../../shared/core/modal/Modal";
import {
  VoiceTrainerSettingsPanel,
  type VoiceTrainerSettingsPanelProps,
} from "./VoiceTrainerSettingsPanel";

export type VoiceDialogueTrainerSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  settingsPanelProps: Omit<VoiceTrainerSettingsPanelProps, "className">;
};

export function VoiceDialogueTrainerSettingsModal({
  isOpen,
  onClose,
  settingsPanelProps,
}: VoiceDialogueTrainerSettingsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="voice-settings-modal"
      ariaLabel="Настройки голосового тренажёра"
    >
      <div className="voice-settings-modal__header">
        <div>
          <div className="voice-settings-modal__label">Настройки</div>
          <div className="voice-settings-modal__title">Голосовой тренажёр</div>
        </div>
      </div>
      <VoiceTrainerSettingsPanel {...settingsPanelProps} className="voice-controls--modal" />
    </Modal>
  );
}
