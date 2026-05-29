import { useState } from "react";

import { useScriptUI } from "../../../script-ui";

import { TheaterControlsDecorTab } from "./TheaterControlsDecorTab";

import { TheaterControlsLayoutTab } from "./TheaterControlsLayoutTab";

import { TheaterControlsModelsTab } from "./TheaterControlsModelsTab";

import { TheaterControlsSpotlightsTab } from "./TheaterControlsSpotlightsTab";

import type { TheaterControlsTabProps } from "./types";



export function TheaterControlsSettings({ vm }: TheaterControlsTabProps) {

  const { swapTheaterPanels } = useScriptUI();

  const { activeTab } = vm;

  const [showKeyboardHints, setShowKeyboardHints] = useState(false);



  return (

    <div className="theater-controls-settings theater-controls--stage-brutal">

      <div className="theater-editor-panel-heading theater-editor-panel-heading--settings">

        Параметры

      </div>

      <section className="theater-keyboard-hints theater-keyboard-hints--editor">

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

                : "Открыть режим редактирования (вкладки слева, содержимое справа)"}

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

