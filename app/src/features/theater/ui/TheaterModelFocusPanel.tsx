import cn from "classnames";
import type { ModelPlacementPreset } from "../model/theater-model-placement";

export type TheaterModelTransformMode = "translate" | "rotate" | "scale";

export type TheaterModelFocusPanelProps = {
  modelName: string;
  transformMode: TheaterModelTransformMode;
  matchingBuiltinCount?: number;
  showDecorActions: boolean;
  hidden?: boolean;
  onToggleHidden?: () => void;
  onPickTransform: (mode: TheaterModelTransformMode) => void;
  onRotateQuarter: (direction: "cw" | "ccw") => void;
  onPlace?: (preset: ModelPlacementPreset) => void;
  onAlign?: (axis: "x" | "z") => void;
  onDistribute?: (axis: "x" | "z") => void;
  onClone?: () => void;
  onMirror?: (axis: "x" | "z") => void;
  onDelete?: () => void;
};

export function TheaterModelFocusPanel({
  modelName,
  transformMode,
  matchingBuiltinCount = 0,
  showDecorActions,
  hidden = false,
  onToggleHidden,
  onPickTransform,
  onRotateQuarter,
  onPlace,
  onAlign,
  onDistribute,
  onClone,
  onMirror,
  onDelete,
}: TheaterModelFocusPanelProps) {
  return (
    <div
      className="theater-focus-panel theater-focus-panel--scene"
      role="dialog"
      aria-label={`Объект: ${modelName}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="theater-focus-panel__title">{modelName}</div>
      {onToggleHidden ? (
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            !hidden && "theater-model-context-menu__item--active",
          )}
          onClick={onToggleHidden}
        >
          {hidden ? "Показать в 3D" : "Скрыть в 3D"}
        </button>
      ) : null}
      <div className="theater-model-context-menu__row">
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            "theater-model-context-menu__item--compact",
            transformMode === "translate" && "theater-model-context-menu__item--active",
          )}
          onClick={() => onPickTransform("translate")}
        >
          Двигать
        </button>
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            "theater-model-context-menu__item--compact",
            transformMode === "rotate" && "theater-model-context-menu__item--active",
          )}
          onClick={() => onPickTransform("rotate")}
        >
          Крутить
        </button>
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            "theater-model-context-menu__item--compact",
            transformMode === "scale" && "theater-model-context-menu__item--active",
          )}
          onClick={() => onPickTransform("scale")}
        >
          Масштаб
        </button>
      </div>
      <div className="theater-model-context-menu__row">
        <button
          type="button"
          className="theater-model-context-menu__item theater-model-context-menu__item--compact"
          onClick={() => onRotateQuarter("ccw")}
        >
          ↺ 90°
        </button>
        <button
          type="button"
          className="theater-model-context-menu__item theater-model-context-menu__item--compact"
          onClick={() => onRotateQuarter("cw")}
        >
          ↻ 90°
        </button>
      </div>
      {showDecorActions && onPlace ? (
        <>
          <div className="theater-model-context-menu__section">Позиция</div>
          <button
            type="button"
            className="theater-model-context-menu__item"
            onClick={() => onPlace("backWall")}
          >
            К сцене
          </button>
          <button
            type="button"
            className="theater-model-context-menu__item"
            onClick={() => onPlace("frontWall")}
            title="Прижать к линии зала"
          >
            К залу
          </button>
          <button
            type="button"
            className="theater-model-context-menu__item"
            onClick={() => onPlace("center")}
          >
            В центр
          </button>
          <div className="theater-model-context-menu__row">
            <button
              type="button"
              className="theater-model-context-menu__item theater-model-context-menu__item--compact"
              onClick={() => onPlace("leftWall")}
            >
              Слева
            </button>
            <button
              type="button"
              className="theater-model-context-menu__item theater-model-context-menu__item--compact"
              onClick={() => onPlace("rightWall")}
            >
              Справа
            </button>
          </div>
        </>
      ) : null}
      {showDecorActions && matchingBuiltinCount >= 2 && onAlign ? (
        <>
          <div className="theater-model-context-menu__section">
            Выравн. ({matchingBuiltinCount})
          </div>
          <div className="theater-model-context-menu__row">
            <button
              type="button"
              className="theater-model-context-menu__item theater-model-context-menu__item--compact"
              onClick={() => onAlign("x")}
            >
              По X
            </button>
            <button
              type="button"
              className="theater-model-context-menu__item theater-model-context-menu__item--compact"
              onClick={() => onAlign("z")}
            >
              По Z
            </button>
          </div>
        </>
      ) : null}
      {matchingBuiltinCount >= 3 && onDistribute ? (
        <div className="theater-model-context-menu__row">
          <button
            type="button"
            className="theater-model-context-menu__item theater-model-context-menu__item--compact"
            onClick={() => onDistribute("x")}
          >
            Разн. X
          </button>
          <button
            type="button"
            className="theater-model-context-menu__item theater-model-context-menu__item--compact"
            onClick={() => onDistribute("z")}
          >
            Разн. Z
          </button>
        </div>
      ) : null}
      {onClone || onMirror || onDelete ? (
        <div className="theater-model-context-menu__row">
          {onClone ? (
            <button
              type="button"
              className="theater-model-context-menu__item theater-model-context-menu__item--compact"
              onClick={onClone}
            >
              Клон
            </button>
          ) : null}
          {showDecorActions && onMirror ? (
            <>
              <button
                type="button"
                className="theater-model-context-menu__item theater-model-context-menu__item--compact"
                onClick={() => onMirror("x")}
                title="Зеркало по X"
              >
                ⟷ X
              </button>
              <button
                type="button"
                className="theater-model-context-menu__item theater-model-context-menu__item--compact"
                onClick={() => onMirror("z")}
                title="Зеркало по Z"
              >
                ⟷ Z
              </button>
            </>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="theater-model-context-menu__item theater-model-context-menu__item--compact theater-model-context-menu__item--danger"
              onClick={onDelete}
            >
              Удалить
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
