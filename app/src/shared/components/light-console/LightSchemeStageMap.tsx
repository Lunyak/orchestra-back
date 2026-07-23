import cn from "classnames";
import type { LightFixture } from "../../types/script";
import { fixtureLookState, type LightSchemeLookModel } from "./light-scheme-preview";
import { fixtureMatchesChannelSlot } from "../../../features/theater/model/theater-light-channel-link";

export type LightSchemeStageMapProps = {
  fixtures: LightFixture[];
  gridCols: number;
  gridRows: number;
  lookModel: LightSchemeLookModel | null;
  selectedLightSlot?: number;
  highlightedChannel?: number | null;
  editable?: boolean;
  onAimChange?: (fixtureId: number, angle: number, length: number) => void;
  /** Текст, если на плане нет софитов (режим спектакля и т.п.). */
  emptyPlotHint?: string;
  emptyPlotActionLabel?: string;
  onEmptyPlotAction?: () => void;
};

export function LightSchemeStageMap({
  fixtures,
  gridCols,
  gridRows,
  lookModel,
  selectedLightSlot = 0,
  highlightedChannel = null,
  editable = false,
  onAimChange,
  emptyPlotHint,
  emptyPlotActionLabel,
  onEmptyPlotAction,
}: LightSchemeStageMapProps) {
  const washColor = lookModel?.programColor ?? null;
  const washOpacity = lookModel?.washIntensity ?? 0;
  const washDisplayOpacity = Math.min(0.55, 0.12 + washOpacity * 0.43);

  const handleAim = (
    fixtureId: number,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!editable || !onAimChange) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalizedAngle = Math.round((angle + 360) % 360);
    const length = Math.max(10, Math.round(Math.hypot(dx, dy)));
    onAimChange(fixtureId, normalizedAngle, length);
  };

  return (
    <div className="light-scheme-stage">
      <div className="light-scheme-stage__labels">
        <span className="light-scheme-stage__label light-scheme-stage__label--back">Занавес</span>
        <span className="light-scheme-stage__label light-scheme-stage__label--audience">Зал</span>
      </div>
      <div
        className="light-scheme-stage__map light-plot-map"
        data-editable={editable ? "true" : "false"}
        style={
          {
            "--light-cols": gridCols,
            "--light-rows": gridRows,
          } as React.CSSProperties
        }
      >
        {washColor && washOpacity > 0 ? (
          <div
            className="light-scheme-stage__wash"
            style={
              {
                "--light-stage-wash-color": washColor,
                "--light-stage-wash-opacity": String(washDisplayOpacity),
              } as React.CSSProperties
            }
            aria-hidden
          />
        ) : null}

        {lookModel?.blackout ? (
          <div className="light-scheme-stage__blackout" aria-hidden />
        ) : null}

        {fixtures.length === 0 ? (
          <div className="light-plot-empty light-plot-empty--actionable">
            <p>
              {emptyPlotHint ??
                "Софиты на плане не заданы. Вкладка «Расстановка» → «Редактировать расстановку»."}
            </p>
            {onEmptyPlotAction && emptyPlotActionLabel ? (
              <button
                type="button"
                className="light-plot-empty__btn"
                onClick={onEmptyPlotAction}
              >
                {emptyPlotActionLabel}
              </button>
            ) : null}
          </div>
        ) : (
          fixtures.map((fixture) => {
            const look = fixtureLookState(lookModel, fixture.id);
            const slotActive =
              selectedLightSlot > 0 && fixtureMatchesChannelSlot(fixture, selectedLightSlot);
            const channelHighlight =
              highlightedChannel != null &&
              look?.channelSlot != null &&
              look.channelSlot === highlightedChannel;
            const intensity = look?.intensity ?? 0;
            const lit = intensity > 0.02;
            const pct = Math.round(intensity * 100);

            return (
              <div
                key={fixture.id}
                className={cn(
                  "light-plot-dot",
                  "light-scheme-stage__dot",
                  slotActive && "light-plot-dot--slot-active",
                  lit ? "light-scheme-stage__dot--lit" : "light-scheme-stage__dot--dim",
                  channelHighlight && "light-scheme-stage__dot--channel-focus",
                )}
                style={
                  {
                    gridColumn: fixture.x,
                    gridRow: fixture.y,
                    ["--angle" as string]: `${fixture.angle ?? 0}deg`,
                    ["--length" as string]: `${fixture.length ?? 54}px`,
                    ["--look-intensity" as string]: String(intensity),
                    ...(look?.color && lit ? { ["--look-color" as string]: look.color } : {}),
                  } as React.CSSProperties
                }
                title={
                  look
                    ? `${fixture.label} · ${look.faderLabel ?? "—"} · ${pct}% · K${look.channelSlot ?? "?"}`
                    : `${fixture.label} → канал ${fixture.channel || "—"}`
                }
                onPointerDown={(event) => {
                  if (!editable || event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  handleAim(fixture.id, event);
                }}
                onPointerMove={(event) => {
                  if (!editable || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  handleAim(fixture.id, event);
                }}
                onPointerUp={(event) => {
                  if (!editable) return;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
              >
                <span className="light-plot-dot-label">{fixture.label}</span>
                {lookModel && lit ? (
                  <span className="light-scheme-stage__dot-pct">{pct}%</span>
                ) : fixture.channel ? (
                  <span className="light-plot-dot-channel">{fixture.channel}</span>
                ) : null}
                <span className="light-plot-ray light-scheme-stage__ray" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
