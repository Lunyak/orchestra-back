import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import cn from "classnames";
import type { PremiseKind } from "../../../sync/api/premises";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import {
  minutesToTime,
  timeToMinutes,
} from "../model/premise-detail-helpers";
import { premiseKindOptions } from "../model/premise-detail-options";
import type { AvailabilityFormDay } from "../model/premise-detail-types";

export type PremiseDetailSettingsTabProps = {
  settingsName: string;
  settingsKind: PremiseKind;
  settingsAddress: string;
  settingsCapacity: string;
  settingsAvailability: AvailabilityFormDay[];
  settingsNotes: string;
  settingsError: string | null;
  updatingPremise: boolean;
  deletingPremise: boolean;
  onSettingsNameChange: (value: string) => void;
  onSettingsKindChange: (value: PremiseKind) => void;
  onSettingsAddressChange: (value: string) => void;
  onSettingsCapacityChange: (value: string) => void;
  onSettingsNotesChange: (value: string) => void;
  onUpdateAvailabilityDay: (
    weekday: number,
    patch: Partial<
      Pick<AvailabilityFormDay, "enabled" | "startsAtMin" | "endsAtMin">
    >,
  ) => void;
  onSaveSettings: () => void;
  onDeletePremise: () => void;
};

export function PremiseDetailSettingsTab({
  settingsName,
  settingsKind,
  settingsAddress,
  settingsCapacity,
  settingsAvailability,
  settingsNotes,
  settingsError,
  updatingPremise,
  deletingPremise,
  onSettingsNameChange,
  onSettingsKindChange,
  onSettingsAddressChange,
  onSettingsCapacityChange,
  onSettingsNotesChange,
  onUpdateAvailabilityDay,
  onSaveSettings,
  onDeletePremise,
}: PremiseDetailSettingsTabProps) {
  return (
    <div className="premises-settings">
      <RehearsalsCard fluid className="premises-settings__main">
        <div className="rehearsals-card-title">Основные данные</div>
        <div className="premises-settings__form">
          <label className="premises-settings__field premises-settings__field--wide">
            <span>Название</span>
            <InlineTextField
              value={settingsName}
              onChange={(e) => onSettingsNameChange(e.target.value)}
              maxLength={120}
              aria-label="Название помещения"
            />
          </label>
          <label className="premises-settings__field premises-settings__field--wide">
            <span>Тип помещения</span>
            <CustomSelect
              value={settingsKind}
              options={premiseKindOptions}
              onChange={(value) => onSettingsKindChange(value as PremiseKind)}
              aria-label="Тип помещения"
            />
          </label>
          <label className="premises-settings__field premises-settings__field--wide">
            <span>Адрес</span>
            <InlineTextField
              value={settingsAddress}
              onChange={(e) => onSettingsAddressChange(e.target.value)}
              maxLength={300}
              aria-label="Адрес помещения"
            />
          </label>
          <label className="premises-settings__field premises-settings__field--wide">
            <span>Вместимость</span>
            <InlineTextField
              value={settingsCapacity}
              onChange={(e) => onSettingsCapacityChange(e.target.value)}
              inputMode="numeric"
              aria-label="Вместимость помещения"
            />
          </label>
          <div className="premises-availability-settings">
            <div className="premises-availability-settings__header">
              <strong>Рабочее время</strong>
              <span className="rehearsals-muted">
                По нему рассчитываются свободные интервалы
              </span>
            </div>
            <div className="premises-availability-settings__days">
              {settingsAvailability.map((day) => (
                <div
                  key={day.weekday}
                  className={cn(
                    "premises-availability-day",
                    !day.enabled && "premises-availability-day--disabled",
                  )}
                >
                  <LabeledCheckbox
                    className="premises-availability-day__toggle"
                    checked={day.enabled}
                    onChange={(checked) =>
                      onUpdateAvailabilityDay(day.weekday, {
                        enabled: checked,
                      })
                    }
                  >
                    {day.label}
                  </LabeledCheckbox>
                  {day.enabled ? (
                    <div className="premises-availability-day__time">
                      <InlineTextField
                        className="premises-availability-day__time-input"
                        type="time"
                        value={minutesToTime(day.startsAtMin)}
                        onChange={(event) =>
                          onUpdateAvailabilityDay(day.weekday, {
                            startsAtMin: timeToMinutes(event.target.value),
                          })
                        }
                        aria-label={`Начало работы, ${day.label}`}
                      />
                      <span className="premises-availability-day__time-sep">
                        —
                      </span>
                      <InlineTextField
                        className="premises-availability-day__time-input"
                        type="time"
                        value={minutesToTime(day.endsAtMin)}
                        onChange={(event) =>
                          onUpdateAvailabilityDay(day.weekday, {
                            endsAtMin: timeToMinutes(event.target.value),
                          })
                        }
                        aria-label={`Окончание работы, ${day.label}`}
                      />
                    </div>
                  ) : (
                    <span className="rehearsals-muted">Выходной</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <FormTextarea
            label="Заметки"
            value={settingsNotes}
            onChange={(e) => onSettingsNotesChange(e.target.value)}
            rows={4}
          />
          {settingsError ? (
            <div className="rehearsals-error">{settingsError}</div>
          ) : null}
        </div>
      </RehearsalsCard>
      <RehearsalsCard fluid className="premises-settings__danger">
        <div className="rehearsals-card-title">Удаление помещения</div>
        <p className="rehearsals-muted">
          Удаление необратимо. Будут удалены расписание, настройки и права
          участников помещения.
        </p>
        <Button
          type="button"
          className="danger"
          disabled={deletingPremise}
          onClick={() => void onDeletePremise()}
        >
          {deletingPremise ? "Удаление…" : "Удалить помещение"}
        </Button>
      </RehearsalsCard>
      <div className="premises-settings__footer">
        <Button
          type="button"
          disabled={updatingPremise || !settingsName.trim()}
          onClick={() => void onSaveSettings()}
        >
          {updatingPremise ? "Сохранение…" : "Сохранить ✓"}
        </Button>
      </div>
    </div>
  );
}
