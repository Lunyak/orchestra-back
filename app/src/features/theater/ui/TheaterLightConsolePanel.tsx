import { useEffect, useMemo, useRef, useState } from "react";
import { useScene, type SceneLightFadersDataV1, type SceneLightProgramsDataV1 } from "../../scene";
import {
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import type { TheaterSpotlight } from "../../../shared/types/script";
import { parseLightChannel } from "../../../shared/components/show-script/utils/lightTokens";
import { getSpotlightsBoundToFader } from "../model/theater-light-fader-bindings";

type TheaterLightConsolePanelProps = {
  projectName: string;
  spotlights: TheaterSpotlight[];
  updateSpotlights: (next: TheaterSpotlight[]) => void;
};

function createDefaultFaders(): SceneLightFadersDataV1 {
  return {
    v: 1,
    count: 8,
    faders: Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      label: `Фейдер ${index + 1}`,
      channel: index + 1,
      intensity: 1,
      enabled: true,
      links: [{ channel: index + 1 }],
    })),
  };
}

function createDefaultPrograms(): SceneLightProgramsDataV1 {
  return {
    v: 1,
    activeProgramId: 1,
    programs: [{ id: 1, label: "Программа 1", faders: [] }],
  };
}

function buildCompleteFaders(
  persisted: SceneLightFadersDataV1 | undefined,
  lightChannelsCount: number,
  spotlights: TheaterSpotlight[],
): SceneLightFadersDataV1 {
  const maxFaderId = Math.max(
    1,
    Math.trunc(Number(persisted?.count) || 8),
  );
  const byId = new Map<number, SceneLightFadersDataV1["faders"][number]>();
  for (let id = 1; id <= maxFaderId; id += 1) {
    byId.set(id, {
      id,
      label: `Фейдер ${id}`,
      channel: id,
      intensity: 1,
      enabled: true,
      links: [{ channel: id }],
    });
  }
  for (const fader of persisted?.faders ?? []) {
    byId.set(fader.id, {
      ...byId.get(fader.id),
      ...fader,
      label: fader.label || `Фейдер ${fader.id}`,
      channel: fader.channel ?? fader.links?.[0]?.channel ?? fader.id,
      links: fader.links?.length
        ? fader.links
        : [{ channel: fader.channel ?? fader.id, spotlightId: fader.spotlightId }],
    });
  }
  return {
    v: 1,
    count: maxFaderId,
    faders: Array.from(byId.values()).sort((a, b) => a.id - b.id),
  };
}

export function TheaterLightConsolePanel({
  projectName,
  spotlights,
  updateSpotlights,
}: TheaterLightConsolePanelProps) {
  const dispatch = useAppDispatch();
  const { sceneData, setSceneData } = useScene();
  const [collapsed, setCollapsed] = useState(false);
  const programSaveTimerRef = useRef<number | null>(null);
  const activeProgramIdRef = useRef<number | null>(null);
  const { lightChannels, selectedLightSlot } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );

  const faders = useMemo(
    () =>
      buildCompleteFaders(
        sceneData?.lightFaders && sceneData.lightFaders.v === 1
          ? sceneData.lightFaders
          : createDefaultFaders(),
        lightChannels.length,
        spotlights,
      ),
    [lightChannels.length, sceneData?.lightFaders, spotlights],
  );
  const programs =
    sceneData?.lightPrograms && sceneData.lightPrograms.v === 1
      ? sceneData.lightPrograms
      : createDefaultPrograms();
  const activeProgram =
    programs.programs.find((program) => program.id === programs.activeProgramId) ??
    programs.programs[0];
  const fadersSnapshotKey = useMemo(
    () =>
      JSON.stringify(
        faders.faders.map((fader) => ({
          faderId: fader.id,
          intensity: fader.intensity ?? 1,
          enabled: fader.enabled ?? true,
          color: fader.color,
        })),
      ),
    [faders.faders],
  );

  const getSpotlightsForFader = (fader: SceneLightFadersDataV1["faders"][number]) =>
    getSpotlightsBoundToFader(fader.id, spotlights);

  const updateFaders = (next: SceneLightFadersDataV1) => {
    setSceneData((prev) => ({
      ...(prev ?? {}),
      lightFaders: next,
    }));
  };

  const updatePrograms = (next: SceneLightProgramsDataV1) => {
    setSceneData((prev) => ({
      ...(prev ?? {}),
      lightPrograms: next,
    }));
  };

  const setFaderCount = (count: number) => {
    const nextCount = Math.max(1, Math.min(64, Math.trunc(count) || 1));
    const nextFaders = buildCompleteFaders(
      { ...faders, count: nextCount },
      lightChannels.length,
      spotlights,
    );
    updateFaders(nextFaders);
  };

  const patchSpotlightsForFader = (
    fader: SceneLightFadersDataV1["faders"][number],
    patch: Partial<Pick<TheaterSpotlight, "intensity" | "color">>,
  ) => {
    const affectedIds = new Set(getSpotlightsForFader(fader).map((spotlight) => spotlight.id));
    if (affectedIds.size === 0) return;
    updateSpotlights(
      spotlights.map((spotlight) =>
        affectedIds.has(spotlight.id) ? { ...spotlight, ...patch } : spotlight,
      ),
    );
  };

  const patchFader = (
    faderId: number,
    patch: Partial<SceneLightFadersDataV1["faders"][number]>,
  ) => {
    const nextFaders = faders.faders.map((fader) =>
      fader.id === faderId ? { ...fader, ...patch } : fader,
    );
    updateFaders({ ...faders, faders: nextFaders });

    const nextFader = nextFaders.find((item) => item.id === faderId);
    if (!nextFader) return;
    patchSpotlightsForFader(nextFader, {
      ...(patch.intensity != null ? { intensity: patch.intensity } : {}),
      ...(patch.color ? { color: patch.color } : {}),
    });
  };

  const applyProgram = (program = activeProgram) => {
    if (!program) return;
    const stateByFader = new Map(
      program.faders.map((state) => [state.faderId, state]),
    );
    updateFaders({
      v: 1,
      count: faders.count,
      faders: faders.faders.map((fader) => {
        const state = stateByFader.get(fader.id);
        return state
          ? {
              ...fader,
              intensity: state.intensity ?? fader.intensity,
              enabled: state.enabled ?? fader.enabled,
              color: state.color ?? fader.color,
            }
          : fader;
      }),
    });
    const patchBySpotlightId = new Map<number, Partial<TheaterSpotlight>>();
    for (const fader of faders.faders) {
      const state = stateByFader.get(fader.id);
      if (!state) continue;
      for (const spotlight of getSpotlightsForFader(fader)) {
        patchBySpotlightId.set(spotlight.id, {
          intensity: state.intensity ?? spotlight.intensity,
          color: state.color ?? spotlight.color,
        });
      }
    }
    if (patchBySpotlightId.size > 0) {
      updateSpotlights(
        spotlights.map((spotlight) => ({
          ...spotlight,
          ...(patchBySpotlightId.get(spotlight.id) ?? {}),
        })),
      );
    }
  };

  const saveProgramSnapshot = () => {
    if (!activeProgram) return;
    const snapshot = faders.faders.map((fader) => ({
      faderId: fader.id,
      intensity: fader.intensity ?? 1,
      enabled: fader.enabled ?? true,
      color: fader.color,
    }));
    updatePrograms({
      ...programs,
      programs: programs.programs.map((program) =>
        program.id === activeProgram.id ? { ...program, faders: snapshot } : program,
      ),
    });
  };

  useEffect(() => {
    if (!activeProgram) return;
    if (activeProgramIdRef.current !== activeProgram.id) {
      activeProgramIdRef.current = activeProgram.id;
      return;
    }
    if (programSaveTimerRef.current != null) {
      window.clearTimeout(programSaveTimerRef.current);
    }
    programSaveTimerRef.current = window.setTimeout(() => {
      saveProgramSnapshot();
      programSaveTimerRef.current = null;
    }, 550);
    return () => {
      if (programSaveTimerRef.current != null) {
        window.clearTimeout(programSaveTimerRef.current);
      }
    };
  }, [activeProgram?.id, fadersSnapshotKey]);

  return (
    <section
      className="theater-light-console"
      data-collapsed={collapsed}
      aria-label="Пульт света"
    >
      <button
        type="button"
        className="theater-light-console__toggle"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <span>Пульт света</span>
        <span>{collapsed ? "▴" : "▾"}</span>
      </button>

      {!collapsed ? (
        <div className="theater-light-console__body">
          <div className="theater-light-console__program-bar">
            {programs.programs.map((program) => (
              <button
                key={program.id}
                type="button"
                className="theater-light-console__program"
                data-active={program.id === activeProgram?.id}
                title={program.label}
                onClick={() => {
                  updatePrograms({ ...programs, activeProgramId: program.id });
                  applyProgram(program);
                }}
              >
                {program.id}
              </button>
            ))}
            <label className="theater-light-console__fader-count">
              <span>F</span>
              <input
                type="number"
                min={1}
                max={64}
                value={faders.count ?? faders.faders.length}
                onChange={(event) => setFaderCount(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="theater-light-console__main">
            <aside className="theater-light-console__left">
              <div className="theater-light-console__channels">
                {lightChannels.map((raw, index) => {
                  const channel = index + 1;
                  const parsed = parseLightChannel(raw);
                  const label = parsed.label || `Канал ${channel}`;
                  return (
                    <button
                      key={channel}
                      type="button"
                      className="theater-light-console__channel"
                      data-active={selectedLightSlot === channel}
                      onClick={() =>
                        dispatch(
                          showScriptMarkdownActions.setSelectedLightSlot({
                            projectSlug: projectName,
                            sceneName: "script",
                            slot: channel,
                          }),
                        )
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="theater-light-console__faders">
              {faders.faders.map((fader) => {
                const linkedSpotlight =
                  (fader.spotlightId != null
                    ? spotlights.find((item) => item.id === fader.spotlightId)
                  : null) ?? getSpotlightsForFader(fader)[0];
                const storedValue = fader.intensity ?? linkedSpotlight?.intensity ?? 1;
                const muted = fader.enabled === false;
                const value = muted ? 0 : storedValue;
                const color = /^#[0-9a-f]{6}$/i.test(String(fader.color ?? linkedSpotlight?.color ?? "").trim())
                  ? String(fader.color ?? linkedSpotlight?.color).trim()
                  : "#ffffff";
                return (
                  <div key={fader.id} className="theater-light-console-fader">
                    <button
                      type="button"
                      className="theater-light-console-fader__power"
                      data-active={!muted}
                      onClick={() => {
                        const nextMuted = !muted;
                        patchFader(fader.id, {
                          enabled: !nextMuted,
                          intensity: nextMuted ? 0 : Math.max(storedValue, 1),
                        });
                      }}
                      title={muted ? "Вернуть яркость фейдера" : "Фейдер в 0%"}
                    />
                    <input
                      className="theater-light-console-fader__range"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={value}
                      onChange={(event) => {
                        const intensity = Number(event.target.value);
                        patchFader(fader.id, {
                          intensity,
                          enabled: intensity > 0,
                        });
                      }}
                    />
                    <input
                      className="theater-light-console-fader__color"
                      type="color"
                      value={color}
                      onChange={(event) => patchFader(fader.id, { color: event.target.value })}
                      title="Цвет фейдера"
                    />
                    <span className="theater-light-console-fader__value">
                      {Math.round(value * 100)}
                    </span>
                    <span className="theater-light-console-fader__name">
                      {fader.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
