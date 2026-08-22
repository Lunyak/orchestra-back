import cn from "classnames";
import { useEffect, useMemo, useState } from "react";
import type {
  PlaybookLightChannelRolesV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../../features/playbook/model/playbook-slice";
import type { ScriptScene } from "../../../shared/types/script";
import {
  fadersForKadrDisplay,
  findKadrById,
  readSceneLightKadrs,
} from "../../theater/model/light-kadrs";
import { resolveLightFaders } from "../../../shared/components/light-console/light-console-data";
import { buildLightSchemeLookModel } from "../../../shared/components/light-console/light-scheme-preview";
import { ENABLE_3D_THEATER } from "../../../shared/build-features";
import { LightSchemeStageMap } from "../../../shared/components/light-console/LightSchemeStageMap";
import { SpectacleRunTheaterEmbed } from "./SpectacleRunTheaterEmbed";
import { LightConsoleView } from "../../../shared/components/light-console/LightConsoleView";
import type { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import type { SpectacleTapeItem } from "../model/spectacle-kadr-tape";
import { SpectacleRunProjectorPanel } from "../../projector/ui/SpectacleRunProjectorPanel";
import { SpectacleRunRequisitesPanel } from "./SpectacleRunRequisitesPanel";
import { useProject } from "../../project/model/project-context";
import {
  patchTheaterViewPrefs,
  readTheaterViewPrefs,
} from "../../theater/model/theater-view-prefs-storage";
import {
  requestTheaterDutyLight,
  THEATER_DUTY_LIGHT_EVENT,
  type TheaterDutyLightRequest,
} from "../../theater/model/theater-duty-light";
import {
  getTheaterLiveBlackoutEnabled,
  requestTheaterLiveBlackout,
  THEATER_LIVE_BLACKOUT_EVENT,
  type TheaterLiveBlackoutRequest,
} from "../../theater/model/theater-live-blackout";

type SchemeTabId = "light" | "requisites" | "video" | "projector";

const SCHEME_TABS: ReadonlyArray<{ id: SchemeTabId; label: string }> = [
  { id: "light", label: "Свет" },
  { id: "requisites", label: "Реквизит" },
  { id: "video", label: "Видео" },
  { id: "projector", label: "Проектор" },
];

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
  channelColumns?: number;
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
  channelColumns,
}: SpectacleRunSchemePaneProps) {
  const { projectName } = useProject();
  const [activeTab, setActiveTab] = useState<SchemeTabId>("light");
  const [dutyLightEnabled, setDutyLightEnabled] = useState(
    () => readTheaterViewPrefs(projectName).dutyLightEnabled,
  );
  const [liveBlackoutEnabled, setLiveBlackoutEnabled] = useState(
    () => getTheaterLiveBlackoutEnabled(),
  );
  const lightPlot = scene?.lightPlot ?? [];
  const theaterSpotlights = scene?.theaterSpotlights ?? [];
  const plotEmpty = theaterSpotlights.length === 0 && lightPlot.length === 0;
  const gridCols = 12;
  const gridRows = 20;

  useEffect(() => {
    setDutyLightEnabled(readTheaterViewPrefs(projectName).dutyLightEnabled);
  }, [projectName]);

  useEffect(() => {
    const onDutyLight = (event: Event) => {
      const enabled = (event as CustomEvent<TheaterDutyLightRequest>).detail?.enabled;
      if (typeof enabled !== "boolean") return;
      setDutyLightEnabled(enabled);
    };
    window.addEventListener(THEATER_DUTY_LIGHT_EVENT, onDutyLight);
    return () => window.removeEventListener(THEATER_DUTY_LIGHT_EVENT, onDutyLight);
  }, []);

  useEffect(() => {
    const onLiveBlackout = (event: Event) => {
      const enabled = (event as CustomEvent<TheaterLiveBlackoutRequest>).detail?.enabled;
      if (typeof enabled !== "boolean") return;
      setLiveBlackoutEnabled(enabled);
    };
    window.addEventListener(THEATER_LIVE_BLACKOUT_EVENT, onLiveBlackout);
    return () => window.removeEventListener(THEATER_LIVE_BLACKOUT_EVENT, onLiveBlackout);
  }, []);

  const kadrs = useMemo(
    () => readSceneLightKadrs(scene),
    [scene?.lightKadrs, scene?.id],
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
    if (!activeKadr || ENABLE_3D_THEATER) return null;
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
          В сцене «{tapeItem.sceneTitle}» пока нет картин. Добавьте первую.
        </p>
      </div>
    );
  }

  return (
    <div className="spectacle-run-scheme">
      <div
        className="spectacle-run-scheme__tabs"
        role="tablist"
        aria-label="Разделы спектакля"
      >
        {SCHEME_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn(
                "spectacle-run-scheme__tab",
                isActive && "spectacle-run-scheme__tab--active",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="spectacle-run-scheme__tab-panel" role="tabpanel">
        {activeTab === "light" ? (
          <>
            {plotEmpty ? (
              <div className="spectacle-run-scheme__plot-setup" role="note">
                <p className="spectacle-run-scheme__plot-setup-text">
                  <strong className="spectacle-run-scheme__plot-setup-title">
                    План софитов пуст
                  </strong>{" "}
                  — на схеме нечего подсвечивать. Картины — в прогоне, позиции софитов — в
                  3D-театре ниже.
                </p>
              </div>
            ) : null}

            <div className="light-scheme-layout spectacle-run-scheme__stage-row">
              {liveStatus ? (
                <span
                  className="spectacle-run-scheme__live-dot"
                  role="status"
                  title={liveStatus}
                  aria-label={liveStatus}
                />
              ) : null}
              {ENABLE_3D_THEATER ? (
                <SpectacleRunTheaterEmbed />
              ) : (
                <LightSchemeStageMap
                  fixtures={lightPlot}
                  gridCols={gridCols}
                  gridRows={gridRows}
                  lookModel={lookModel}
                  selectedLightSlot={selectedLightSlot}
                  highlightedChannel={null}
                  editable={false}
                  emptyPlotHint="Нет точек на плане. Расставьте софиты в 3D-театре."
                />
              )}
              <div className="spectacle-run-scheme__console-col">
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
                  channelColumns={channelColumns}
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
                <div
                  className="spectacle-run-scheme__live-actions"
                  role="group"
                  aria-label="Живой свет"
                >
                  <button
                    type="button"
                    className={cn(
                      "spectacle-run-scheme__live-action",
                      liveBlackoutEnabled && "spectacle-run-scheme__live-action--active",
                    )}
                    aria-pressed={liveBlackoutEnabled}
                    title={
                      liveBlackoutEnabled
                        ? "Снять блекаут — снова работают фейдеры"
                        : "Блекаут: погасить сцену, фейдеры не менять"
                    }
                    onClick={() => {
                      const nextEnabled = !liveBlackoutEnabled;
                      requestTheaterLiveBlackout(nextEnabled);
                      onLiveStatus?.(
                        nextEnabled
                          ? "Блекаут включён — сцена тёмная, фейдеры без изменений."
                          : "Блекаут снят — снова работают установленные фейдеры.",
                      );
                    }}
                  >
                    Блекаут
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "spectacle-run-scheme__live-action",
                      dutyLightEnabled && "spectacle-run-scheme__live-action--active",
                    )}
                    aria-pressed={dutyLightEnabled}
                    title={
                      dutyLightEnabled
                        ? "Выключить дежурный свет"
                        : "Включить дежурный свет"
                    }
                    onClick={() => {
                      const nextEnabled = !dutyLightEnabled;
                      patchTheaterViewPrefs(projectName, {
                        dutyLightEnabled: nextEnabled,
                      });
                      requestTheaterDutyLight(nextEnabled);
                    }}
                  >
                    Дежурка
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {activeTab === "requisites" ? (
          <SpectacleRunRequisitesPanel scene={scene} tapeItem={tapeItem} />
        ) : null}

        {activeTab === "video" ? (
          <SpectacleRunProjectorPanel mode="video" />
        ) : null}

        {activeTab === "projector" ? (
          <SpectacleRunProjectorPanel mode="projector" />
        ) : null}
      </div>
    </div>
  );
}
