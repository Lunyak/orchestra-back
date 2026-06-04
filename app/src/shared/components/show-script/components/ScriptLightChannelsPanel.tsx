import {
  useScene,
  type SceneLightFaderV1,
  type SceneLightFadersDataV1,
} from "../../../../features/scene";
import type { TheaterSpotlight } from "../../../types/script";
import {
  getSpotlightsBoundToFader,
  spotlightMatchesFader,
} from "../../../../features/theater/model/theater-light-fader-bindings";
import { appendLightChannel, removeLastLightChannel } from "../../light-console/light-channels-mutate";
import { formatChannelShort, formatFaderDefaultLabel } from "../../light-console/light-console-labels";
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
      label: formatFaderDefaultLabel(index + 1),
      channel: index + 1,
      intensity: 1,
      enabled: true,
      links: [{ channel: index + 1 }],
    })),
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

/** Сетка K1–K8: подписи и цвета каналов (пульт F/P — в LightKadrPanel). */
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

  return (
    <section className="script-light-channels" aria-label="Световые каналы">
      <header className="script-light-channels__header">
        <div>
          <div className="script-light-channels__title">Каналы K</div>
          <div className="script-light-channels__hint">
            Всего: <span>{lightChannels.length}</span> · активный:{" "}
            <span>{formatChannelShort(selectedSlot)}</span>
          </div>
        </div>
        <div className="script-light-channels__actions">
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
              const nextChannels = appendLightChannel(lightChannels);
              if (nextChannels.length === lightChannels.length) return;
              const channel = nextChannels.length;
              const nextFaders = faders.faders.some((fader) => fader.id === channel)
                ? faders.faders
                : [
                    ...faders.faders,
                    {
                      id: channel,
                      label: formatFaderDefaultLabel(channel),
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
            + K
          </button>
          <button
            type="button"
            className="script-light-action-btn"
            disabled={lightChannels.length <= 1}
            onClick={() => {
              const next = removeLastLightChannel(lightChannels);
              if (!next) return;
              onLightChannelsChange(next);
              setLightFadersSynced(
                {
                  v: 1,
                  faders: faders.faders.map((fader) => ({
                    ...fader,
                    links: fader.links.filter((link) => link.channel <= next.length),
                    channel:
                      fader.channel != null && fader.channel > next.length
                        ? undefined
                        : fader.channel,
                  })),
                },
                { syncSpotlights: true },
              );
              if (selectedSlot > next.length) {
                onSelectedLightSlotChange(Math.max(1, next.length));
              }
            }}
          >
            − K
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
              <span className="script-light-cell__slot">{formatChannelShort(slot)}</span>
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
                placeholder={formatChannelShort(slot)}
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
                title={`Цвет ${formatChannelShort(slot)}`}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
