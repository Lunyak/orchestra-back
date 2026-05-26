import type { TheaterControlsTabProps } from "./types";
import { LabeledCheckbox } from "../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import {
  BUILTIN_MODEL_OPTIONS,
  parseBuiltinKey,
  TheaterBtn,
  TheaterSelect,
} from "../theater-controls-ui";
import { useTheaterControlsModelsTab } from "./use-theater-controls-models-tab";

function isHumanBuiltin(builtin: string | undefined): boolean {
  return (
    builtin === "humanStanding" ||
    builtin === "humanSitting" ||
    builtin === "humanSmoothStanding" ||
    builtin === "humanSmoothSitting"
  );
}

function isSeatableBuiltin(builtin: string | undefined): boolean {
  return builtin === "chair" || builtin === "bench" || builtin === "sofa";
}

export function TheaterControlsModelsTab({ vm }: TheaterControlsTabProps) {
  const modelSelectOptions = useTheaterControlsModelsTab(vm);
  const activeHumanModel =
    vm.activeModel && isHumanBuiltin(vm.activeModel.builtin) ? vm.activeModel : null;
  const activeHangingFabric =
    vm.activeModel?.builtin === "hangingFabric" ? vm.activeModel : null;
  const hasSeatingFurniture = vm.models.some(
    (model) =>
      model.id !== activeHumanModel?.id &&
      !model.hidden &&
      model.type !== "file" &&
      isSeatableBuiltin(model.builtin),
  );

  return (
    <>
      <div className="theater-model-list">
        {vm.models.length === 0 ? (
          <span className="theater-spotlight-empty">Моделей нет</span>
        ) : (
          <TheaterSelect
            label="Выбор модели"
            value={vm.activeModelId != null ? String(vm.activeModelId) : ""}
            options={modelSelectOptions}
            onChange={(nextValue) => {
              const nextId = Number(nextValue);
              if (!Number.isFinite(nextId)) return;
              vm.setEditMode("models");
              vm.updateCurrentStep({ theaterActiveModelId: nextId });
            }}
            disabled={!vm.currentStep}
            placeholder="Выберите модель"
            noOptionsLabel="Моделей нет"
          />
        )}
        <TheaterSelect
          label="Шаблон"
          value={vm.builtinModelKey ?? ""}
          options={BUILTIN_MODEL_OPTIONS}
          onChange={(nextValue) => {
            const nextKey = parseBuiltinKey(nextValue);
            if (nextKey) vm.setBuiltinModelKey(nextKey);
          }}
        />
        <TheaterBtn onClick={vm.addBuiltinModel} disabled={!vm.currentStep}>
          + Шаблон
        </TheaterBtn>
        <TheaterBtn onClick={vm.addModel} disabled={!vm.currentStep}>
          + Файл модели
        </TheaterBtn>
        <TheaterBtn
          onClick={() => vm.removeModel(vm.activeModelId ?? 0)}
          disabled={!vm.activeModel || vm.editMode !== "models"}
        >
          Удалить модель
        </TheaterBtn>
        <TheaterBtn
          onClick={() => vm.cloneModel(vm.activeModelId ?? 0)}
          disabled={!vm.activeModel || vm.editMode !== "models"}
        >
          Клонировать модель
        </TheaterBtn>
        <TheaterBtn
          onClick={() => vm.updateCurrentStep({ theaterActiveModelId: undefined })}
          disabled={!vm.activeModelId}
          title="Снять выделение"
        >
          Снять выделение
        </TheaterBtn>
        <TheaterBtn
          disabled={!vm.currentStep}
          title="Ctrl+A — выбрать все видимые модели"
          onClick={vm.selectAllVisibleInEditMode}
        >
          Выбрать все
        </TheaterBtn>
        <LabeledCheckbox
          checked={vm.activeModel?.allowOutOfBounds ?? false}
          onChange={(checked) =>
            vm.activeModelId &&
            vm.updateModel(vm.activeModelId, { allowOutOfBounds: checked })
          }
          disabled={!vm.activeModelId}
        >
          Вне стен
        </LabeledCheckbox>
        <LabeledCheckbox
          checked={vm.activeModel?.ignoreCollisions ?? false}
          onChange={(checked) =>
            vm.activeModelId &&
            vm.updateModel(vm.activeModelId, { ignoreCollisions: checked })
          }
          disabled={!vm.activeModelId}
        >
          Без коллизии
        </LabeledCheckbox>
        {activeHangingFabric ? (
          <LabeledCheckbox
            checked={activeHangingFabric.decorOneSided ?? false}
            onChange={(checked) =>
              vm.updateModel(activeHangingFabric.id, { decorOneSided: checked })
            }
          >
            Ткань односторонняя
          </LabeledCheckbox>
        ) : null}
        {activeHumanModel ? (
          <div className="theater-spotlight-section">
            <span className="theater-label">Внешний вид человека</span>
            <TheaterBtn
              onClick={vm.seatActiveHumanOnFurniture}
              disabled={!hasSeatingFurniture}
              title="Посадить выбранного человека на выбранный или ближайший стул/диван/скамейку"
            >
              Усадить на мебель
            </TheaterBtn>
            <label className="theater-field">
              <span className="theater-label">Кожа</span>
              <input
                type="color"
                className="native-text-input"
                value={activeHumanModel.humanSkinColor ?? "#d7a77f"}
                onChange={(event) =>
                  vm.updateModel(activeHumanModel.id, {
                    humanSkinColor: event.target.value,
                  })
                }
              />
            </label>
            <label className="theater-field">
              <span className="theater-label">Верх</span>
              <input
                type="color"
                className="native-text-input"
                value={activeHumanModel.humanTopColor ?? "#334155"}
                onChange={(event) =>
                  vm.updateModel(activeHumanModel.id, {
                    humanTopColor: event.target.value,
                  })
                }
              />
            </label>
            <label className="theater-field">
              <span className="theater-label">Низ</span>
              <input
                type="color"
                className="native-text-input"
                value={activeHumanModel.humanBottomColor ?? "#1e293b"}
                onChange={(event) =>
                  vm.updateModel(activeHumanModel.id, {
                    humanBottomColor: event.target.value,
                  })
                }
              />
            </label>
            <label className="theater-field">
              <span className="theater-label">Обувь</span>
              <input
                type="color"
                className="native-text-input"
                value={activeHumanModel.humanShoeColor ?? "#111827"}
                onChange={(event) =>
                  vm.updateModel(activeHumanModel.id, {
                    humanShoeColor: event.target.value,
                  })
                }
              />
            </label>
          </div>
        ) : null}
        <TheaterBtn
          onClick={vm.copyModelsFromPreviousStep}
          disabled={!vm.currentStep || vm.currentPage === 0}
          title="Скопировать модели из предыдущего шага"
        >
          Скопировать модели
        </TheaterBtn>
      </div>
      {vm.multiSelectedModelIds.length >= 2 ? (
        <>
          <div className="theater-spotlight-section">
            Выделено: {vm.multiSelectedModelIds.length}
          </div>
          <div className="theater-spotlight-grid">
            <TheaterBtn
              disabled={!vm.currentStep}
              title="Выровнять Z всех выбранных по первому"
              onClick={() => vm.alignSelectedModels("z")}
            >
              Выровнять Z
            </TheaterBtn>
            <TheaterBtn
              disabled={!vm.currentStep}
              title="Выровнять X всех выбранных по первому"
              onClick={() => vm.alignSelectedModels("x")}
            >
              Выровнять X
            </TheaterBtn>
            <TheaterBtn
              disabled={!vm.currentStep || vm.multiSelectedModelIds.length < 3}
              onClick={() => vm.distributeSelectedModels("z")}
            >
              Разнести Z
            </TheaterBtn>
            <TheaterBtn
              disabled={!vm.currentStep || vm.multiSelectedModelIds.length < 3}
              onClick={() => vm.distributeSelectedModels("x")}
            >
              Разнести X
            </TheaterBtn>
            <TheaterBtn
              disabled={!vm.currentStep}
              onClick={() => vm.setSelectedModelsVisibility(true)}
            >
              Скрыть выбранные
            </TheaterBtn>
            <TheaterBtn
              disabled={!vm.currentStep}
              onClick={() => vm.setSelectedModelsVisibility(false)}
            >
              Показать выбранные
            </TheaterBtn>
            <TheaterBtn disabled={!vm.currentStep} onClick={vm.removeSelectedModels}>
              Удалить выбранные
            </TheaterBtn>
            <TheaterBtn disabled={!vm.currentStep} onClick={vm.cloneSelectedModels}>
              Клонировать выбранные
            </TheaterBtn>
          </div>
        </>
      ) : null}
      <div className="theater-model-actions">
        <TheaterBtn
          active={vm.modelTransformMode === "translate"}
          onClick={() => {
            vm.setEditMode("models");
            vm.setModelTransformMode("translate");
          }}
          disabled={!vm.activeModel || vm.editMode !== "models"}
        >
          Перемещение
        </TheaterBtn>
        <TheaterBtn
          active={vm.modelTransformMode === "rotate"}
          onClick={() => {
            vm.setEditMode("models");
            vm.setModelTransformMode("rotate");
          }}
          disabled={!vm.activeModel || vm.editMode !== "models"}
        >
          Вращение
        </TheaterBtn>
        <TheaterBtn
          active={vm.modelTransformMode === "scale"}
          onClick={() => {
            vm.setEditMode("models");
            vm.setModelTransformMode("scale");
          }}
          disabled={!vm.activeModel || vm.editMode !== "models"}
        >
          Масштаб
        </TheaterBtn>
      </div>
    </>
  );
}
