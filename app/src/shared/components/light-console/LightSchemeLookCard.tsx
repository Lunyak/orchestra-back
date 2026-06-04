import { useState } from "react";
import type { LightSchemeLookModel } from "./light-scheme-preview";
import { LightConsoleSplitView } from "./LightConsoleSplitView";
import { buildLightConsoleSplitModel } from "./light-console-split";
import type { SceneLightFadersDataV1 } from "../../../features/scene/model/scene-slice";
import type { StepLightKadrV1 } from "../../types/script";
import { formatSofitChannelsLabel } from "./light-channel-roles";

export type LightSchemeLookCardProps = {
  lookModel: LightSchemeLookModel | null;
  lightChannels: string[];
  activeKadr?: StepLightKadrV1 | null;
  lightFaders?: SceneLightFadersDataV1 | null;
  sofitChannels?: number[];
  programLabelOverride?: string;
  onHighlightChannel?: (channel: number | null) => void;
};

function FaderRow({ label, pct, color }: { label: string; pct: number; color?: string }) {
  return (
    <div className="light-scheme-call__fader" title={`${label} · ${pct}%`}>
      <span className="light-scheme-call__fader-name">{label}</span>
      <div className="light-scheme-call__fader-bar">
        <div
          className="light-scheme-call__fader-fill"
          style={{
            width: `${pct}%`,
            backgroundColor: color ?? "var(--color-active-ascent)",
          }}
        />
      </div>
      <span className="light-scheme-call__fader-pct">{pct}%</span>
    </div>
  );
}

export function LightSchemeLookCard({
  lookModel,
  lightChannels,
  activeKadr,
  lightFaders,
  sofitChannels = [],
  onHighlightChannel,
}: LightSchemeLookCardProps) {
  const [showConsole, setShowConsole] = useState(false);

  if (!lookModel || !activeKadr) {
    return (
      <aside className="light-scheme-call">
        <div className="light-scheme-call__empty">
          Выберите картину или запишите свет на вкладке «Свет».
        </div>
      </aside>
    );
  }

  const splitModel =
    lightFaders && showConsole
      ? buildLightConsoleSplitModel({
          programId: activeKadr.programId,
          lightChannels,
          faders: lightFaders,
          kadrFaderStates: activeKadr.faders,
          sofitChannels,
          programLabel: lookModel.programLabel,
        })
      : null;

  const sofitSummaries = lookModel.channelSummaries.filter((c) => c.role === "sofit");
  const washSummary = lookModel.channelSummaries.find((c) => c.role === "wash");

  return (
    <aside className="light-scheme-call">
      <header className="light-scheme-call__head">
        <div className="light-scheme-call__kadr">Картина {lookModel.kadrNo}</div>
        <div className="light-scheme-call__title">{lookModel.title}</div>
      </header>

      {lookModel.blackout ? (
        <div className="light-scheme-call__blackout">Блекаут</div>
      ) : (
        <>
          <section className="light-scheme-call__block">
            <div className="light-scheme-call__block-title">Заливка</div>
            <div
              className="light-scheme-call__program"
              style={
                lookModel.programColor
                  ? { borderColor: lookModel.programColor, color: lookModel.programColor }
                  : undefined
              }
              onMouseEnter={() => onHighlightChannel?.(lookModel.programId)}
              onMouseLeave={() => onHighlightChannel?.(null)}
            >
              <span className="light-scheme-call__program-badge">П{lookModel.programId}</span>
              <span>{lookModel.programLabel}</span>
              {washSummary && washSummary.faders.length > 0 ? (
                <span className="light-scheme-call__program-meta">
                  {washSummary.activeFaderCount}/{washSummary.totalFaderCount} фейдеров
                </span>
              ) : (
                <span className="light-scheme-call__program-meta">
                  {Math.round(lookModel.washIntensity * 100)}%
                </span>
              )}
            </div>
            {washSummary?.faders
              .filter((f) => f.intensity > 0)
              .map((f) => (
                <FaderRow
                  key={f.faderId}
                  label={f.label}
                  pct={Math.round(f.intensity * 100)}
                  color={f.color}
                />
              ))}
          </section>

          {sofitSummaries.length > 0 ? (
            <section className="light-scheme-call__block">
              <div className="light-scheme-call__block-title">
                Софиты · {formatSofitChannelsLabel(lookModel.sofitChannels)}
              </div>
              {sofitSummaries.map((channel) => (
                <div
                  key={channel.channel}
                  className="light-scheme-call__channel"
                  onMouseEnter={() => onHighlightChannel?.(channel.channel)}
                  onMouseLeave={() => onHighlightChannel?.(null)}
                >
                  <div className="light-scheme-call__channel-head">
                    <span>{channel.label}</span>
                    <span className="light-scheme-call__channel-dots">
                      {Array.from({ length: channel.totalFaderCount || 1 }, (_, i) => (
                        <span
                          key={i}
                          className="light-scheme-call__dot"
                          data-active={i < channel.activeFaderCount}
                        />
                      ))}
                    </span>
                  </div>
                  {channel.faders
                    .filter((f) => f.intensity > 0)
                    .map((f) => (
                      <FaderRow
                        key={f.faderId}
                        label={f.label}
                        pct={Math.round(f.intensity * 100)}
                        color={f.color}
                      />
                    ))}
                  {channel.activeFaderCount === 0 ? (
                    <div className="light-scheme-call__channel-empty">выключено</div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}
        </>
      )}

      <button
        type="button"
        className="light-scheme-call__toggle-console"
        onClick={() => setShowConsole((v) => !v)}
      >
        {showConsole ? "Скрыть вид пульта" : "Показать как на пульте"}
      </button>

      {showConsole && splitModel ? (
        <LightConsoleSplitView
          model={splitModel}
          lightChannels={lightChannels}
          readOnly
          compact
          sofitHint={formatSofitChannelsLabel(sofitChannels)}
        />
      ) : null}
    </aside>
  );
}
