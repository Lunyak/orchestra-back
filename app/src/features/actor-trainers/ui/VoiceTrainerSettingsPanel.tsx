import cn from "classnames";
import type { ReactNode } from "react";
import { CustomSelect } from "../../../shared/core/custom-select/CustomSelect";
import { normalizeActorKey } from "../../actor/model/actor-page-helpers";
import {
  VOICE_PASS_RATIO_OPTIONS,
  type PartnerVoiceSource,
  type VoicePassRatioPercent,
  type VoiceTrainerUiState,
} from "../model/voiceTrainerUiSlice";

function partnerSourceSelectValue(
  src: PartnerVoiceSource | undefined,
  actors: Array<{ id: string }>,
): string {
  if (src?.kind === "performer") {
    const id = normalizeActorKey(src.performerId);
    if (actors.some((a) => a.id === id)) return `p:${id}`;
  }
  return actors[0] ? `p:${actors[0].id}` : "";
}

type SelectOption = { value: string; label: string };

type PartnerRoleSelect = {
  roleKey: string;
  roleTitle: string;
  actors: Array<{ id: string; label: string }>;
  options: SelectOption[];
};

export type VoiceTrainerSettingsPanelProps = {
  className?: string;
  micError: string | null;
  micDeviceId: string;
  micSelectOptions: SelectOption[];
  micLabelsReady: boolean;
  onMicDeviceChange: (deviceId: string) => void;
  voiceName: string;
  voiceSelectOptions: SelectOption[];
  ttsEnabled: boolean;
  onVoiceNameChange: (value: string) => void;
  checkMode: string;
  checkModeOptions: SelectOption[];
  onCheckModeChange: (value: string) => void;
  passRatioPercent: VoicePassRatioPercent;
  passRatioOptions: SelectOption[];
  onPassRatioChange: (value: VoicePassRatioPercent) => void;
  autoFlow: boolean;
  onAutoFlowChange: (value: boolean) => void;
  recordTakes: boolean;
  onRecordTakesChange: (value: boolean) => void;
  partnerRoleSelectOptions: PartnerRoleSelect[];
  partnerVoiceByRoleKey: VoiceTrainerUiState["partnerVoiceByRoleKey"];
  onPartnerVoiceChange: (roleKey: string, performerId: string) => void;
  renderActorSelectPerson: (option: { value: string } | null) => ReactNode;
  showText: boolean;
  onShowTextChange: (value: boolean) => void;
  prevText: string;
  onSpeakPrev: () => void;
  storageKey?: string;
  onResetProgressCurrent: () => void;
  onResetProgressAll: () => void;
};

export function VoiceTrainerSettingsPanel({
  className,
  micError,
  micDeviceId,
  micSelectOptions,
  micLabelsReady,
  onMicDeviceChange,
  voiceName,
  voiceSelectOptions,
  ttsEnabled,
  onVoiceNameChange,
  checkMode,
  checkModeOptions,
  onCheckModeChange,
  passRatioPercent,
  passRatioOptions,
  onPassRatioChange,
  autoFlow,
  onAutoFlowChange,
  recordTakes,
  onRecordTakesChange,
  partnerRoleSelectOptions,
  partnerVoiceByRoleKey,
  onPartnerVoiceChange,
  renderActorSelectPerson,
  showText,
  onShowTextChange,
  prevText,
  onSpeakPrev,
  storageKey,
  onResetProgressCurrent,
  onResetProgressAll,
}: VoiceTrainerSettingsPanelProps) {
  return (
    <div className={cn("voice-controls", className)}>
      {micError ? <div className="voice-warn voice-warn--inline">{micError}</div> : null}
      <div className="voice-controls-selects">
        <div className="voice-select">
          <span className="voice-select-label">Микрофон</span>
          <CustomSelect
            value={micDeviceId}
            options={micSelectOptions}
            onChange={onMicDeviceChange}
            triggerClassName="voice-select-trigger"
            aria-label="Микрофон"
          />
          {!micLabelsReady ? (
            <span className="voice-select-hint">
              Разрешите доступ к микрофону, чтобы увидеть названия устройств.
            </span>
          ) : null}
        </div>
        <div className="voice-select">
          <span className="voice-select-label">Голос</span>
          <CustomSelect
            value={voiceName}
            options={voiceSelectOptions}
            onChange={onVoiceNameChange}
            disabled={!ttsEnabled}
            triggerClassName="voice-select-trigger"
            aria-label="Голос"
          />
        </div>
        <div className="voice-select">
          <span className="voice-select-label">Проверка</span>
          <CustomSelect
            value={checkMode}
            options={checkModeOptions}
            onChange={onCheckModeChange}
            triggerClassName="voice-select-trigger"
            aria-label="Режим проверки"
          />
        </div>
        <div className="voice-select">
          <span className="voice-select-label">Порог зачёта</span>
          <CustomSelect
            value={String(passRatioPercent)}
            options={passRatioOptions}
            onChange={(next) => {
              const parsed = Number(next);
              if (!VOICE_PASS_RATIO_OPTIONS.includes(parsed as VoicePassRatioPercent)) return;
              onPassRatioChange(parsed as VoicePassRatioPercent);
            }}
            triggerClassName="voice-select-trigger"
            aria-label="Минимальная точность для зачёта"
          />
        </div>
        <label className="voice-checkbox">
          <input
            type="checkbox"
            checked={autoFlow}
            onChange={(e) => onAutoFlowChange(e.target.checked)}
          />
          авто (переход)
        </label>
        <label
          className="voice-checkbox"
          title="Параллельно распознаванию речи будет записываться аудио вашей реплики (для сохранения)"
        >
          <input
            type="checkbox"
            checked={recordTakes}
            onChange={(e) => onRecordTakesChange(e.target.checked)}
          />
          сохранять дубль
        </label>
      </div>
      {partnerRoleSelectOptions.length > 0 ? (
        <div className="voice-controls-roles">
          <div className="voice-controls-roles-title">Озвучка ролей</div>
          <div className="voice-controls-roles-grid">
            {partnerRoleSelectOptions.map(({ roleKey, roleTitle, actors, options }) => (
              <div
                key={roleKey}
                className="voice-select voice-select--role"
                title="Актёр, чей дубль слушать для этой роли"
              >
                <span className="voice-select-label">{roleTitle}</span>
                {actors.length > 0 ? (
                  <CustomSelect
                    value={partnerSourceSelectValue(partnerVoiceByRoleKey?.[roleKey], actors)}
                    options={options}
                    renderValue={(option) => renderActorSelectPerson(option)}
                    renderOption={(option) => renderActorSelectPerson(option)}
                    onChange={(v) => {
                      if (!v.startsWith("p:")) return;
                      const pid = normalizeActorKey(v.slice(2));
                      if (!pid) return;
                      onPartnerVoiceChange(roleKey, pid);
                    }}
                    triggerClassName="voice-select-trigger voice-select-trigger--person"
                    optionClassName="custom-select__option--person"
                    aria-label={`Актёр для роли ${roleTitle}`}
                  />
                ) : (
                  <div className="voice-select-empty">Нет актёров на роли</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="voice-controls-actions voice-actions">
        <button
          type="button"
          className="voice-btn"
          disabled={!prevText}
          onClick={onSpeakPrev}
          title="Озвучить предыдущую реплику"
        >
          Озвучить предыдущую
        </button>
        <button
          type="button"
          className={cn("voice-btn", showText && "voice-btn--primary")}
          onClick={() => onShowTextChange(!showText)}
          title="Режим показа текста во всём тренажёре"
        >
          {showText ? "Текст: показан" : "Текст: скрыт"}
        </button>
        {storageKey ? (
          <>
            <button
              type="button"
              className="voice-btn"
              onClick={onResetProgressCurrent}
              title="Сбросить текущую реплику"
            >
              Сбросить текущую
            </button>
            <button
              type="button"
              className="voice-btn"
              onClick={onResetProgressAll}
              title="Сбросить весь прогресс"
            >
              Сбросить прогресс
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
