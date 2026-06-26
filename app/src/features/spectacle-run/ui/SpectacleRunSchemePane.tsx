import { useMemo, useState } from "react";
import type {
  PlaybookLightChannelRolesV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../../features/playbook/model/playbook-slice";
import type { ScriptScene } from "../../../shared/types/script";
import {
  fadersForKadrDisplay,
  findKadrById,
  readSceneLightKadrsFromMarkdown,
} from "../../theater/model/light-kadrs";
import { resolveLightFaders } from "../../../shared/components/light-console/light-console-data";
import { buildLightSchemeLookModel } from "../../../shared/components/light-console/light-scheme-preview";
import { ENABLE_3D_THEATER } from "../../../shared/build-features";
import { LightSchemeStageMap } from "../../../shared/components/light-console/LightSchemeStageMap";
import { LightSchemeLookCard } from "../../../shared/components/light-console/LightSchemeLookCard";
import { SpectacleRunTheaterEmbed } from "./SpectacleRunTheaterEmbed";
import { LightConsoleView } from "../../../shared/components/light-console/LightConsoleView";
import type { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import type { SpectacleTapeItem } from "../model/spectacle-kadr-tape";
import { SCRIPT_MARKDOWN_NOTES_TAB_LABEL } from "../../../shared/components/show-script/script-markdown-tab-labels";
import { SpectacleRunProjectorPanel } from "../../projector/ui/SpectacleRunProjectorPanel";

export type SpectacleRunSchemePaneProps = {
  scene: ScriptScene | null;
  tapeItem: SpectacleTapeItem | null;
  lightChannels: string[];
  lightFaders: PlaybookLightFadersDataV1 | null;
  lightPrograms: PlaybookLightProgramsDataV1 | null;
  lightChannelRoles: PlaybookLightChannelRolesV1 | null;
  onLightChannelRolesChange: (next: PlaybookLightChannelRolesV1) => void;
  selectedLightSlot: number;
  liveConsole: ReturnType<typeof useLightConsoleState>;
  liveStatus: string | null;
  onLiveStatus?: (message: string | null) => void;
  onOpenConsoleSettings?: () => void;
};

export function SpectacleRunSchemePane({
  scene,
  tapeItem,
  lightChannels,
  lightFaders,
  lightPrograms,
  lightChannelRoles,
  onLightChannelRolesChange: _onLightChannelRolesChange,
  selectedLightSlot,
  liveConsole,
  liveStatus,
  onLiveStatus,
  onOpenConsoleSettings,
}: SpectacleRunSchemePaneProps) {
  const [highlightedChannel, setHighlightedChannel] = useState<number | null>(null);
  const lightPlot = scene?.lightPlot ?? [];
  const plotEmpty = lightPlot.length === 0;
  const gridCols = 12;
  const gridRows = 20;

  const kadrs = useMemo(
    () => readSceneLightKadrsFromMarkdown(scene),
    [scene?.markdown, scene?.lightKadrs, scene?.id],
  );
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
          В сцене «{tapeItem.sceneTitle}» пока нет картин. Добавьте первую — появится в ленте репетиции
          и в тексте сцены (<code>### Картина 1</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="spectacle-run-scheme">
      {plotEmpty ? (
        <div className="spectacle-run-scheme__plot-setup" role="note">
          <p className="spectacle-run-scheme__plot-setup-text">
            <strong className="spectacle-run-scheme__plot-setup-title">План софитов пуст</strong> — на схеме нечего подсвечивать. Картины и текст — в{" "}
            <strong>{SCRIPT_MARKDOWN_NOTES_TAB_LABEL}</strong>, позиции софитов — в 3D-театре ниже.
          </p>
        </div>
      ) : null}

      {liveStatus ? (
        <p className="spectacle-run-scheme__live-status" role="status">
          {liveStatus}
        </p>
      ) : (
        <p className="spectacle-run-scheme__live-hint">
          <strong>Как записать свет:</strong> картина в ленте → на пульте всегда ваши{" "}
          <strong>
            F1–F{liveConsole.faders.count ?? liveConsole.faders.faders.length}
          </strong>{" "}
          → слева <strong>K3</strong>, подстройте
          ползунки → <strong>K4</strong>, другие уровни (память на канал) → <strong>П3</strong> заливка.
        </p>
      )}

      <div className="light-scheme-layout spectacle-run-scheme__stage-row">
        {ENABLE_3D_THEATER ? (
          <SpectacleRunTheaterEmbed />
        ) : (
          <LightSchemeStageMap
            fixtures={lightPlot}
            gridCols={gridCols}
            gridRows={gridRows}
            lookModel={lookModel}
            selectedLightSlot={selectedLightSlot}
            highlightedChannel={highlightedChannel}
            editable={false}
            emptyPlotHint={`Нет точек на плане. Добавьте софиты в «${SCRIPT_MARKDOWN_NOTES_TAB_LABEL}» или расставьте в 3D-театре.`}
          />
        )}
        <LightSchemeLookCard
          lookModel={lookModel}
          lightChannels={lightChannels}
          activeKadr={activeKadr}
          lightFaders={displayFaders}
          boardFaders={baseFaders}
          spotlights={scene?.theaterSpotlights ?? []}
          onHighlightChannel={setHighlightedChannel}
        />
      </div>

      <SpectacleRunProjectorPanel />

      <LightConsoleView
        mode="live"
        lightChannels={liveConsole.lightChannels}
        selectedLightSlot={liveConsole.selectedLightSlot}
        faders={liveConsole.faders}
        programs={liveConsole.programs}
        spotlights={scene?.theaterSpotlights ?? []}
        consoleChannel={liveConsole.selectedLightSlot}
        onSelectChannel={liveConsole.selectChannel}
        onSelectProgram={liveConsole.selectProgram}
        onOpenSettings={onOpenConsoleSettings}
        onPatchFader={liveConsole.patchFader}
        onSaveActiveProgram={() => {
          const pid = Math.max(
            1,
            Math.trunc(liveConsole.programs.activeProgramId ?? 1) || 1,
          );
          const prog = liveConsole.programs.programs.find((p) => p.id === pid);
          liveConsole.saveProgramSnapshot();
          onLiveStatus?.(
            `П${pid}${prog?.label?.trim() ? ` «${prog.label.trim()}»` : ""} сохранена в сцену (память программы).`,
          );
        }}
        className="spectacle-run-scheme__console"
      />
    </div>
  );
}
