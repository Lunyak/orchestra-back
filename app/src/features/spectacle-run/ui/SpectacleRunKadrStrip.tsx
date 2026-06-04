import { useEffect, useMemo, useRef } from "react";
import type {
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../scene/model/scene-slice";
import {
  fadersForKadrDisplay,
  findKadrById,
  readStepLightKadrsFromMarkdown,
} from "../../theater/model/light-kadrs";
import { buildLightConsoleSplitModel } from "../../../shared/components/light-console/light-console-split";
import { resolveLightFaders } from "../../../shared/components/light-console/light-console-data";
import { resolveLightColor } from "../../../shared/components/show-script/utils/lightTokens";
import type { ScriptStep } from "../../../shared/types/script";
import {
  buildSpectacleTapeStepGroups,
  type SpectacleTapeItem,
} from "../model/spectacle-kadr-tape";

export type SpectacleRunKadrStripProps = {
  tape: SpectacleTapeItem[];
  tapeIndex: number;
  steps: ScriptStep[];
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1 | null;
  lightPrograms: SceneLightProgramsDataV1 | null;
  onSelectIndex: (index: number) => void;
};

function kadrProgramColor(
  item: SpectacleTapeItem,
  step: ScriptStep | undefined,
  lightChannels: string[],
  baseFaders: ReturnType<typeof resolveLightFaders>,
): string | null {
  if (item.isPlaceholder || !step) return null;
  const kadrs = readStepLightKadrsFromMarkdown(step);
  const kadr =
    (item.kadrId ? findKadrById(kadrs, item.kadrId) : undefined) ??
    kadrs.kadrs.find((k) => k.kadrNo === item.kadrNo);
  if (!kadr || kadr.blackout || kadr.programId <= 0) return null;
  const display = fadersForKadrDisplay(kadr, baseFaders);
  const split = buildLightConsoleSplitModel({
    programId: kadr.programId,
    lightChannels,
    faders: display,
    kadrFaderStates: kadr.faders,
    sofitChannels: [],
  });
  return split.programColor ? resolveLightColor("", split.programColor) : null;
}

export function SpectacleRunKadrStrip({
  tape,
  tapeIndex,
  steps,
  lightChannels,
  lightFaders,
  onSelectIndex,
}: SpectacleRunKadrStripProps) {
  const groups = useMemo(() => buildSpectacleTapeStepGroups(tape), [tape]);
  const baseFaders = useMemo(
    () => resolveLightFaders(lightFaders ?? undefined),
    [lightFaders],
  );
  const trackRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const chip = activeChipRef.current;
    const track = trackRef.current;
    if (!chip || !track) return;
    const chipLeft = chip.offsetLeft;
    const chipRight = chipLeft + chip.offsetWidth;
    const viewLeft = track.scrollLeft;
    const viewRight = viewLeft + track.clientWidth;
    if (chipLeft < viewLeft + 8 || chipRight > viewRight - 8) {
      chip.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
    }
  }, [tapeIndex]);

  if (tape.length === 0) return null;

  return (
    <footer className="spectacle-run-kadr-strip" aria-label="Лента картин по шагам">
      <div ref={trackRef} className="spectacle-run-kadr-strip__track">
        {groups.map((group) => (
          <section
            key={group.stepId}
            className="spectacle-run-kadr-strip__step"
            aria-label={`Шаг ${group.stepOrdinal}: ${group.stepTitle}`}
          >
            <header className="spectacle-run-kadr-strip__step-head">
              <span className="spectacle-run-kadr-strip__step-no">{group.stepOrdinal}</span>
              <span className="spectacle-run-kadr-strip__step-title" title={group.stepTitle}>
                {group.stepTitle}
              </span>
            </header>
            <div className="spectacle-run-kadr-strip__chips">
              {group.items.map(({ tapeIndex: index, item }) => {
                const active = index === tapeIndex;
                const step = steps[item.stepIndex];
                const programColor = kadrProgramColor(
                  item,
                  step,
                  lightChannels,
                  baseFaders,
                );
                const label = item.isPlaceholder
                  ? "—"
                  : String(item.kadrNo);
                const title = item.isPlaceholder
                  ? `${item.stepTitle}: нет картин`
                  : `Картина ${item.kadrNo}${item.headingTitle ? ` · ${item.headingTitle}` : ""}`;

                return (
                  <button
                    key={`${item.stepId}-${item.kadrId ?? "ph"}-${item.kadrNo}-${index}`}
                    ref={active ? activeChipRef : undefined}
                    type="button"
                    className="spectacle-run-kadr-strip__chip"
                    data-active={active}
                    data-placeholder={item.isPlaceholder ? "true" : undefined}
                    title={title}
                    onClick={() => onSelectIndex(index)}
                  >
                    {programColor ? (
                      <span
                        className="spectacle-run-kadr-strip__chip-dot"
                        style={{ backgroundColor: programColor }}
                        aria-hidden
                      />
                    ) : null}
                    <span className="spectacle-run-kadr-strip__chip-label">
                      {item.isPlaceholder ? "∅" : `К${label}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </footer>
  );
}
