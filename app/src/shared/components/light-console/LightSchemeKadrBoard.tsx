import { useMemo, useState } from "react";
import type {
  SceneLightChannelRolesV1,
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../../features/scene/model/scene-slice";
import type { LightFixture, ScriptStep } from "../../types/script";
import { parseLightChannel, resolveLightColor } from "../show-script/utils/lightTokens";
import {
  fadersForKadrDisplay,
  findKadrById,
  readStepLightKadrs,
  scanMarkdownKadrSections,
} from "../../../features/theater/model/light-kadrs";
import {
  formatSofitChannelsLabel,
  resolveLightChannelRoles,
  toggleSofitChannel,
} from "./light-channel-roles";
import { resolveLightFaders } from "./light-console-data";
import { buildLightSchemeLookModel } from "./light-scheme-preview";
import { LightSchemeStageMap } from "./LightSchemeStageMap";
import { LightSchemeLookCard } from "./LightSchemeLookCard";
import { LightWorkflowGuide } from "./LightWorkflowGuide";

export type LightSchemeKadrBoardProps = {
  step: ScriptStep | null | undefined;
  markdown: string;
  activeKadrId: string | null;
  onActiveKadrIdChange?: (id: string | null) => void;
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1 | null;
  lightPrograms: SceneLightProgramsDataV1 | null;
  lightChannelRoles: SceneLightChannelRolesV1 | null;
  onLightChannelRolesChange: (next: SceneLightChannelRolesV1) => void;
  lightPlot: LightFixture[];
  gridCols: number;
  gridRows: number;
  selectedLightSlot?: number;
  editPlot?: boolean;
  onFixtureAimChange?: (fixtureId: number, angle: number, length: number) => void;
  onRecordKadr?: () => void;
  recordMessage?: string | null;
};

function kadrProgramColor(
  kadr: ReturnType<typeof findKadrById>,
  lightChannels: string[],
): string | null {
  if (!kadr || kadr.blackout || kadr.programId <= 0) return "var(--color-surface-1)";
  const raw = lightChannels[kadr.programId - 1];
  if (!raw) return null;
  const parsed = parseLightChannel(raw);
  return resolveLightColor(parsed.label, parsed.color);
}

export function LightSchemeKadrBoard({
  step,
  markdown,
  activeKadrId,
  onActiveKadrIdChange,
  lightChannels,
  lightFaders,
  lightPrograms,
  lightChannelRoles,
  onLightChannelRolesChange,
  lightPlot,
  gridCols,
  gridRows,
  selectedLightSlot = 0,
  editPlot = false,
  onFixtureAimChange,
  onRecordKadr,
  recordMessage,
}: LightSchemeKadrBoardProps) {
  const [highlightedChannel, setHighlightedChannel] = useState<number | null>(null);

  const sections = useMemo(() => scanMarkdownKadrSections(markdown), [markdown]);
  const kadrs = useMemo(() => readStepLightKadrs(step), [step?.lightKadrs, step?.id]);
  const baseFaders = useMemo(
    () => resolveLightFaders(lightFaders ?? undefined),
    [lightFaders],
  );
  const roles = useMemo(
    () => resolveLightChannelRoles(lightChannelRoles, lightChannels.length),
    [lightChannelRoles, lightChannels.length],
  );

  const resolvedActiveId = useMemo(() => {
    if (activeKadrId && kadrs.kadrs.some((k) => k.id === activeKadrId)) return activeKadrId;
    return sections.find((s) => s.id)?.id ?? null;
  }, [activeKadrId, kadrs.kadrs, sections]);

  const activeSection = useMemo(() => {
    if (!resolvedActiveId) return sections[0] ?? null;
    return sections.find((s) => s.id === resolvedActiveId) ?? sections[0] ?? null;
  }, [resolvedActiveId, sections]);

  const activeKadr = resolvedActiveId ? findKadrById(kadrs, resolvedActiveId) : undefined;

  const displayFaders = useMemo(
    () => (activeKadr ? fadersForKadrDisplay(activeKadr, baseFaders) : baseFaders),
    [activeKadr, baseFaders],
  );

  const lookModel = useMemo(() => {
    if (!activeKadr) return null;
    return buildLightSchemeLookModel({
      kadr: activeKadr,
      sectionTitle: activeSection?.headingTitle,
      lightPlot,
      lightChannels,
      lightFaders: displayFaders,
      lightPrograms,
      lightChannelRoles,
    });
  }, [
    activeKadr,
    activeSection?.headingTitle,
    lightPlot,
    lightChannels,
    displayFaders,
    lightPrograms,
    lightChannelRoles,
  ]);

  return (
    <div className="light-scheme-board">
      <div className="light-scheme-board__header">
        <div>
          <div className="light-scheme-board__title">Свет картины</div>
          <div className="light-scheme-board__hint">
            Превью look · запись пульта — кнопка ниже или вкладка «Свет» в сценарии шага
          </div>
        </div>
        {onRecordKadr ? (
          <button
            type="button"
            className="light-kadr-panel__action"
            data-primary="true"
            disabled={!activeSection}
            onClick={onRecordKadr}
          >
            Записать текущий пульт в картину
          </button>
        ) : null}
      </div>

      <LightWorkflowGuide variant="compact" />
      {recordMessage ? (
        <p className="light-kadr-panel__record-msg" role="status">
          {recordMessage}
        </p>
      ) : null}

      <div className="light-scheme-board__roles">
        <span className="light-scheme-board__roles-label">Софиты на каналах:</span>
        <div className="light-scheme-board__roles-toggles">
          {lightChannels.map((_, index) => {
            const channel = index + 1;
            const active = roles.sofitChannels.includes(channel);
            return (
              <button
                key={channel}
                type="button"
                className="light-scheme-board__role-btn"
                data-active={active}
                data-highlight={highlightedChannel === channel}
                title={
                  active
                    ? `K${channel} — софиты (нажмите, чтобы убрать)`
                    : `K${channel} — заливка (нажмите, чтобы отметить софиты)`
                }
                onMouseEnter={() => setHighlightedChannel(channel)}
                onMouseLeave={() => setHighlightedChannel(null)}
                onClick={() =>
                  onLightChannelRolesChange(
                    toggleSofitChannel(roles, channel, lightChannels.length),
                  )
                }
              >
                K{channel}
              </button>
            );
          })}
        </div>
        <span className="light-scheme-board__roles-summary">
          {formatSofitChannelsLabel(roles.sofitChannels)}
        </span>
      </div>

      {sections.length > 0 ? (
        <div className="light-kadr-panel__strip light-scheme-board__strip">
          {sections.map((section) => {
            const kadr = section.id ? findKadrById(kadrs, section.id) : undefined;
            const color = kadrProgramColor(kadr, lightChannels);
            const active = section.id === resolvedActiveId;
            return (
              <button
                key={`${section.kadrNo}:${section.id ?? section.headingStart}`}
                type="button"
                className="light-kadr-panel__chip"
                data-active={active}
                onClick={() => onActiveKadrIdChange?.(section.id)}
                title={section.headingTitle}
              >
                <span
                  className="light-kadr-panel__chip-dot"
                  style={{ backgroundColor: color ?? undefined }}
                />
                {section.kadrNo}
                {kadr?.programId ? ` · П${kadr.programId}` : ""}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="light-scheme-board__empty">
          В тексте шага нет «### Картина N» — добавьте картину в сценарии.
        </p>
      )}

      <div className="light-scheme-layout">
        <LightSchemeStageMap
          fixtures={lightPlot}
          gridCols={gridCols}
          gridRows={gridRows}
          lookModel={lookModel}
          selectedLightSlot={selectedLightSlot}
          highlightedChannel={highlightedChannel}
          editable={editPlot}
          onAimChange={onFixtureAimChange}
        />
        <LightSchemeLookCard
          lookModel={lookModel}
          lightChannels={lightChannels}
          activeKadr={activeKadr}
          lightFaders={displayFaders}
          sofitChannels={roles.sofitChannels}
          onHighlightChannel={setHighlightedChannel}
        />
      </div>
    </div>
  );
}
