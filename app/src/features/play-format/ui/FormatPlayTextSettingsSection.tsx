import { LabeledToggle } from "../../../shared/core/labeled-toggle/LabeledToggle";

export type FormatPlayTextSettingsSectionProps = {
  cleanOcr: boolean;
  setCleanOcr: (value: boolean) => void;
  removeOcrNoise: boolean;
  setRemoveOcrNoise: (value: boolean) => void;
  formatCastList: boolean;
  setFormatCastList: (value: boolean) => void;
  protectTitlePage: boolean;
  setProtectTitlePage: (value: boolean) => void;
  mergeBrokenLines: boolean;
  setMergeBrokenLines: (value: boolean) => void;
  wrapRoleLabels: boolean;
  setWrapRoleLabels: (value: boolean) => void;
  trimExtraSpaces: boolean;
  setTrimExtraSpaces: (value: boolean) => void;
  stripLabelDots: boolean;
  setStripLabelDots: (value: boolean) => void;
};

export function FormatPlayTextSettingsSection({
  cleanOcr,
  setCleanOcr,
  removeOcrNoise,
  setRemoveOcrNoise,
  formatCastList,
  setFormatCastList,
  protectTitlePage,
  setProtectTitlePage,
  mergeBrokenLines,
  setMergeBrokenLines,
  wrapRoleLabels,
  setWrapRoleLabels,
  trimExtraSpaces,
  setTrimExtraSpaces,
  stripLabelDots,
  setStripLabelDots,
}: FormatPlayTextSettingsSectionProps) {
  return (
    <details className="format-play-text-modal__settings">
      <summary className="format-play-text-modal__settings-summary">
        Настройки форматирования
      </summary>
      <div className="format-play-text-modal__options format-play-text-modal__options--compact">
        <LabeledToggle checked={cleanOcr} onChange={setCleanOcr}>
          Почистить OCR (склеить «З о т и к о в и ч»)
        </LabeledToggle>
        <LabeledToggle
          checked={removeOcrNoise}
          disabled={!cleanOcr}
          onChange={setRemoveOcrNoise}
        >
          Убрать служебные строки (FB2, OCR, библиография)
        </LabeledToggle>
        <LabeledToggle checked={formatCastList} onChange={setFormatCastList}>
          Форматировать «Действующие лица»
        </LabeledToggle>
        <LabeledToggle checked={protectTitlePage} onChange={setProtectTitlePage}>
          Не трогать титул (до списка персонажей / первого акта)
        </LabeledToggle>
        <LabeledToggle checked={mergeBrokenLines} onChange={setMergeBrokenLines}>
          Склеить разорванные строки
        </LabeledToggle>
        <LabeledToggle checked={wrapRoleLabels} onChange={setWrapRoleLabels}>
          Лейблы в начале строки (ЕЛЕНА: …)
        </LabeledToggle>
        <LabeledToggle checked={trimExtraSpaces} onChange={setTrimExtraSpaces}>
          Убрать лишние пробелы в строках
        </LabeledToggle>
        <LabeledToggle checked={stripLabelDots} onChange={setStripLabelDots}>
          Убрать точки после лейблов
        </LabeledToggle>
      </div>
    </details>
  );
}
