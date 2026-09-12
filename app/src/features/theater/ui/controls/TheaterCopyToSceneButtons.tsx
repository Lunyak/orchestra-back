import type { TheaterAdjacentSceneDirection } from "../../model/theater-model-clone";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";
import { TheaterBtn } from "../theater-controls-ui";

type TheaterCopyToSceneButtonsProps = {
  vm: TheaterSceneViewModel;
  modelIds?: number[];
};

export function TheaterCopyToSceneButtons({
  vm,
  modelIds,
}: TheaterCopyToSceneButtonsProps) {
  const copyAll = modelIds == null;
  const hasSelection = (modelIds?.length ?? 0) > 0;
  const hasPrevious = vm.currentPage > 0;
  const hasNext = vm.currentPage < vm.sceneCount - 1;
  const disabled = !vm.currentScene || (!copyAll && !hasSelection);

  const copyTo = (direction: TheaterAdjacentSceneDirection) => {
    vm.copyModelsToAdjacentScene(direction, modelIds);
  };

  return (
    <div className="theater-btn-row">
      <TheaterBtn
        disabled={disabled || !hasPrevious}
        title="Скопировать на предыдущую сцену с теми же координатами"
        onClick={() => copyTo("previous")}
      >
        ← Предыдущая
      </TheaterBtn>
      <TheaterBtn
        disabled={disabled || !hasNext}
        title="Скопировать на следующую сцену с теми же координатами"
        onClick={() => copyTo("next")}
      >
        Следующая →
      </TheaterBtn>
    </div>
  );
}
