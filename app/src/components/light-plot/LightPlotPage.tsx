import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from "react";
import { LightFixture, ScriptStep } from "../../shared/types/script";
import "./style.css";

interface LightPlotPageProps {
  steps?: ScriptStep[];
  currentPage?: number;
  onStepsChange?: Dispatch<SetStateAction<ScriptStep[]>>;
}

export const LightPlotPage = ({
  steps = [],
  currentPage = 0,
  onStepsChange,
}: LightPlotPageProps) => {
  const [newLightLabel, setNewLightLabel] = useState("");
  const [newLightChannel, setNewLightChannel] = useState("");
  const [newLightX, setNewLightX] = useState(1);
  const [newLightY, setNewLightY] = useState(1);
  const [newLightAngle, setNewLightAngle] = useState(0);
  const [newLightLength, setNewLightLength] = useState(54);
  const draggingIdRef = useRef<number | null>(null);
  const lightGridCols = 12;
  const lightGridRows = 20;
  const currentStep = steps[currentPage];
  const lightPlot = currentStep?.lightPlot ?? [];

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
    [lightGridCols, lightGridRows]
  );

  const updateCurrentStepPlot = useCallback(
    (nextPlot: LightFixture[]) => {
      if (!currentStep || !onStepsChange) return;
      const normalized = normalizeLightPlot(nextPlot);
      onStepsChange(
        steps.map((step, index) =>
          index === currentPage ? { ...step, lightPlot: normalized } : step
        )
      );
    },
    [currentPage, currentStep, normalizeLightPlot, onStepsChange, steps]
  );

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
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const updateLightAim = useCallback((id: number, angle: number, length: number) => {
    updateCurrentStepPlot(
      lightPlot.map((item) =>
        item.id === id ? { ...item, angle, length } : item
      )
    );
  }, [lightPlot, updateCurrentStepPlot]);

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
          </div>
        </div>
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
            lightPlot.map((fixture) => (
              <div
                key={fixture.id}
                className="light-plot-dot"
                style={{
                  gridColumn: fixture.x,
                  gridRow: fixture.y,
                  ["--angle" as string]: `${fixture.angle ?? 0}deg`,
                  ["--length" as string]: `${fixture.length ?? 54}px`,
                }}
                title={`${fixture.label} → ${fixture.channel || "без канала"}`}
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
                {fixture.channel && (
                  <span className="light-plot-dot-channel">{fixture.channel}</span>
                )}
                <span className="light-plot-ray" />
              </div>
            ))
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
          <input
            type="text"
            value={newLightChannel}
            onChange={(event) => setNewLightChannel(event.target.value)}
            placeholder="Канал"
            disabled={!currentStep}
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
              <input
                type="text"
                value={fixture.channel}
                onChange={(event) =>
                  updateLightFixture(fixture.id, "channel", event.target.value)
                }
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
                  updateLightFixture(
                    fixture.id,
                    "angle",
                    Number(event.target.value)
                  )
                }
              />
              <input
                type="number"
                value={fixture.length ?? 54}
                onChange={(event) =>
                  updateLightFixture(
                    fixture.id,
                    "length",
                    Number(event.target.value)
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
      </div>
    </div>
  );
};
