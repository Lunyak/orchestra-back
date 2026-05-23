import type { TheaterModel } from "../../../shared/types/script";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";

export type TheaterControlsProps = {
  vm: TheaterSceneViewModel;
  controlsInPanel?: boolean;
};

export function TheaterControls({ vm, controlsInPanel }: TheaterControlsProps) {
  const {
    activeModel,
    activeModelId,
    activeSpotlight,
    activeSpotlightId,
    activeTab,
    addBuiltinModel,
    addModel,
    addRgbSpotlight,
    addSpotlight,
    applyRgbColorToAll,
    blackoutAllSpotlights,
    builtinModelKey,
    cloneModel,
    copyFromPreviousStep,
    copyModelsFromPreviousStep,
    currentPage,
    currentStep,
    disableSpotlightsByType,
    dragMode,
    editMode,
    effectiveSpotlights,
    enableSpotlightsByType,
    ensureSpotlights,
    gridStep,
    layout,
    modelTransformMode,
    models,
    removeModel,
    rgbBatchColor,
    setActiveTab,
    setBuiltinModelKey,
    setDragMode,
    setEditMode,
    setGridStep,
    setModelTransformMode,
    setRgbBatchColor,
    setShowControls,
    setShowGrid,
    setShowOnlyActiveSpotlight,
    setShowSpotlights,
    setSnapToGrid,
    showControls,
    showGrid,
    showOnlyActiveSpotlight,
    showSpotlights,
    snapToGrid,
    spotlights,
    updateCurrentStep,
    updateLayout,
    updateSpotlight,
    updateModel,
  } = vm;

  if (!showControls) return null;

  return (
    <div
      className={`theater-controls${controlsInPanel ? " theater-controls-panel" : ""}`}
    >
      <div className="theater-tabs">
        <button
          type="button"
          className="theater-spotlight-btn"
          data-active={activeTab === "spotlights"}
          onClick={() => {
            setActiveTab("spotlights");
            setEditMode("spotlights");
          }}
        >
          Софиты
        </button>
        <button
          type="button"
          className="theater-spotlight-btn"
          data-active={activeTab === "models"}
          onClick={() => {
            setActiveTab("models");
            setEditMode("models");
          }}
        >
          Модели
        </button>
        <button
          type="button"
          className="theater-spotlight-btn"
          data-active={activeTab === "layout"}
          onClick={() => setActiveTab("layout")}
        >
          План
        </button>
      </div>
      {activeTab === "spotlights" && (
        <>
          <div className="theater-spotlight-list">
            <div className="theater-spotlight-section">Софиты</div>
            {(spotlights.length > 0 ? spotlights : effectiveSpotlights)
              .filter((item) => !item.isRgb)
              .map((item) => (
                <div key={item.id} className="theater-spotlight-tab">
                  <button
                    type="button"
                    className="theater-spotlight-btn"
                    data-active={item.id === activeSpotlightId}
                    onClick={() => {
                      setEditMode("spotlights");
                      ensureSpotlights();
                      updateCurrentStep({ theaterActiveSpotlightId: item.id });
                    }}
                    disabled={!currentStep}
                  >
                    {item.label}
                  </button>
                  <label className="theater-spotlight-channel">
                    Канал
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={item.channel ?? item.id}
                      onChange={(event) =>
                        updateSpotlight(item.id, {
                          channel: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                      disabled={!currentStep}
                    />
                  </label>
                  <button
                    type="button"
                    className="theater-spotlight-btn"
                    data-active={item.enabled !== false}
                    onClick={() =>
                      updateSpotlight(item.id, {
                        enabled: !(item.enabled ?? true),
                      })
                    }
                    disabled={!currentStep}
                    title={item.enabled === false ? "Включить" : "Выключить"}
                  >
                    {item.enabled === false ? "Выкл" : "Вкл"}
                  </button>
                </div>
              ))}
            {(spotlights.length > 0 ? spotlights : effectiveSpotlights).filter(
              (item) => !item.isRgb
            ).length === 0 && (
                <span className="theater-spotlight-empty">Софитов нет</span>
              )}
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={addSpotlight}
              disabled={!currentStep}
            >
              + Софит
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => enableSpotlightsByType(false)}
              disabled={!currentStep}
              title="Включить все обычные софиты"
            >
              Включить все
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => disableSpotlightsByType(false)}
              disabled={!currentStep}
              title="Выключить все обычные софиты"
            >
              Выключить все
            </button>
            <div className="theater-spotlight-section">RGB</div>
            {(spotlights.length > 0 ? spotlights : effectiveSpotlights)
              .filter((item) => item.isRgb)
              .map((item) => (
                <div key={item.id} className="theater-spotlight-tab">
                  <button
                    type="button"
                    className="theater-spotlight-btn"
                    data-active={item.id === activeSpotlightId}
                    onClick={() => {
                      setEditMode("spotlights");
                      ensureSpotlights();
                      updateCurrentStep({ theaterActiveSpotlightId: item.id });
                    }}
                    disabled={!currentStep}
                  >
                    {item.label}
                  </button>
                  <label className="theater-spotlight-channel">
                    Канал
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={item.channel ?? item.id}
                      onChange={(event) =>
                        updateSpotlight(item.id, {
                          channel: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                      disabled={!currentStep}
                    />
                  </label>
                  <button
                    type="button"
                    className="theater-spotlight-btn"
                    data-active={item.enabled !== false}
                    onClick={() =>
                      updateSpotlight(item.id, {
                        enabled: !(item.enabled ?? true),
                      })
                    }
                    disabled={!currentStep}
                    title={item.enabled === false ? "Включить" : "Выключить"}
                  >
                    {item.enabled === false ? "Выкл" : "Вкл"}
                  </button>
                </div>
              ))}
            {(spotlights.length > 0 ? spotlights : effectiveSpotlights).filter(
              (item) => item.isRgb
            ).length === 0 && (
                <span className="theater-spotlight-empty">RGB нет</span>
              )}
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={addRgbSpotlight}
              disabled={!currentStep}
            >
              + RGB
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => enableSpotlightsByType(true)}
              disabled={!currentStep}
              title="Включить все RGB"
            >
              Включить все RGB
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => disableSpotlightsByType(true)}
              disabled={!currentStep}
              title="Выключить все RGB"
            >
              Выключить все RGB
            </button>
            <div className="theater-spotlight-section">Шаблоны RGB</div>
            <div className="theater-spotlight-grid">
              <button
                type="button"
                className="theater-spotlight-btn"
                onClick={() => applyRgbColorToAll("#22c55e")}
                disabled={!currentStep}
                title="Зеленый"
              >
                Зеленый
              </button>
              <button
                type="button"
                className="theater-spotlight-btn"
                onClick={() => applyRgbColorToAll("#3b82f6")}
                disabled={!currentStep}
                title="Синий"
              >
                Синий
              </button>
              <button
                type="button"
                className="theater-spotlight-btn"
                onClick={() => applyRgbColorToAll("#ec4899")}
                disabled={!currentStep}
                title="Розовый"
              >
                Розовый
              </button>
              <button
                type="button"
                className="theater-spotlight-btn"
                onClick={() => applyRgbColorToAll("#facc15")}
                disabled={!currentStep}
                title="Желтый"
              >
                Желтый
              </button>
            </div>
            <label>
              Цвет всем RGB
              <input
                type="color"
                value={rgbBatchColor}
                onChange={(event) => setRgbBatchColor(event.target.value)}
                disabled={!currentStep}
              />
            </label>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => applyRgbColorToAll(rgbBatchColor)}
              disabled={!currentStep}
              title="Применить выбранный цвет ко всем RGB"
            >
              Применить к RGB
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={copyFromPreviousStep}
              disabled={!currentStep || currentPage === 0}
              title="Скопировать софиты из предыдущего шага"
            >
              Скопировать из прошлого шага
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={blackoutAllSpotlights}
              disabled={!currentStep}
              title="Выключить все софиты"
            >
              Блекаут
            </button>
          </div>
        </>
      )}
      <div className="theater-spotlight-active">
        <div className="theater-spotlight-section">
          Активный софит: {activeSpotlight?.label ?? "—"}
        </div>
        <div className="theater-spotlight-grid">
          <label>
            Показывать софиты
            <input
              type="checkbox"
              checked={showSpotlights}
              onChange={(event) => setShowSpotlights(event.target.checked)}
            />
          </label>
          <label>
            Только активный
            <input
              type="checkbox"
              checked={showOnlyActiveSpotlight}
              onChange={(event) => setShowOnlyActiveSpotlight(event.target.checked)}
              disabled={!activeSpotlight}
            />
          </label>
          <label>
            Сетка
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(event) => setShowGrid(event.target.checked)}
            />
          </label>
          <label>
            Привязка X/Z
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(event) => setSnapToGrid(event.target.checked)}
            />
          </label>
          <label>
            Шаг
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={gridStep}
              onChange={(event) =>
                setGridStep(Math.max(0.1, Number(event.target.value) || 0.1))
              }
            />
          </label>
        </div>
        <div className="theater-spotlight-drag">
          <button
            type="button"
            className="theater-spotlight-btn"
            data-active={dragMode === "target"}
            onClick={() => {
              setEditMode("spotlights");
              setDragMode("target");
            }}
            disabled={!activeSpotlight}
          >
            Цель
          </button>
          <button
            type="button"
            className="theater-spotlight-btn"
            data-active={dragMode === "source"}
            onClick={() => {
              setEditMode("spotlights");
              setDragMode("source");
            }}
            disabled={!activeSpotlight}
          >
            Источник
          </button>
        </div>
        <label>
          Угол
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={activeSpotlight?.angleDeg ?? 20}
            onChange={(event) =>
              updateSpotlight(activeSpotlight?.id ?? 0, {
                angleDeg: Number(event.target.value),
              })
            }
            disabled={!activeSpotlight}
          />
          <span>{activeSpotlight?.angleDeg ?? 20}°</span>
        </label>
        <label>
          Интенсивность
          <input
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={activeSpotlight?.intensity ?? 1.2}
            onChange={(event) =>
              updateSpotlight(activeSpotlight?.id ?? 0, {
                intensity: Number(event.target.value),
              })
            }
            disabled={!activeSpotlight}
          />
          <span>{(activeSpotlight?.intensity ?? 1.2).toFixed(1)}</span>
        </label>
        <label>
          Цвет
          <input
            type="color"
            value={activeSpotlight?.color ?? "#fbbf24"}
            onChange={(event) =>
              updateSpotlight(activeSpotlight?.id ?? 0, {
                color: event.target.value,
              })
            }
            disabled={!activeSpotlight}
          />
        </label>
      </div>
      {activeTab === "models" && (
        <>
          <div className="theater-model-list">
            {models.length === 0 ? (
              <span className="theater-spotlight-empty">Моделей нет</span>
            ) : (
              <label>
                Выбор модели
                <select
                  value={activeModelId ?? ""}
                  onChange={(event) => {
                    const nextId = Number(event.target.value);
                    if (!Number.isFinite(nextId)) return;
                    setEditMode("models");
                    updateCurrentStep({ theaterActiveModelId: nextId });
                  }}
                  disabled={!currentStep}
                >
                  {models.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Шаблон
              <select
                value={builtinModelKey ?? ""}
                onChange={(event) => {
                  const nextKey = event.target.value as TheaterModel["builtin"];
                  setBuiltinModelKey(nextKey);
                }}
              >
                <option value="roundTable">Круглый стол</option>
                <option value="chair">Стул</option>
                <option value="bench">Скамейка</option>
                <option value="cabinet">Тумба</option>
                <option value="blackCube">Черный куб</option>
                <option value="strawGrid">Сетка + солома</option>
                <option value="actor">Актер</option>
                <option value="fence">Забор</option>
                <option value="dancer">Танцор</option>
              </select>
            </label>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={addBuiltinModel}
              disabled={!currentStep}
            >
              + Шаблон
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={addModel}
              disabled={!currentStep}
            >
              + Файл модели
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => removeModel(activeModelId ?? 0)}
              disabled={!activeModel || editMode !== "models"}
            >
              Удалить модель
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => cloneModel(activeModelId ?? 0)}
              disabled={!activeModel || editMode !== "models"}
            >
              Клонировать модель
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => updateCurrentStep({ theaterActiveModelId: undefined })}
              disabled={!activeModelId}
              title="Снять выделение"
            >
              Снять выделение
            </button>
            <label>
              Вне стен
              <input
                type="checkbox"
                checked={activeModel?.allowOutOfBounds ?? false}
                onChange={(event) =>
                  activeModelId &&
                  updateModel(activeModelId, {
                    allowOutOfBounds: event.target.checked,
                  })
                }
                disabled={!activeModelId}
              />
            </label>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={copyModelsFromPreviousStep}
              disabled={!currentStep || currentPage === 0}
              title="Скопировать модели из предыдущего шага"
            >
              Скопировать модели
            </button>
          </div>
          <div className="theater-model-actions">
            <button
              type="button"
              className="theater-spotlight-btn"
              data-active={modelTransformMode === "translate"}
              onClick={() => {
                setEditMode("models");
                setModelTransformMode("translate");
              }}
              disabled={!activeModel || editMode !== "models"}
            >
              Перемещение
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              data-active={modelTransformMode === "rotate"}
              onClick={() => {
                setEditMode("models");
                setModelTransformMode("rotate");
              }}
              disabled={!activeModel || editMode !== "models"}
            >
              Вращение
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              data-active={modelTransformMode === "scale"}
              onClick={() => {
                setEditMode("models");
                setModelTransformMode("scale");
              }}
              disabled={!activeModel || editMode !== "models"}
            >
              Масштаб
            </button>
          </div>
        </>
      )}
      {activeTab === "layout" && (
        <>
          <div className="theater-layout-title">План зала</div>
          <div className="theater-layout-grid">
            <label>
              Ширина
              <input
                type="number"
                min={6}
                step={0.5}
                value={layout.hallWidth}
                onChange={(event) =>
                  updateLayout({ hallWidth: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              Глубина
              <input
                type="number"
                min={6}
                step={0.5}
                value={layout.hallDepth}
                onChange={(event) =>
                  updateLayout({ hallDepth: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              Проход W
              <input
                type="number"
                min={0}
                step={0.1}
                value={layout.aisleWidth}
                onChange={(event) =>
                  updateLayout({ aisleWidth: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              Проход X
              <input
                type="number"
                step={0.1}
                value={layout.aisleCenterX}
                onChange={(event) =>
                  updateLayout({ aisleCenterX: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              Рядов
              <input
                type="number"
                min={0}
                step={1}
                value={layout.seatRows}
                onChange={(event) =>
                  updateLayout({
                    seatRows: Math.max(0, Number(event.target.value) || 0),
                  })
                }
              />
            </label>
            <label>
              Мест/ряд
              <input
                type="number"
                min={1}
                step={1}
                value={layout.seatsPerRow}
                onChange={(event) =>
                  updateLayout({
                    seatsPerRow: Math.max(1, Number(event.target.value) || 1),
                  })
                }
              />
            </label>
            <label>
              Подъем
              <input
                type="number"
                min={0}
                step={0.05}
                value={layout.rowRise}
                onChange={(event) =>
                  updateLayout({ rowRise: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              Дверь Z
              <input
                type="number"
                step={0.5}
                value={layout.doorZ}
                onChange={(event) =>
                  updateLayout({ doorZ: Number(event.target.value) || 0 })
                }
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
