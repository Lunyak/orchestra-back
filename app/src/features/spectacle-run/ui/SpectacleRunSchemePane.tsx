import cn from "classnames";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import { useSpectacleRunSchemeTab } from "../model/spectacle-run-scheme-tab-context";
import { SPECTACLE_RUN_SCHEME_TABS } from "../model/spectacle-run-scheme-tab";

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
  const { activeTab, setActiveTab } = useSpectacleRunSchemeTab();
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

  const stageRowRef = useRef<HTMLDivElement | null>(null);
  const consoleWidthRef = useRef<number>(320);

  const CONSOLE_WIDTH_VAR = "--spectacle-run-scheme-console-width";
  const CONSOLE_MIN_WIDTH_PX = 260;
  const CONSOLE_SPLITTER_PX = 12;
  const STAGE_MIN_WIDTH_PX = 480;

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const applyConsoleWidth = useCallback((px: number) => {
    const el = stageRowRef.current;
    if (!el) return;
    const next = Math.round(px);
    consoleWidthRef.current = next;
    el.style.setProperty(CONSOLE_WIDTH_VAR, `${next}px`);
  }, []);

  useEffect(() => {
    const el = stageRowRef.current;
    if (!el) return;

    const containerWidth = el.getBoundingClientRect().width;
    const maxByStage = Math.max(
      CONSOLE_MIN_WIDTH_PX,
      containerWidth - STAGE_MIN_WIDTH_PX - CONSOLE_SPLITTER_PX,
    );
    const desired = containerWidth * 0.38;
    const initial = clamp(desired, CONSOLE_MIN_WIDTH_PX, maxByStage);
    applyConsoleWidth(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => {
      const el = stageRowRef.current;
      if (!el) return;
      const containerWidth = el.getBoundingClientRect().width;
      const maxByStage = Math.max(
        CONSOLE_MIN_WIDTH_PX,
        containerWidth - STAGE_MIN_WIDTH_PX - CONSOLE_SPLITTER_PX,
      );
      applyConsoleWidth(clamp(consoleWidthRef.current, CONSOLE_MIN_WIDTH_PX, maxByStage));
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [applyConsoleWidth]);

  const onSplitterPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const el = stageRowRef.current;
      if (!el) return;

      event.preventDefault();
      const containerWidth = el.getBoundingClientRect().width;
      const startX = event.clientX;
      const startConsole = consoleWidthRef.current;

      const maxByStage = Math.max(
        CONSOLE_MIN_WIDTH_PX,
        containerWidth - STAGE_MIN_WIDTH_PX - CONSOLE_SPLITTER_PX,
      );

      el.dataset.dragging = "true";
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        // Moving splitter to the right => console shrinks.
        const next = startConsole - deltaX;
        applyConsoleWidth(clamp(next, CONSOLE_MIN_WIDTH_PX, maxByStage));
      };

      const onUp = () => {
        delete el.dataset.dragging;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onUp, { once: true });
      window.addEventListener("pointercancel", onUp, { once: true });
    },
    [applyConsoleWidth],
  );

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
        {SPECTACLE_RUN_SCHEME_TABS.map((tab) => {
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

            <div
              ref={stageRowRef}
              className="spectacle-run-scheme__stage-row spectacle-run-scheme__stage-row--resizable"
            >
              {liveStatus ? (
                <span
                  className="spectacle-run-scheme__live-dot"
                  role="status"
                  title={liveStatus}
                  aria-label={liveStatus}
                />
              ) : null}
              <div className="spectacle-run-scheme__stage-col">
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
              </div>

              <div
                className="spectacle-run-scheme__splitter"
                role="separator"
                aria-orientation="vertical"
                aria-label="Ширина пульта"
                onPointerDown={onSplitterPointerDown}
              />

              <div className="spectacle-run-scheme__console-col spectacle-run-scheme__console-col--resizable">
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
