import { useCallback, useMemo, useRef, useState } from "react";
import { useScene } from "../../../features/scene";
import { useProject } from "../../../features/project/model/project-context";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../../features/show-script-markdown/model/show-script-markdown-slice";
import { LightFixture, ScriptStep } from "../../types/script";
import {
  countStepLightChannelLinks,
  fixtureMatchesChannelSlot,
  mergeLightPlotFromSpotlights,
  mergeSpotlightsFromLightPlot,
} from "../../../features/theater/model/theater-light-channel-link";
import { LightChannelSelect } from "../../../features/theater/ui/LightChannelSelect";
import { LightCueTimeline, readStepLightCues } from "./LightCueTimeline";
import { normalizeLightCues, formatLightCuesMarkdown } from "../../../features/theater/model/theater-light-cues";
import "./style.css";

export const LightPlotPage = () => {
  const { projectName } = useProject();
  const { steps, currentPage, updateStep } = useScene();
  const { lightChannels, selectedLightSlot } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );
  const theaterLayout = useAppSelector((state) => state.scene.theaterLayout);

  const [newLightLabel, setNewLightLabel] = useState("");
  const [newLightChannel, setNewLightChannel] = useState("");
  const [newLightX, setNewLightX] = useState(1);
  const [newLightY, setNewLightY] = useState(1);
  const [newLightAngle, setNewLightAngle] = useState(0);
  const [newLightLength, setNewLightLength] = useState(54);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const draggingIdRef = useRef<number | null>(null);
  const lightGridCols = 12;
  const lightGridRows = 20;
  const currentStep = steps[currentPage];
  const lightPlot = currentStep?.lightPlot ?? [];
  const spotlights = currentStep?.theaterSpotlights ?? [];
  const lightCues = useMemo(
    () => readStepLightCues(currentStep),
    [currentStep?.lightCues, currentStep?.id],
  );

  const linkStats = useMemo(
    () => countStepLightChannelLinks(lightPlot, spotlights),
    [lightPlot, spotlights],
  );

  const normalizeLightPlot = useCallback(
    (items: LightFixture[]) =>
      items.map((item) => ({
        ...item,
        label: item.label?.trim() || `Софит ${item.id}`,
        channel: item.channel?.trim() ?? "",
        x: Math.max(1, Math.min(lightGridCols, Math.trunc(item.x))),
        y: Math.max(1, Math.min(lightGridRows, Math.trunc(item.y))),
        angle: Number.isFinite(item.angle) ? item.angle : 0,
        length: Number.isFinite(item.length) ? item.length : 54,
      })),
    [lightGridCols, lightGridRows],
  );

  const updateCurrentStepPlot = useCallback(
    (nextPlot: LightFixture[]) => {
      if (!currentStep) return;
      const normalized = normalizeLightPlot(nextPlot);
      updateStep(currentStep.id, { lightPlot: normalized } as Partial<ScriptStep>);
    },
    [currentStep, normalizeLightPlot, updateStep],
  );

  const syncToTheater = useCallback(() => {
    if (!currentStep || lightPlot.length === 0) {
      setLinkMessage("Схема света пуста");
      return;
    }
    const merged = mergeSpotlightsFromLightPlot(
      lightPlot,
      spotlights,
      theaterLayout,
      lightChannels,
      lightGridCols,
      lightGridRows,
    );
    updateStep(currentStep.id, {
      theaterSpotlights: merged,
      theaterActiveSpotlightId: merged[0]?.id,
    });
    setLinkMessage(`3D-сцена обновлена (${lightPlot.length} поз.)`);
  }, [
    currentStep,
    lightChannels,
    lightGridCols,
    lightGridRows,
    lightPlot,
    spotlights,
    theaterLayout,
    updateStep,
  ]);

  const syncFromTheater = useCallback(() => {
    if (!currentStep || spotlights.length === 0) {
      setLinkMessage("На шаге нет 3D-софитов");
      return;
    }
    const merged = mergeLightPlotFromSpotlights(
      spotlights,
      lightPlot,
      theaterLayout,
      lightGridCols,
      lightGridRows,
    );
    updateCurrentStepPlot(merged);
    setLinkMessage(`Схема обновлена из 3D (${spotlights.length} софитов)`);
  }, [
    currentStep,
    lightGridCols,
    lightGridRows,
    lightPlot,
    spotlights,
    theaterLayout,
    updateCurrentStepPlot,
  ]);

  const copyLightCuesToClipboard = useCallback(async () => {
    const text = formatLightCuesMarkdown(lightCues, {
      stepTitle: currentStep?.title?.trim() || undefined,
      durationMin: currentStep?.durationMin,
      lightChannels,
    });
    try {
      await navigator.clipboard.writeText(text);
      setLinkMessage("Таймлайн cue скопирован");
    } catch {
      setLinkMessage("Не удалось скопировать cue");
    }
  }, [
    currentStep?.durationMin,
    currentStep?.title,
    lightChannels,
    lightCues,
  ]);

  const addLightFixture = () => {
    const label = newLightLabel.trim();
    const channel = newLightChannel.trim();
    const nextId =
      lightPlot.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem: LightFixture = {
      id: nextId,
      label: label || `Софит ${nextId}`,
      channel,
      x: Math.max(1, Math.min(lightGridCols, Math.trunc(newLightX))),
      y: Math.max(1, Math.min(lightGridRows, Math.trunc(newLightY))),
      angle: Number.isFinite(newLightAngle) ? newLightAngle : 0,
      length: Number.isFinite(newLightLength) ? newLightLength : 54,
    };
    updateCurrentStepPlot([...lightPlot, nextItem]);
    setNewLightLabel("");
    setNewLightChannel("");
    setNewLightAngle(0);
    setNewLightLength(54);
  };

  const updateLightFixture = <K extends keyof LightFixture>(
    id: number,
    field: K,
    value: LightFixture[K],
  ) => {
    updateCurrentStepPlot(
      lightPlot.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const updateLightAim = useCallback(
    (id: number, angle: number, length: number) => {
      updateCurrentStepPlot(
        lightPlot.map((item) =>
          item.id === id ? { ...item, angle, length } : item,
        ),
      );
    },
    [lightPlot, updateCurrentStepPlot],
  );

  const copyFromPreviousStep = () => {
    if (!currentStep || currentPage <= 0) return;
    const previous = steps[currentPage - 1];
    const source = previous?.lightPlot ?? [];
    const cloned = source.map((item) => ({ ...item }));
    updateCurrentStepPlot(cloned);
  };

  const removeLightFixture = (fixtureId: number) => {
    updateCurrentStepPlot(lightPlot.filter((item) => item.id !== fixtureId));
  };

  const updateAimFromEvent = (
    fixtureId: number,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalizedAngle = Math.round((angle + 360) % 360);
    const length = Math.max(10, Math.round(Math.hypot(dx, dy)));
    updateLightAim(fixtureId, normalizedAngle, length);
  };

  return (
    <div className="light-plot-page">
      <div className="light-plot-panel">
        <div className="light-plot-header">
          <span>Схема света</span>
          <div className="light-plot-actions">
            <button
              type="button"
              className="light-plot-action"
              onClick={copyFromPreviousStep}
              disabled={!currentStep || currentPage === 0}
              title="Скопировать схему из предыдущего шага"
            >
              Скопировать из прошлого шага
            </button>
            <button
              type="button"
              className="light-plot-action"
              onClick={syncFromTheater}
              disabled={!currentStep || spotlights.length === 0}
              title="Обновить схему по позициям 3D-софитов на шаге"
            >
              ← из 3D
            </button>
            <button
              type="button"
              className="light-plot-action"
              onClick={syncToTheater}
              disabled={!currentStep || lightPlot.length === 0}
              title="Обновить 3D-софиты на текущем шаге по позициям схемы"
            >
              → 3D-сцена
            </button>
          </div>
        </div>
        <p className="light-plot-link-hint">
          Каналы 1–8 совпадают с подсветкой в сценарии. На шаге: схема {linkStats.fixtures},
          3D {linkStats.spotlights}, слотов {linkStats.linkedSlots}.
          {selectedLightSlot
            ? ` Подсветка слота ${selectedLightSlot} (задаётся в сценарии).`
            : ""}
        </p>
        {linkMessage ? <p className="light-plot-link-message">{linkMessage}</p> : null}
        <div
          className="light-plot-map"
          style={
            {
              "--light-cols": lightGridCols,
              "--light-rows": lightGridRows,
            } as React.CSSProperties
          }
        >
          {!currentStep ? (
            <div className="light-plot-empty">Нет выбранного шага</div>
          ) : lightPlot.length === 0 ? (
            <div className="light-plot-empty">Софиты не добавлены</div>
          ) : (
            lightPlot.map((fixture) => {
              const slotActive =
                selectedLightSlot > 0 &&
                fixtureMatchesChannelSlot(fixture, selectedLightSlot);
              return (
                <div
                  key={fixture.id}
                  className={[
                    "light-plot-dot",
                    slotActive ? "light-plot-dot--slot-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    gridColumn: fixture.x,
                    gridRow: fixture.y,
                    ["--angle" as string]: `${fixture.angle ?? 0}deg`,
                    ["--length" as string]: `${fixture.length ?? 54}px`,
                  }}
                  title={`${fixture.label} → канал ${fixture.channel || "—"}`}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    draggingIdRef.current = fixture.id;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updateAimFromEvent(fixture.id, event);
                  }}
                  onPointerMove={(event) => {
                    if (draggingIdRef.current !== fixture.id) return;
                    updateAimFromEvent(fixture.id, event);
                  }}
                  onPointerUp={(event) => {
                    if (draggingIdRef.current !== fixture.id) return;
                    draggingIdRef.current = null;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onPointerLeave={(event) => {
                    if (draggingIdRef.current !== fixture.id) return;
                    draggingIdRef.current = null;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                >
                  <span className="light-plot-dot-label">{fixture.label}</span>
                  {fixture.channel ? (
                    <span className="light-plot-dot-channel">{fixture.channel}</span>
                  ) : null}
                  <span className="light-plot-ray" />
                </div>
              );
            })
          )}
        </div>
        <div className="light-plot-add">
          <input
            type="text"
            value={newLightLabel}
            onChange={(event) => setNewLightLabel(event.target.value)}
            placeholder="Название софита"
            disabled={!currentStep}
          />
          <LightChannelSelect
            lightChannels={lightChannels}
            value={newLightChannel}
            onChange={setNewLightChannel}
            disabled={!currentStep}
            className="light-plot-channel-select"
          />
          <select
            value={newLightX}
            onChange={(event) => setNewLightX(Number(event.target.value))}
            disabled={!currentStep}
          >
            {Array.from({ length: lightGridCols }, (_, index) => (
              <option key={`x-${index + 1}`} value={index + 1}>
                X {index + 1}
              </option>
            ))}
          </select>
          <select
            value={newLightY}
            onChange={(event) => setNewLightY(Number(event.target.value))}
            disabled={!currentStep}
          >
            {Array.from({ length: lightGridRows }, (_, index) => (
              <option key={`y-${index + 1}`} value={index + 1}>
                Y {index + 1}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={newLightAngle}
            onChange={(event) => setNewLightAngle(Number(event.target.value))}
            placeholder="Угол"
            disabled={!currentStep}
          />
          <input
            type="number"
            value={newLightLength}
            onChange={(event) => setNewLightLength(Number(event.target.value))}
            placeholder="Длина"
            min={10}
            disabled={!currentStep}
          />
          <button type="button" onClick={addLightFixture} disabled={!currentStep}>
            Добавить
          </button>
        </div>
        <div className="light-plot-list">
          {lightPlot.map((fixture) => (
            <div key={fixture.id} className="light-plot-item">
              <input
                type="text"
                value={fixture.label}
                onChange={(event) =>
                  updateLightFixture(fixture.id, "label", event.target.value)
                }
              />
              <LightChannelSelect
                lightChannels={lightChannels}
                value={fixture.channel}
                onChange={(channel) =>
                  updateLightFixture(fixture.id, "channel", channel)
                }
                className="light-plot-channel-select"
              />
              <select
                value={fixture.x}
                onChange={(event) =>
                  updateLightFixture(fixture.id, "x", Number(event.target.value))
                }
              >
                {Array.from({ length: lightGridCols }, (_, index) => (
                  <option key={`row-x-${fixture.id}-${index + 1}`} value={index + 1}>
                    X {index + 1}
                  </option>
                ))}
              </select>
              <select
                value={fixture.y}
                onChange={(event) =>
                  updateLightFixture(fixture.id, "y", Number(event.target.value))
                }
              >
                {Array.from({ length: lightGridRows }, (_, index) => (
                  <option key={`row-y-${fixture.id}-${index + 1}`} value={index + 1}>
                    Y {index + 1}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={fixture.angle ?? 0}
                onChange={(event) =>
                  updateLightFixture(fixture.id, "angle", Number(event.target.value))
                }
              />
              <input
                type="number"
                value={fixture.length ?? 54}
                onChange={(event) =>
                  updateLightFixture(
                    fixture.id,
                    "length",
                    Number(event.target.value),
                  )
                }
                min={10}
              />
              <button
                type="button"
                className="light-plot-remove"
                onClick={() => removeLightFixture(fixture.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="light-cue-export-row">
          <button
            type="button"
            className="light-plot-action"
            disabled={!currentStep || lightCues.length === 0}
            title="Скопировать таймлайн cue в буфер (Markdown)"
            onClick={() => void copyLightCuesToClipboard()}
          >
            Cue → буфер
          </button>
        </div>
        <LightCueTimeline
          lightChannels={lightChannels}
          durationMin={currentStep?.durationMin}
          cues={lightCues}
          spotlights={spotlights}
          disabled={!currentStep}
          onChangeCues={(next) => {
            if (!currentStep) return;
            updateStep(currentStep.id, {
              lightCues: normalizeLightCues(next),
            } as Partial<ScriptStep>);
          }}
          onApplyPreview={(nextSpotlights) => {
            if (!currentStep) return;
            updateStep(currentStep.id, {
              theaterSpotlights: nextSpotlights,
            } as Partial<ScriptStep>);
            setLinkMessage("Превью света применено к 3D-софитам");
          }}
        />
      </div>
    </div>
  );
};
