import {
  useScene,
  type SceneLightFaderV1,
  type SceneLightFadersDataV1,
  type SceneLightProgramsDataV1,
} from "../../../../features/scene";
import type { TheaterSpotlight } from "../../../types/script";
import {
  getSpotlightsBoundToFader,
  spotlightMatchesFader,
} from "../../../../features/theater/model/theater-light-fader-bindings";
import { parseLightChannel } from "../utils/lightTokens";

const DEFAULT_SPOTLIGHT_INTENSITY = 2;

export type ScriptLightChannelsPanelProps = {
  lightChannels: string[];
  selectedLightSlot: number;
  lightFaders?: SceneLightFadersDataV1 | null;
  onLightChannelsChange: (next: string[]) => void;
  onSelectedLightSlotChange: (slot: number) => void;
  onLightFadersChange?: (next: SceneLightFadersDataV1) => void;
  spotlights?: TheaterSpotlight[];
  onSpotlightsChange?: (next: TheaterSpotlight[]) => void;
  onInsertText: (text: string) => void;
};

function createDefaultFaders(): SceneLightFadersDataV1 {
  return {
    v: 1,
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
    programs: [
      {
        id: 1,
        label: "Программа 1",
        faders: [],
      },
    ],
  };
}

function normalizeChannelColor(raw: string | null | undefined, fallback = "#facc15") {
  return /^#[0-9a-f]{6}$/i.test(String(raw ?? "").trim())
    ? String(raw).trim()
    : fallback;
}

function findSpotlightForFader(
  fader: SceneLightFaderV1,
  spotlights: TheaterSpotlight[],
): TheaterSpotlight | undefined {
  const bound = getSpotlightsBoundToFader(fader, spotlights);
  if (bound.length > 0) return bound[0];
  if (fader.spotlightId != null) {
    const byId = spotlights.find((item) => item.id === fader.spotlightId);
    if (byId && spotlightMatchesFader(byId, fader)) return byId;
  }
  return undefined;
}

function createSpotlightForChannel(args: {
  id: number;
  channel: number;
  label: string;
  color: string;
  faderId: number;
  intensity?: number;
  enabled?: boolean;
}): TheaterSpotlight {
  const spread = (args.channel - 1) * 1.15;
  const x = ((args.channel - 1) % 5 - 2) * 1.8;
  const z = 4 + Math.floor(spread / 5) * 0.9;
  return {
    id: args.id,
    label: args.label || `Софит ${args.id}`,
    position: [x, 6, z],
    target: [x * 0.45, 1, 1],
    angleDeg: 22,
    intensity: args.intensity ?? DEFAULT_SPOTLIGHT_INTENSITY,
    color: args.color,
    enabled: args.enabled ?? true,
    channel: args.channel,
    faderId: args.faderId,
    isRgb: false,
  };
}

export function ScriptLightChannelsPanel({
  lightChannels,
  selectedLightSlot,
  lightFaders: externalLightFaders,
  onLightChannelsChange,
  onSelectedLightSlotChange,
  onLightFadersChange: externalOnLightFadersChange,
  spotlights,
  onSpotlightsChange,
  onInsertText,
}: ScriptLightChannelsPanelProps) {
  const { sceneData, setSceneData } = useScene();
  const selectedSlot =
    selectedLightSlot >= 1 && selectedLightSlot <= lightChannels.length
      ? selectedLightSlot
      : 1;
  const faders =
    externalLightFaders ??
    (sceneData?.lightFaders && sceneData.lightFaders.v === 1
      ? sceneData.lightFaders
      : createDefaultFaders());
  const programs =
    sceneData?.lightPrograms && sceneData.lightPrograms.v === 1
      ? sceneData.lightPrograms
      : createDefaultPrograms();
  const onLightFadersChange = (next: SceneLightFadersDataV1) => {
    if (externalOnLightFadersChange) {
      externalOnLightFadersChange(next);
      return;
    }
    setSceneData((prev) => ({
      ...(prev ?? {}),
      lightFaders: next,
    }));
  };
  const onLightProgramsChange = (next: SceneLightProgramsDataV1) => {
    setSceneData((prev) => ({
      ...(prev ?? {}),
      lightPrograms: next,
    }));
  };
  const syncSpotlightsForFaders = (
    nextFaders: SceneLightFaderV1[],
    options?: { ensureMissing?: boolean },
  ) => {
    if (!spotlights || !onSpotlightsChange) return;
    let nextSpotlights = spotlights.map((item) => ({ ...item }));
    let nextId = nextSpotlights.reduce((acc, item) => Math.max(acc, item.id), 0);

    for (const fader of nextFaders) {
      const channel = fader.channel ?? fader.links[0]?.channel;
      if (!channel) continue;
      const parsed = parseLightChannel(lightChannels[channel - 1] ?? "");
      const color = normalizeChannelColor(fader.color ?? parsed.color, "#facc15");
      const spotlight = findSpotlightForFader(fader, nextSpotlights);

      if (spotlight) {
        nextSpotlights = nextSpotlights.map((item) =>
          item.id === spotlight.id
            ? {
                ...item,
                channel,
                faderId: fader.id,
                color,
              }
            : item,
        );
        continue;
      }

      if (!options?.ensureMissing) continue;
      nextId += 1;
      nextSpotlights.push(
        createSpotlightForChannel({
          id: nextId,
          channel,
          label: `Софит ${nextId}`,
          color,
          faderId: fader.id,
        }),
      );
    }

    onSpotlightsChange(nextSpotlights);
  };

  const setLightFadersSynced = (
    next: SceneLightFadersDataV1,
    options?: { syncSpotlights?: boolean; ensureMissingSpotlights?: boolean },
  ) => {
    onLightFadersChange(next);
    if (options?.syncSpotlights) {
      syncSpotlightsForFaders(next.faders, {
        ensureMissing: options.ensureMissingSpotlights,
      });
    }
  };
  const syncChannelToSpotlights = (slot: number, raw: string) => {
    if (!spotlights || !onSpotlightsChange) return;
    const parsed = parseLightChannel(raw);
    const color = normalizeChannelColor(parsed.color, "");
    onSpotlightsChange(
      spotlights.map((spotlight) =>
        spotlight.channel === slot
          ? {
              ...spotlight,
              ...(color ? { color } : {}),
            }
          : spotlight,
      ),
    );
  };
  const activeProgram =
    programs.programs.find((program) => program.id === programs.activeProgramId) ??
    programs.programs[0];

  return (
    <section className="script-light-panel">
      <header className="script-light-panel__header">
        <div>
          <div className="script-light-panel__title">Световые каналы</div>
          <div className="script-light-panel__hint">
            Каналов: <span>{lightChannels.length}</span> · активный канал: <span>{selectedSlot}</span>
          </div>
        </div>
        <div className="script-light-panel__actions">
          <button
            type="button"
            className="script-light-action-btn"
            onClick={() => onInsertText(`{{light:${selectedSlot}}}`)}
          >
            Вставить
          </button>
          <button
            type="button"
            className="script-light-action-btn"
            onClick={() => {
              const channel = lightChannels.length + 1;
              const nextChannels = [...lightChannels, `Канал ${channel}`];
              const nextFaders = faders.faders.some((fader) => fader.id === channel)
                ? faders.faders
                : [
                    ...faders.faders,
                    {
                      id: channel,
                      label: `Фейдер ${channel}`,
                      channel,
                      intensity: 1,
                      enabled: true,
                      links: [{ channel }],
                    },
                  ];
              onLightChannelsChange(nextChannels);
              setLightFadersSynced(
                { v: 1, faders: nextFaders },
                { syncSpotlights: true, ensureMissingSpotlights: true },
              );
              onSelectedLightSlotChange(channel);
            }}
          >
            + канал
          </button>
          <button
            type="button"
            className="script-light-action-btn"
            disabled={lightChannels.length <= 1}
            onClick={() => {
              const next = lightChannels.slice(0, -1);
              onLightChannelsChange(next);
              setLightFadersSynced({
                v: 1,
                faders: faders.faders.map((fader) => ({
                  ...fader,
                  links: fader.links.filter((link) => link.channel <= next.length),
                  channel:
                    fader.channel != null && fader.channel > next.length
                      ? undefined
                      : fader.channel,
                })),
              }, { syncSpotlights: true });
              if (selectedSlot > next.length) {
                onSelectedLightSlotChange(Math.max(1, next.length));
              }
            }}
          >
            - канал
          </button>
        </div>
      </header>

      <div className="script-light-grid">
        {lightChannels.map((value, index) => {
          const slot = index + 1;
          const parsed = parseLightChannel(value);
          const hexColor = /^#[0-9a-f]{6}$/i.test(String(parsed.color ?? "").trim())
            ? String(parsed.color).trim()
            : "#4f8cff";

          return (
            <label
              key={`light-${slot}`}
              className="script-light-cell"
              data-selected={selectedLightSlot === slot}
            >
              <span className="script-light-cell__slot">{slot}</span>
              <input
                type="text"
                className="script-light-input"
                value={parsed.label}
                onFocus={() => onSelectedLightSlotChange(slot)}
                onChange={(event) => {
                  const next = [...lightChannels];
                  const nextLabel = event.target.value;
                  const colorPart = parsed.color ? `|${parsed.color}` : "";
                  next[index] = `${nextLabel}${colorPart}`;
                  onLightChannelsChange(next);
                  syncChannelToSpotlights(slot, next[index]);
                }}
                placeholder={`Канал ${slot}`}
              />
              <input
                type="color"
                className="script-light-color"
                value={hexColor}
                onFocus={() => onSelectedLightSlotChange(slot)}
                onChange={(event) => {
                  const next = [...lightChannels];
                  const nextColor = event.target.value;
                  const nextLabel = parsed.label ?? "";
                  next[index] = `${nextLabel}|${nextColor}`;
                  onLightChannelsChange(next);
                  syncChannelToSpotlights(slot, next[index]);
                }}
                title={`Цвет канала ${slot}`}
              />
            </label>
          );
        })}
      </div>

      <section className="script-light-faders" aria-label="Пульт света">
        <header className="script-light-faders__header">
          <div>
            <div className="script-light-panel__title">Пульт</div>
            <div className="script-light-panel__hint">
              Фейдер равен софиту: у него есть канал, привязанный 3D-софит и состояние.
            </div>
          </div>
          <button
            type="button"
            className="script-light-action-btn"
            onClick={() =>
              setLightFadersSynced(
                {
                  v: 1,
                  faders: [
                    ...faders.faders,
                    {
                      id: (faders.faders.reduce((acc, item) => Math.max(acc, item.id), 0) || 0) + 1,
                      label: `Фейдер ${faders.faders.length + 1}`,
                      intensity: 1,
                      enabled: true,
                      links: [],
                    },
                  ],
                },
                { syncSpotlights: true },
              )
            }
          >
            + фейдер
          </button>
        </header>

        <div className="script-light-fader-list">
          {faders.faders.map((fader, index) => {
            const selectedChannel = fader.channel ?? fader.links[0]?.channel ?? "";
            const faderColor = /^#[0-9a-f]{6}$/i.test(String(fader.color ?? "").trim())
              ? String(fader.color).trim()
              : "#ffffff";
            return (
              <div key={fader.id} className="script-light-fader-row">
                <span className="script-light-fader-row__num">{index + 1}</span>
                <input
                  className="script-light-input"
                  value={fader.label}
                  onChange={(event) => {
                    const nextFaders = faders.faders.map((item) =>
                      item.id === fader.id ? { ...item, label: event.target.value } : item,
                    );
                    setLightFadersSynced({ v: 1, faders: nextFaders }, { syncSpotlights: true });
                  }}
                  placeholder={`Фейдер ${index + 1}`}
                />
                <select
                  className="script-light-select"
                  value={selectedChannel}
                  onChange={(event) => {
                    const channel = Number(event.target.value);
                    const links = Number.isFinite(channel) && channel > 0 ? [{ channel }] : [];
                    const nextFaders = faders.faders.map((item) =>
                      item.id === fader.id ? { ...item, channel: links[0]?.channel, links } : item,
                    );
                    setLightFadersSynced(
                      { v: 1, faders: nextFaders },
                      { syncSpotlights: true, ensureMissingSpotlights: true },
                    );
                  }}
                >
                  <option value="">Без канала</option>
                  {lightChannels.map((value, channelIndex) => {
                    const channel = channelIndex + 1;
                    const label = parseLightChannel(value).label || `Канал ${channel}`;
                    return (
                      <option key={channel} value={channel}>
                        {channel}: {label}
                      </option>
                    );
                  })}
                </select>
                <label className="script-light-fader-meter">
                  <span>{Math.round((fader.intensity ?? 1) * 100)}%</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={fader.intensity ?? 1}
                    onChange={(event) => {
                      const intensity = Number(event.target.value);
                      const nextFaders = faders.faders.map((item) =>
                        item.id === fader.id ? { ...item, intensity } : item,
                      );
                      setLightFadersSynced({ v: 1, faders: nextFaders }, { syncSpotlights: true });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="script-light-action-btn"
                  data-active={fader.enabled !== false}
                  onClick={() => {
                    const nextFaders = faders.faders.map((item) =>
                      item.id === fader.id ? { ...item, enabled: !(item.enabled ?? true) } : item,
                    );
                    setLightFadersSynced({ v: 1, faders: nextFaders }, { syncSpotlights: true });
                  }}
                >
                  {fader.enabled === false ? "off" : "on"}
                </button>
                <input
                  type="color"
                  className="script-light-color"
                  value={faderColor}
                  title={`Цвет ползунка ${fader.id}`}
                  onChange={(event) => {
                    const color = event.target.value;
                    const nextFaders = faders.faders.map((item) =>
                      item.id === fader.id ? { ...item, color } : item,
                    );
                    setLightFadersSynced({ v: 1, faders: nextFaders }, { syncSpotlights: true });
                  }}
                />
                <button
                  type="button"
                  className="script-light-action-btn"
                  disabled={faders.faders.length <= 1}
                  onClick={() =>
                    setLightFadersSynced(
                      {
                        v: 1,
                        faders: faders.faders.filter((item) => item.id !== fader.id),
                      },
                      { syncSpotlights: true },
                    )
                  }
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="script-light-faders" aria-label="Программы света">
        <header className="script-light-faders__header">
          <div>
            <div className="script-light-panel__title">Программы</div>
            <div className="script-light-panel__hint">
              Программы общие для всей сцены: сохраняют состояния фейдеров и действуют на все шаги.
            </div>
          </div>
          <button
            type="button"
            className="script-light-action-btn"
            onClick={() => {
              const nextId = (programs.programs.reduce((acc, item) => Math.max(acc, item.id), 0) || 0) + 1;
              onLightProgramsChange({
                v: 1,
                activeProgramId: nextId,
                programs: [
                  ...programs.programs,
                  {
                    id: nextId,
                    label: `Программа ${programs.programs.length + 1}`,
                    faders: [],
                  },
                ],
              });
            }}
          >
            + программа
          </button>
        </header>

        <div className="script-light-program-list">
          {programs.programs.map((program) => (
            <button
              key={program.id}
              type="button"
              className="script-light-program-btn"
              data-active={program.id === activeProgram?.id}
              onClick={() =>
                onLightProgramsChange({
                  ...programs,
                  activeProgramId: program.id,
                })
              }
            >
              {program.label}
            </button>
          ))}
        </div>

        {activeProgram ? (
          <div className="script-light-program-editor">
            <input
              className="script-light-input"
              value={activeProgram.label}
              onChange={(event) =>
                onLightProgramsChange({
                  ...programs,
                  programs: programs.programs.map((program) =>
                    program.id === activeProgram.id
                      ? { ...program, label: event.target.value }
                      : program,
                  ),
                })
              }
            />
            <div className="script-light-panel__actions">
              <button
                type="button"
                className="script-light-action-btn"
                onClick={() => {
                  const snapshot = faders.faders.map((fader) => ({
                    faderId: fader.id,
                    intensity: fader.intensity ?? 1,
                    enabled: fader.enabled ?? true,
                    color: fader.color,
                  }));
                  onLightProgramsChange({
                    ...programs,
                    programs: programs.programs.map((program) =>
                      program.id === activeProgram.id
                        ? { ...program, faders: snapshot }
                        : program,
                    ),
                  });
                }}
              >
                Сохранить состояние
              </button>
              <button
                type="button"
                className="script-light-action-btn"
                onClick={() => {
                  const stateByFader = new Map(
                    activeProgram.faders.map((state) => [state.faderId, state]),
                  );
                  onLightFadersChange({
                    v: 1,
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
                }}
              >
                Применить
              </button>
              <button
                type="button"
                className="script-light-action-btn"
                disabled={programs.programs.length <= 1}
                onClick={() => {
                  const nextPrograms = programs.programs.filter((program) => program.id !== activeProgram.id);
                  onLightProgramsChange({
                    v: 1,
                    activeProgramId: nextPrograms[0]?.id,
                    programs: nextPrograms,
                  });
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
