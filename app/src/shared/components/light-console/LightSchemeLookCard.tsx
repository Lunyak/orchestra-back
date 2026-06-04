import { useMemo } from "react";
import type { LightSchemeLookModel } from "./light-scheme-preview";
import {
  buildKadrRecordFaderRows,
  type LightFaderBoardRow,
} from "./light-console-split";
import type { SceneLightFadersDataV1 } from "../../../features/scene/model/scene-slice";
import type { StepLightKadrV1 } from "../../types/script";
import { formatSofitChannelsLabel } from "./light-channel-roles";

export type LightSchemeLookCardProps = {
  lookModel: LightSchemeLookModel | null;
  lightChannels: string[];
  activeKadr?: StepLightKadrV1 | null;
  lightFaders?: SceneLightFadersDataV1 | null;
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
  onHighlightChannel,
}: LightSchemeLookCardProps) {
  const recordRows = useMemo((): LightFaderBoardRow[] => {
    if (!lightFaders || !activeKadr || !lookModel) return [];
    return buildKadrRecordFaderRows({
      kadrFaderStates: activeKadr.faders,
      faders: lightFaders,
      selectedChannels: lookModel.sofitChannels,
      lightChannelsCount: lightChannels.length,
    });
  }, [
    activeKadr,
    activeKadr?.faders,
    lightChannels.length,
    lightFaders,
    lookModel,
    lookModel?.sofitChannels,
  ]);

  const channelsInKadr = useMemo((): number[] => {
    const set = new Set(recordRows.map((row) => row.channel));
    return [...set].sort((a, b) => a - b);
  }, [recordRows]);

  if (!lookModel || !activeKadr) {
    return (
      <aside className="light-scheme-call">
        <div className="light-scheme-call__empty">
          Выберите картину или запишите свет на вкладке «Свет».
        </div>
      </aside>
    );
  }

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
            </div>
          </section>

          <section className="light-scheme-call__block">
            <div className="light-scheme-call__block-title">
              Каналы
              {lookModel.sofitChannels.length > 0
                ? ` · ${formatSofitChannelsLabel(lookModel.sofitChannels)}`
                : null}
            </div>
            {recordRows.length > 0 ? (
              recordRows.map((f) => (
                <div
                  key={`${f.channel}-${f.faderId}`}
                  onMouseEnter={() => onHighlightChannel?.(f.channel)}
                  onMouseLeave={() => onHighlightChannel?.(null)}
                >
                  <FaderRow
                    label={f.label}
                    pct={Math.round(f.intensity * 100)}
                    color={f.color}
                  />
                </div>
              ))
            ) : (
              <div className="light-scheme-call__channel-empty">
                {lookModel.sofitChannels.length === 0
                  ? "Отметьте каналы K в переключателях над схемой, затем «Записать свет»."
                  : `Нет уровней на ${formatSofitChannelsLabel(lookModel.sofitChannels)}.`}
              </div>
            )}
          </section>
        </>
      )}
    </aside>
  );
}
