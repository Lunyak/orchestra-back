import { useMemo, useState } from "react";
import type {
  SceneLightChannelRolesV1,
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../../features/scene/model/scene-slice";
import type { LightFixture, ScriptStep } from "../../../shared/types/script";
import {
  fadersForKadrDisplay,
  findKadrById,
  readStepLightKadrs,
} from "../../theater/model/light-kadrs";
import {
  formatSofitChannelsLabel,
  resolveLightChannelRoles,
  toggleSofitChannel,
} from "../../../shared/components/light-console/light-channel-roles";
import { resolveLightFaders } from "../../../shared/components/light-console/light-console-data";
import { buildLightSchemeLookModel } from "../../../shared/components/light-console/light-scheme-preview";
import { LightSchemeStageMap } from "../../../shared/components/light-console/LightSchemeStageMap";
import { LightSchemeLookCard } from "../../../shared/components/light-console/LightSchemeLookCard";
import { LightConsoleView } from "../../../shared/components/light-console/LightConsoleView";
import type { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import type { SpectacleTapeItem } from "../model/spectacle-kadr-tape";

export type SpectacleRunSchemePaneProps = {
  step: ScriptStep | null;
  tapeItem: SpectacleTapeItem | null;
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1 | null;
  lightPrograms: SceneLightProgramsDataV1 | null;
  lightChannelRoles: SceneLightChannelRolesV1 | null;
  onLightChannelRolesChange: (next: SceneLightChannelRolesV1) => void;
  selectedLightSlot: number;
  liveConsole: ReturnType<typeof useLightConsoleState>;
  liveStatus: string | null;
  onAddKadr?: () => void;
  nextKadrNo?: number;
  onOpenPlotSetup?: () => void;
  onSyncPlotFrom3d?: () => void;
  canSyncPlotFrom3d?: boolean;
};

export function SpectacleRunSchemePane({
  step,
  tapeItem,
  lightChannels,
  lightFaders,
  lightPrograms,
  lightChannelRoles,
  onLightChannelRolesChange,
  selectedLightSlot,
  liveConsole,
  liveStatus,
  onAddKadr,
  nextKadrNo = 1,
  onOpenPlotSetup,
  onSyncPlotFrom3d,
  canSyncPlotFrom3d = false,
}: SpectacleRunSchemePaneProps) {
  const [highlightedChannel, setHighlightedChannel] = useState<number | null>(null);
  const lightPlot = step?.lightPlot ?? [];
  const plotEmpty = lightPlot.length === 0;
  const gridCols = 12;
  const gridRows = 20;

  const kadrs = useMemo(() => readStepLightKadrs(step), [step?.lightKadrs, step?.id]);
  const activeKadr = useMemo(() => {
    if (!tapeItem?.kadrId) return kadrs.kadrs.find((k) => k.kadrNo === tapeItem?.kadrNo);
    return findKadrById(kadrs, tapeItem.kadrId);
  }, [kadrs, tapeItem?.kadrId, tapeItem?.kadrNo]);

  const baseFaders = useMemo(
    () => resolveLightFaders(lightFaders ?? undefined),
    [lightFaders],
  );
  const displayFaders = useMemo(
    () => (activeKadr ? fadersForKadrDisplay(activeKadr, baseFaders) : baseFaders),
    [activeKadr, baseFaders],
  );
  const roles = useMemo(
    () => resolveLightChannelRoles(lightChannelRoles, lightChannels.length),
    [lightChannelRoles, lightChannels.length],
  );

  const lookModel = useMemo(() => {
    if (!activeKadr) return null;
    return buildLightSchemeLookModel({
      kadr: activeKadr,
      sectionTitle: tapeItem?.headingTitle,
      lightPlot,
      lightChannels,
      lightFaders: displayFaders,
      lightPrograms,
      lightChannelRoles,
    });
  }, [
    activeKadr,
    displayFaders,
    lightChannelRoles,
    lightChannels,
    lightPlot,
    lightPrograms,
    tapeItem?.headingTitle,
  ]);

  if (tapeItem?.isPlaceholder) {
    return (
      <div className="spectacle-run-scheme spectacle-run-scheme--empty">
        <p>
          В шаге «{tapeItem.stepTitle}» пока нет картин. Добавьте первую — появится в ленте репетиции
          и в тексте шага (<code>### Картина {nextKadrNo}</code>).
        </p>
        {onAddKadr ? (
          <button
            type="button"
            className="spectacle-run__add-kadr-btn"
            data-primary="true"
            onClick={onAddKadr}
          >
            + Картина {nextKadrNo}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="spectacle-run-scheme">
      <div className="light-scheme-board__roles">
        <span className="light-scheme-board__roles-label">Софиты:</span>
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

      {plotEmpty ? (
        <div className="spectacle-run-scheme__plot-setup" role="note">
          <p>
            <strong>План софитов пуст</strong> — на схеме нечего подсвечивать. Один раз настройте
            расстановку для этого шага (или подтяните из 3D), потом возвращайтесь в репетицию.
          </p>
          <div className="spectacle-run-scheme__plot-setup-actions">
            {onOpenPlotSetup ? (
              <button
                type="button"
                className="spectacle-run__add-kadr-btn"
                data-primary="true"
                onClick={onOpenPlotSetup}
              >
                Расстановка софитов
              </button>
            ) : null}
            {canSyncPlotFrom3d && onSyncPlotFrom3d ? (
              <button type="button" className="spectacle-run__add-kadr-btn" onClick={onSyncPlotFrom3d}>
                Взять из 3D-сцены
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {liveStatus ? (
        <p className="spectacle-run-scheme__live-status" role="status">
          {liveStatus}
        </p>
      ) : (
        <p className="spectacle-run-scheme__live-hint">
          Изменения на пульте автоматически пишутся в текущую картину
        </p>
      )}

      <div className="light-scheme-layout spectacle-run-scheme__map-row">
        <LightSchemeStageMap
          fixtures={lightPlot}
          gridCols={gridCols}
          gridRows={gridRows}
          lookModel={lookModel}
          selectedLightSlot={selectedLightSlot}
          highlightedChannel={highlightedChannel}
          editable={false}
          emptyPlotHint="Нет точек на плане. Нажмите «Расстановка софитов» выше."
          emptyPlotActionLabel={onOpenPlotSetup ? "Расстановка софитов" : undefined}
          onEmptyPlotAction={onOpenPlotSetup}
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

      <LightConsoleView
        mode="live"
        lightChannels={liveConsole.lightChannels}
        selectedLightSlot={liveConsole.selectedLightSlot}
        faders={liveConsole.faders}
        programs={liveConsole.programs}
        spotlights={step?.theaterSpotlights ?? []}
        consoleChannel={liveConsole.selectedLightSlot}
        onSelectChannel={liveConsole.selectChannel}
        onSelectProgram={liveConsole.selectProgram}
        onFaderCountChange={liveConsole.setFaderCount}
        onPatchFader={liveConsole.patchFader}
        onSaveActiveProgram={liveConsole.saveProgramSnapshot}
        className="spectacle-run-scheme__console"
      />
    </div>
  );
}
