import { useMemo } from "react";
import type { LightSchemeLookModel } from "./light-scheme-preview";
import {
  buildKadrRecordFaderRows,
  type LightFaderBoardRow,
} from "./light-console-split";
import type { PlaybookLightFadersDataV1 } from "../../../features/playbook/model/playbook-slice";
import type { SceneLightKadrV1, TheaterSpotlight } from "../../types/script";
import { formatSofitChannelsLabel } from "./light-channel-roles";

export type LightSchemeLookCardProps = {
  lookModel: LightSchemeLookModel | null;
  lightChannels: string[];
  activeKadr?: SceneLightKadrV1 | null;
  lightFaders?: PlaybookLightFadersDataV1 | null;
  /** Сцена с links — для фильтра «есть оборудование» (не kadr-display). */
  boardFaders?: PlaybookLightFadersDataV1 | null;
  spotlights?: TheaterSpotlight[];
  programLabelOverride?: string;
  onHighlightChannel?: (channel: number | null) => void;
};

function FaderRow({
  label,
  pct,
  color,
  off,
  equipmentLabel,
}: {
  label: string;
  pct: number;
  color?: string;
  off?: boolean;
  equipmentLabel?: string;
}) {
  const via = equipmentLabel ? ` · ${equipmentLabel}` : "";
  return (
    <div
      className={["light-scheme-call__fader", off ? "light-scheme-call__fader--off" : ""]
        .filter(Boolean)
        .join(" ")}
      title={
        off
          ? `${label}${via} · выключен в картине`
          : `${label}${via} · ${pct}%`
      }
    >
      <span className="light-scheme-call__fader-name">{label}</span>
      <div className="light-scheme-call__fader-bar">
        <div
          className="light-scheme-call__fader-fill"
          style={{
            width: off ? "0%" : `${pct}%`,
            backgroundColor: color ?? "var(--color-active-ascent)",
          }}
        />
      </div>
      <span className="light-scheme-call__fader-pct">{off ? "выкл" : `${pct}%`}</span>
    </div>
  );
}

export function LightSchemeLookCard({
  lookModel,
  lightChannels,
  activeKadr,
  lightFaders,
  boardFaders,
  spotlights = [],
  onHighlightChannel,
}: LightSchemeLookCardProps) {
  const recordRows = useMemo((): LightFaderBoardRow[] => {
    if (!lightFaders || !activeKadr || !lookModel) return [];
    const board = boardFaders ?? lightFaders;
    return buildKadrRecordFaderRows({
      kadrFaderStates: activeKadr.faders,
      faders: lightFaders,
      boardFaders: board,
      selectedChannels: lookModel.sofitChannels,
      lightChannelsCount: lightChannels.length,
      spotlights,
    });
  }, [
    activeKadr,
    activeKadr?.faders,
    boardFaders,
    lightChannels.length,
    lightFaders,
    lookModel,
    lookModel?.sofitChannels,
    spotlights,
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
      {lookModel.blackout ? (
        <div className="light-scheme-call__blackout">Блекаут</div>
      ) : (
        <>
          <section className="light-scheme-call__block">
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
                  className="light-scheme-call__fader-wrap"
                  onMouseEnter={() => onHighlightChannel?.(f.channel)}
                  onMouseLeave={() => onHighlightChannel?.(null)}
                >
                  <FaderRow
                    label={f.label}
                    pct={Math.round(f.intensity * 100)}
                    color={f.color}
                    off={!f.enabled}
                    equipmentLabel={f.equipmentLabel}
                  />
                </div>
              ))
            ) : (
              <div className="light-scheme-call__channel-empty">
                {lookModel.sofitChannels.length === 0
                  ? "Отметьте каналы K в переключателях над схемой, затем «Записать свет»."
                  : spotlights.length === 0
                    ? "Нет софитов/RGB в 3D — привяжите оборудование к фейдерам в театре."
                    : `Нет фейдеров с оборудованием на ${formatSofitChannelsLabel(lookModel.sofitChannels)} — проверьте привязку в 3D.`}
              </div>
            )}
          </section>
        </>
      )}
    </aside>
  );
}
