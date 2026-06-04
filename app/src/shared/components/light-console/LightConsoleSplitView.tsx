import { parseLightChannel, resolveLightColor } from "../show-script/utils/lightTokens";
import type { LightConsoleSplitModel } from "./light-console-split";

type LightConsoleSplitViewProps = {
  model: LightConsoleSplitModel;
  lightChannels: string[];
  readOnly?: boolean;
  compact?: boolean;
  /** Подпись каналов софитов, напр. «K1, K2, K3». */
  sofitHint?: string;
  onPatchFader?: (faderId: number, intensity: number, enabled: boolean) => void;
};

function channelLabel(channel: number, lightChannels: string[]): string {
  const parsed = parseLightChannel(lightChannels[channel - 1] ?? "");
  return parsed.label ? `K${channel} ${parsed.label}` : `K${channel}`;
}

function MiniFader({
  row,
  readOnly,
  onPatch,
}: {
  row: LightConsoleSplitModel["sofitFaders"][number];
  readOnly?: boolean;
  onPatch?: (faderId: number, intensity: number, enabled: boolean) => void;
}) {
  const pct = Math.round(row.intensity * 100);
  return (
    <div className="light-split-fader" title={`${row.label} · ${pct}%`}>
      <div className="light-split-fader__meter">
        <div
          className="light-split-fader__fill"
          style={{
            height: `${pct}%`,
            backgroundColor: row.color ?? "var(--color-active-ascent)",
          }}
        />
      </div>
      <span className="light-split-fader__pct">{pct}</span>
      <span className="light-split-fader__name">{row.label}</span>
      {!readOnly && onPatch ? (
        <input
          type="range"
          className="light-split-fader__range"
          min={0}
          max={1}
          step={0.01}
          value={row.intensity}
          onChange={(event) => {
            const intensity = Number(event.target.value);
            onPatch(row.faderId, intensity, intensity > 0);
          }}
        />
      ) : null}
    </div>
  );
}

function ChannelPills({
  channels,
  lightChannels,
  activeChannels,
}: {
  channels: number[];
  lightChannels: string[];
  activeChannels: number[];
}) {
  return (
    <div className="light-split-channels">
      {channels.map((channel) => {
        const active = activeChannels.includes(channel);
        const color = resolveLightColor(
          parseLightChannel(lightChannels[channel - 1] ?? "").label,
          parseLightChannel(lightChannels[channel - 1] ?? "").color,
        );
        return (
          <span
            key={channel}
            className="light-split-channel"
            data-active={active}
            style={color && active ? { borderColor: color, color } : undefined}
          >
            {channelLabel(channel, lightChannels)}
          </span>
        );
      })}
    </div>
  );
}

export function LightConsoleSplitView({
  model,
  lightChannels,
  readOnly = false,
  compact = false,
  sofitHint,
  onPatchFader,
}: LightConsoleSplitViewProps) {
  const sofitActiveChannels = model.sofitChannels.filter((channel) =>
    model.sofitFaders.some((row) => row.channel === channel && row.intensity > 0),
  );
  const washActive = model.washFaders.some((row) => row.intensity > 0);

  return (
    <div className="light-console-split" data-compact={compact ? "true" : "false"}>
      <div className="light-console-split__program">
        <span className="light-console-split__program-badge">П{model.programId}</span>
        <span
          className="light-console-split__program-label"
          style={
            model.programColor
              ? {
                  backgroundColor: resolveLightColor("", model.programColor) ?? undefined,
                }
              : undefined
          }
        >
          {model.programLabel}
        </span>
      </div>

      <div className="light-console-split__panels">
        <section className="light-split-panel" aria-label="Софиты">
          <header className="light-split-panel__head">
            <span className="light-split-panel__title">Софиты</span>
            <span className="light-split-panel__hint">
              {sofitHint ? sofitHint : `K${model.sofitChannels.join(", K")}`}
            </span>
          </header>
          <ChannelPills
            channels={model.sofitChannels}
            lightChannels={lightChannels}
            activeChannels={sofitActiveChannels}
          />
          <div className="light-split-panel__faders">
            {model.sofitFaders.length > 0 ? (
              model.sofitFaders.map((row) => (
                <MiniFader
                  key={row.faderId}
                  row={row}
                  readOnly={readOnly}
                  onPatch={onPatchFader}
                />
              ))
            ) : (
              <span className="light-split-panel__empty">
                Нет фейдеров на {sofitHint ?? `K${model.sofitChannels.join(", K")}`}
              </span>
            )}
          </div>
        </section>

        <section className="light-split-panel" aria-label="Заливка RGB">
          <header className="light-split-panel__head">
            <span className="light-split-panel__title">Заливка</span>
            <span className="light-split-panel__hint">K{model.washChannel} · RGB</span>
          </header>
          <div className="light-split-channels">
            <span
              className="light-split-channel"
              data-active={washActive}
              style={
                model.washColor && washActive
                  ? {
                      borderColor: resolveLightColor("", model.washColor) ?? undefined,
                      color: resolveLightColor("", model.washColor) ?? undefined,
                    }
                  : undefined
              }
            >
              {model.washLabel}
            </span>
          </div>
          <div className="light-split-panel__faders">
            {model.washFaders.length > 0 ? (
              model.washFaders.map((row) => (
                <MiniFader
                  key={row.faderId}
                  row={row}
                  readOnly={readOnly}
                  onPatch={onPatchFader}
                />
              ))
            ) : (
              <span className="light-split-panel__empty">
                На K{model.washChannel} нет фейдеров — заливка только программой
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
