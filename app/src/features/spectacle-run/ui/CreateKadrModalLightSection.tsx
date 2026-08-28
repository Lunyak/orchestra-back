import cn from "classnames";
import {
  CustomSelect,
  type CustomSelectOption,
} from "../../../shared/core/custom-select/CustomSelect";
import type { CreateKadrFaderOption } from "../model/create-kadr-from-draft";

type CreateKadrModalLightSectionProps = {
  blackout: boolean;
  programId: number;
  programOptions: CustomSelectOption[];
  lightChannels: string[];
  recordChannels: number[];
  channelsLabel: string;
  faderOptions: CreateKadrFaderOption[];
  includedFaderKeys: string[];
  faderLevels: Record<string, number>;
  onToggleBlackout: () => void;
  onProgramChange: (value: string) => void;
  onToggleChannel: (channel: number) => void;
  onToggleFader: (key: string, defaultLevel: number) => void;
  onFaderLevelChange: (key: string, raw: number) => void;
};

export function CreateKadrModalLightSection({
  blackout,
  programId,
  programOptions,
  lightChannels,
  recordChannels,
  channelsLabel,
  faderOptions,
  includedFaderKeys,
  faderLevels,
  onToggleBlackout,
  onProgramChange,
  onToggleChannel,
  onToggleFader,
  onFaderLevelChange,
}: CreateKadrModalLightSectionProps) {
  return (
    <section className="create-kadr-modal__section">
      <h3 className="create-kadr-modal__section-title">Свет</h3>
      <label
        className={cn(
          "create-kadr-modal__check",
          "create-kadr-modal__check--blackout",
          blackout && "create-kadr-modal__check--active",
        )}
      >
        <input type="checkbox" checked={blackout} onChange={onToggleBlackout} />
        <span>Блекаут — свет выключен</span>
      </label>

      {!blackout ? (
        <>
          <label className="create-kadr-modal__field">
            <span className="create-kadr-modal__label">Программа</span>
            <CustomSelect
              value={String(programId)}
              options={programOptions}
              onChange={onProgramChange}
              searchable={false}
              className="create-kadr-modal__select"
              aria-label="Программа света"
            />
          </label>

          <div className="create-kadr-modal__channels">
            <span className="create-kadr-modal__label">Каналы K</span>
            <div className="create-kadr-modal__channel-grid">
              {lightChannels.map((_, index) => {
                const channel = index + 1;
                const active = recordChannels.includes(channel);
                return (
                  <button
                    key={channel}
                    type="button"
                    className={cn(
                      "create-kadr-modal__channel-btn",
                      active && "create-kadr-modal__channel-btn--active",
                    )}
                    aria-pressed={active}
                    onClick={() => onToggleChannel(channel)}
                  >
                    K{channel}
                  </button>
                );
              })}
            </div>
            <span className="create-kadr-modal__hint">
              {channelsLabel || "Каналы не выбраны"}
            </span>
          </div>

          {faderOptions.length > 0 ? (
            <div className="create-kadr-modal__faders">
              <span className="create-kadr-modal__label">Фейдеры F</span>
              <div className="create-kadr-modal__fader-grid">
                {faderOptions.map((item) => {
                  const checked = includedFaderKeys.includes(item.key);
                  const level = faderLevels[item.key] ?? 0;
                  const levelPct = Math.round(Math.min(1, Math.max(0, level)) * 100);
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        "create-kadr-modal__fader",
                        checked && "create-kadr-modal__fader--active",
                        !item.enabled && "create-kadr-modal__fader--dim",
                      )}
                    >
                      <label className="create-kadr-modal__fader-header">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleFader(item.key, item.intensity)}
                        />
                        <span className="create-kadr-modal__fader-label">{item.label}</span>
                        <span className="create-kadr-modal__fader-level">{levelPct}%</span>
                      </label>
                      {checked ? (
                        <input
                          className="create-kadr-modal__fader-slider"
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={levelPct}
                          onChange={(event) =>
                            onFaderLevelChange(item.key, Number(event.target.value) / 100)
                          }
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="create-kadr-modal__hint">
              Нет фейдеров на выбранных каналах — отметьте K или настройте софиты в 3D.
            </p>
          )}
        </>
      ) : (
        <p className="create-kadr-modal__hint">
          В прогоне картина будет помечена как блекаут.
        </p>
      )}
    </section>
  );
}
