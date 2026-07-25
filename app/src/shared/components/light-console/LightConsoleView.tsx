import type { CSSProperties } from "react";
import { parseLightChannel } from "../show-script/utils/lightTokens";
import type { PlaybookLightFadersDataV1 } from "../../../features/playbook/model/playbook-slice";
import {
  effectiveSpotlightUiIntensity,
  faderHasEquipmentOnChannel,
  getSpotlightsBoundToFader,
  readFaderLevel,
  readSpotlightBaseUiIntensity,
} from "../../../features/theater/model/theater-light-fader-bindings";
import faderThumbUrl from "./assets/fader-thumb.png";
import {
  clampLightChannelColumns,
  DEFAULT_LIGHT_CHANNEL_COLUMNS,
} from "./light-channels-mutate";
import type { LightConsoleViewProps } from "./light-console-data";
import {
  formatChannelDefaultLabel,
  formatChannelShort,
  formatFaderDefaultLabel,
  formatProgramShort,
} from "./light-console-labels";
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
  channelColumns,
  onSelectChannel,
  onSelectProgram,
  onPatchFader,
  onSaveActiveProgram,
  onOpenSettings,
  className,
}: LightConsoleViewProps) {
  const activeProgram =
    programs.programs.find((program) => program.id === programs.activeProgramId) ??
    programs.programs[0];
  const faderMatchOptions = consoleChannel != null ? { consoleChannel } : undefined;
  const compact = mode === "compact";
  const disabled = readOnly || !onPatchFader;
  const resolvedChannelColumns = clampLightChannelColumns(
    Number(channelColumns),
    DEFAULT_LIGHT_CHANNEL_COLUMNS,
  );
  const consoleStyle = {
    "--light-channel-columns": String(resolvedChannelColumns),
  } as CSSProperties;

  const getSpotlightsForFader = (fader: PlaybookLightFadersDataV1["faders"][number]) =>
    getSpotlightsBoundToFader(fader, spotlights, faderMatchOptions);

  return (
    <section
      className={["light-console", className].filter(Boolean).join(" ")}
      data-mode={mode}
      data-read-only={readOnly ? "true" : "false"}
      aria-label="Пульт света"
      style={consoleStyle}
    >
      <div className="light-console__body">
        <div className="light-console__header">
        <div className="light-console__program-bar">
          {programs.programs.map((program) => (
              <button
                key={program.id}
                type="button"
                className="light-console__program"
                data-active={program.id === activeProgram?.id}
                title={`${formatProgramShort(program.id)} — пресет заливки${program.label ? ` · ${program.label}` : ""}`}
                disabled={readOnly && program.id !== activeProgram?.id}
                onClick={() => onSelectProgram?.(program.id)}
              >
                {formatProgramShort(program.id)}
              </button>
          ))}
        </div>

        {!compact && mode === "live" && activeProgram && !readOnly ? (
          <div className="light-console__program-note">
            {onSaveActiveProgram ? (
              <button
                type="button"
                className="light-console__program-save-btn"
                onClick={onSaveActiveProgram}
                title={`Сохранить пресет П${activeProgram.id}${activeProgram.label?.trim() ? ` (${activeProgram.label.trim()})` : ""}`}
              >
                Save
              </button>
            ) : null}
          </div>
        ) : null}

        {!compact && mode === "live" && !readOnly && onOpenSettings ? (
          <button
            type="button"
            className="light-console__settings-btn"
            onClick={onOpenSettings}
            title="Настройка пульта"
            aria-label="Настройка пульта"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </button>
        ) : null}
        </div>

        <div className="light-console__main">
          {!compact ? (
            <aside className="light-console__left">
              <div className="light-console__channels">
                {lightChannels.map((raw, index) => {
                  const channel = index + 1;
                  const parsed = parseLightChannel(raw);
                  const channelHint = formatChannelDefaultLabel(channel, parsed.label);
                  return (
                    <button
                      key={channel}
                      type="button"
                      className="light-console__channel"
                      data-active={selectedLightSlot === channel}
                      disabled={readOnly && selectedLightSlot !== channel}
                      title={`${channelHint} — свои уровни F1–F${faders.count ?? faders.faders.length} для этого канала`}
                      onClick={() => onSelectChannel?.(channel)}
                    >
                      {formatChannelShort(channel)}
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}

          <div className="light-console__faders">
            {faders.faders.map((fader) => {
              const linkedSpotlight = getSpotlightsForFader(fader)[0];
              const hasEquipment =
                consoleChannel != null
                  ? faderHasEquipmentOnChannel(fader, consoleChannel, spotlights, faders) ||
                    getSpotlightsForFader(fader).length > 0
                  : getSpotlightsBoundToFader(fader, spotlights).length > 0;
              const inactive = !hasEquipment;
              const faderLevel = readFaderLevel(fader);
              const muted = fader.enabled === false || faderLevel <= 0;
              const displayOff = muted || inactive;
              const value = displayOff ? 0 : faderLevel;
              const faderDisabled = disabled || inactive;
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
              const inactiveTitle =
                consoleChannel != null
                  ? `F${fader.id} на K${consoleChannel}: нет софита или RGB`
                  : `F${fader.id}: нет софита или RGB`;
              return (
                <div
                  key={fader.id}
                  className="light-console-fader"
                  data-inactive={inactive ? "true" : "false"}
                >
                  <button
                    type="button"
                    className="light-console-fader__power"
                    data-active={!displayOff}
                    disabled={faderDisabled}
                    onClick={() => {
                      if (faderDisabled || !onPatchFader) return;
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
                      inactive
                        ? inactiveTitle
                        : muted
                          ? "Вернуть фейдер"
                          : outputLight != null && baseLight != null
                            ? `F${fader.id} в 0% (свет софита ${baseLight.toFixed(1)})`
                            : `F${fader.id} в 0%`
                    }
                  />
                  <div
                    className="light-console-fader__range-wrap"
                    style={
                      {
                        "--light-fader-thumb-t": String(value),
                        "--light-fader-thumb-image": `url(${faderThumbUrl})`,
                      } as CSSProperties
                    }
                  >
                    <span className="light-console-fader__thumb" aria-hidden />
                    <input
                      className="light-console-fader__range"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={value}
                      disabled={faderDisabled}
                      style={
                        {
                          "--light-fader-fill-pct": `${Math.round(value * 100)}%`,
                        } as CSSProperties
                      }
                      onChange={(event) => {
                        if (faderDisabled) return;
                        const intensity = Number(event.target.value);
                        onPatchFader?.(fader.id, {
                          intensity,
                          enabled: intensity > 0,
                        });
                      }}
                    />
                  </div>
                  {!compact ? (
                    <input
                      className="light-console-fader__color"
                      type="color"
                      value={color}
                      disabled={faderDisabled}
                      onChange={(event) => onPatchFader?.(fader.id, { color: event.target.value })}
                      title={inactive ? inactiveTitle : "Цвет фейдера"}
                    />
                  ) : null}
                  <span
                    className="light-console-fader__value"
                    title={
                      inactive
                        ? inactiveTitle
                        : outputLight != null && baseLight != null
                          ? `На сцене: ${outputLight.toFixed(1)} (${baseLight.toFixed(1)} × ${(value || 0).toFixed(2)})`
                          : undefined
                    }
                  >
                    {Math.round(value * 100)}
                  </span>
                  <span className="light-console-fader__name">
                    {formatFaderDefaultLabel(fader.id, fader.label)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
