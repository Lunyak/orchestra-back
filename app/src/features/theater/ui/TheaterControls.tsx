import { useState } from "react";
import { useScriptUI } from "../../script-ui";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import { TheaterBtn } from "./theater-controls-ui";
import { TheaterControlsSpotlightsTab } from "./controls/TheaterControlsSpotlightsTab";
import { TheaterControlsModelsTab } from "./controls/TheaterControlsModelsTab";
import { TheaterControlsDecorTab } from "./controls/TheaterControlsDecorTab";
import { TheaterControlsLayoutTab } from "./controls/TheaterControlsLayoutTab";
import { TheaterControlsOutlinerSection } from "./controls/TheaterControlsOutlinerSection";

export type TheaterControlsProps = {
  vm: TheaterSceneViewModel;
  controlsInPanel?: boolean;
  /** main — вкладки и настройки; outliner — только «Элементы сцены» */
  panel?: "main" | "outliner";
};

export function TheaterControls({
  vm,
  controlsInPanel,
  panel = "main",
}: TheaterControlsProps) {
  const { swapTheaterPanels } = useScriptUI();
  const {
    activeTab,
    setActiveTab,
    setEditMode,
    showControls,
    canUndoTheater,
    canRedoTheater,
    undoTheater,
    redoTheater,
    currentStep,
  } = vm;
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);

  if (!showControls) return null;

  if (panel === "outliner") {
    return (
      <div className="theater-controls theater-controls-panel theater-controls-outliner-panel">
        <TheaterControlsOutlinerSection vm={vm} />
      </div>
    );
  }

  return (
    <div
      className={`theater-controls${controlsInPanel ? " theater-controls-panel" : ""}`}
    >
      <div className="theater-tabs" role="tablist" aria-label="Раздел настроек театра">
        <div className="theater-history-actions">
          <TheaterBtn
            disabled={!currentStep || !canUndoTheater}
            onClick={undoTheater}
            title="Отменить (Ctrl+Z)"
          >
            Отменить
          </TheaterBtn>
          <TheaterBtn
            disabled={!currentStep || !canRedoTheater}
            onClick={redoTheater}
            title="Повторить (Ctrl+Y)"
          >
            Повторить
          </TheaterBtn>
        </div>
        <TheaterBtn
          active={activeTab === "spotlights"}
          onClick={() => {
            setActiveTab("spotlights");
            setEditMode("spotlights");
          }}
        >
          Софиты
        </TheaterBtn>
        <TheaterBtn
          active={activeTab === "models"}
          onClick={() => {
            setActiveTab("models");
            setEditMode("models");
          }}
        >
          Модели
        </TheaterBtn>
        <TheaterBtn
          active={activeTab === "decor"}
          onClick={() => {
            setActiveTab("decor");
            setEditMode("decor");
          }}
        >
          Декор
        </TheaterBtn>
        <TheaterBtn active={activeTab === "layout"} onClick={() => setActiveTab("layout")}>
          План
        </TheaterBtn>
      </div>
      <section className="theater-keyboard-hints">
        <button
          type="button"
          className="theater-panel-toggle"
          onClick={() => setShowKeyboardHints((prev) => !prev)}
        >
          <span>Горячие клавиши</span>
          <span>{showKeyboardHints ? "▾" : "▸"}</span>
        </button>
        {showKeyboardHints ? (
          <dl>
            <dt>Ctrl+E</dt>
            <dd>
              {swapTheaterPanels
                ? "Скрыть / показать панели редактирования"
                : "Открыть режим редактирования (настройки слева, элементы справа)"}
            </dd>
            <dt>Ctrl+Z / Ctrl+Y</dt>
            <dd>Отмена / повтор</dd>
            <dt>← → ↑ ↓</dt>
            <dd>Сдвиг модели (Shift — точнее)</dd>
            <dt>Ctrl+Shift+←/→</dt>
            <dd>Поворот модели на 15°</dd>
            <dt>Ctrl+D</dt>
            <dd>Клонировать (или все выбранные)</dd>
            <dt>Ctrl+A</dt>
            <dd>Выбрать все видимые на вкладке</dd>
            <dt>Delete</dt>
            <dd>Удалить активное или все выбранные</dd>
            <dt>H</dt>
            <dd>Скрыть / показать выбранное в 3D</dd>
            <dt>Shift+клик</dt>
            <dd>Добавить к выделению (3D, план, outliner, список)</dd>
            <dt>Групповой drag</dt>
            <dd>Перемещение gizmo двигает все выбранные модели</dd>
            <dt>Esc</dt>
            <dd>Снять выделение</dd>
          </dl>
        ) : null}
      </section>
      {activeTab === "spotlights" ? <TheaterControlsSpotlightsTab vm={vm} /> : null}
      {activeTab === "models" ? <TheaterControlsModelsTab vm={vm} /> : null}
      {activeTab === "decor" ? <TheaterControlsDecorTab vm={vm} /> : null}
      {activeTab === "layout" ? <TheaterControlsLayoutTab vm={vm} /> : null}
    </div>
  );
}
