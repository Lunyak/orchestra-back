import { parseLightChannel } from "../show-script/utils/lightTokens";
import type { SceneLightFadersDataV1 } from "../../../features/scene/model/scene-slice";
import {
  effectiveSpotlightUiIntensity,
  getSpotlightsBoundToFader,
  readFaderLevel,
  readSpotlightBaseUiIntensity,
} from "../../../features/theater/model/theater-light-fader-bindings";
import type { LightConsoleViewProps } from "./light-console-data";
import "./light-console.css";

export function LightConsoleView({
  mode = "live",
  readOnly = false,
  lightChannels,
  selectedLightSlot,
  faders,
  programs,
  spotlights = [],
  consoleChannel,
  onSelectChannel,
  onSelectProgram,
  onFaderCountChange,
  onPatchFader,
  onSaveActiveProgram,
  className,
}: LightConsoleViewProps) {
  const activeProgram =
    programs.programs.find((program) => program.id === programs.activeProgramId) ??
    programs.programs[0];
  const faderMatchOptions = consoleChannel != null ? { consoleChannel } : undefined;
  const compact = mode === "compact";
  const disabled = readOnly || !onPatchFader;

  const getSpotlightsForFader = (fader: SceneLightFadersDataV1["faders"][number]) =>
    getSpotlightsBoundToFader(fader, spotlights, faderMatchOptions);

  return (
    <section
      className={["light-console", className].filter(Boolean).join(" ")}
      data-mode={mode}
      data-read-only={readOnly ? "true" : "false"}
      aria-label="Пульт света"
    >
      <div className="light-console__body">
        <div className="light-console__head">
        <div className="light-console__program-bar">
          {programs.programs.map((program) => {
            const channelRaw = lightChannels[program.id - 1] ?? "";
            const channelParsed = parseLightChannel(channelRaw);
            const channelHint = channelParsed.label
              ? `K${program.id} · ${channelParsed.label}`
              : `K${program.id}`;
            return (
              <button
                key={program.id}
                type="button"
                className="light-console__program"
                data-active={program.id === activeProgram?.id}
                title={`Программа ${program.id} — заливка (${channelHint})${program.label ? ` · ${program.label}` : ""}`}
                disabled={readOnly && program.id !== activeProgram?.id}
                onClick={() => onSelectProgram?.(program.id)}
              >
                {program.id}
              </button>
            );
          })}
          {!compact && mode === "live" && onFaderCountChange ? (
            <label className="light-console__fader-count">
              <span>F</span>
              <input
                type="number"
                min={1}
                max={64}
                value={faders.count ?? faders.faders.length}
                disabled={readOnly}
                onChange={(event) => onFaderCountChange(Number(event.target.value))}
              />
            </label>
          ) : null}
        </div>

        {!compact && mode === "live" && activeProgram && !readOnly ? (
          <div className="light-console__program-note">
            <p className="light-console__program-note-text">
              <strong>П{activeProgram.id}</strong> — пресет всего пульта (софиты + уровни). Нажали другую
              кнопку П… — подставляется её look. После правки ползунков состояние само пишется в эту
              программу (~1 с) или кнопкой ниже.
            </p>
            {onSaveActiveProgram ? (
              <button
                type="button"
                className="light-console__program-save-btn"
                onClick={onSaveActiveProgram}
              >
                Сохранить сейчас в П{activeProgram.id}
                {activeProgram.label?.trim() ? ` (${activeProgram.label.trim()})` : ""}
              </button>
            ) : null}
          </div>
        ) : null}
        </div>

        <div className="light-console__main">
          {!compact ? (
            <aside className="light-console__left">
              <div className="light-console__channels">
                {lightChannels.map((raw, index) => {
                  const channel = index + 1;
                  const parsed = parseLightChannel(raw);
                  const label = parsed.label || `Канал ${channel}`;
                  return (
                    <button
                      key={channel}
                      type="button"
                      className="light-console__channel"
                      data-active={selectedLightSlot === channel}
                      disabled={readOnly && selectedLightSlot !== channel}
                      onClick={() => onSelectChannel?.(channel)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}

          <div className="light-console__faders">
            {faders.faders.map((fader) => {
              const linkedSpotlight =
                (fader.spotlightId != null
                  ? spotlights.find((item) => item.id === fader.spotlightId)
                  : null) ?? getSpotlightsForFader(fader)[0];
              const faderLevel = readFaderLevel(fader);
              const muted = fader.enabled === false || faderLevel <= 0;
              const value = muted ? 0 : faderLevel;
              const baseLight =
                linkedSpotlight != null ? readSpotlightBaseUiIntensity(linkedSpotlight) : null;
              const outputLight =
                linkedSpotlight != null
                  ? effectiveSpotlightUiIntensity(linkedSpotlight, fader)
                  : null;
              const color = /^#[0-9a-f]{6}$/i.test(
                String(fader.color ?? linkedSpotlight?.color ?? "").trim(),
              )
                ? String(fader.color ?? linkedSpotlight?.color).trim()
                : "#ffffff";
              return (
                <div key={fader.id} className="light-console-fader">
                  <button
                    type="button"
                    className="light-console-fader__power"
                    data-active={!muted}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled || !onPatchFader) return;
                      const nextMuted = !muted;
                      const prevLevel =
                        typeof fader.intensity === "number" && fader.intensity > 0
                          ? fader.intensity
                          : 1;
                      onPatchFader(fader.id, {
                        enabled: !nextMuted,
                        intensity: nextMuted ? 0 : prevLevel,
                      });
                    }}
                    title={
                      muted
                        ? "Вернуть фейдер"
                        : outputLight != null && baseLight != null
                          ? `Фейдер 0% (свет софита ${baseLight.toFixed(1)})`
                          : "Фейдер в 0%"
                    }
                  />
                  <input
                    className="light-console-fader__range"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={value}
                    disabled={disabled}
                    onChange={(event) => {
                      const intensity = Number(event.target.value);
                      onPatchFader?.(fader.id, {
                        intensity,
                        enabled: intensity > 0,
                      });
                    }}
                  />
                  {!compact ? (
                    <input
                      className="light-console-fader__color"
                      type="color"
                      value={color}
                      disabled={disabled}
                      onChange={(event) => onPatchFader?.(fader.id, { color: event.target.value })}
                      title="Цвет фейдера"
                    />
                  ) : null}
                  <span
                    className="light-console-fader__value"
                    title={
                      outputLight != null && baseLight != null
                        ? `На сцене: ${outputLight.toFixed(1)} (${baseLight.toFixed(1)} × ${(value || 0).toFixed(2)})`
                        : undefined
                    }
                  >
                    {Math.round(value * 100)}
                  </span>
                  <span className="light-console-fader__name">{fader.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
