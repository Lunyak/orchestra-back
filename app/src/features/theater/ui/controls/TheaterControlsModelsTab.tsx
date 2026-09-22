import { isTheaterBuiltinTemplateKey } from "../../model/theater-model-builtin";
import { TheaterBuiltinTemplatePicker } from "../TheaterBuiltinTemplatePicker";
import { TheaterBtn } from "../theater-controls-ui";
import { TheaterCollapsibleSection } from "../TheaterCollapsibleSection";
import type { TheaterControlsTabProps } from "./types";

export function TheaterControlsModelsTab({ vm }: TheaterControlsTabProps) {
  return (
    <div className="theater-layout-panel theater-layout-panel--fill">
      <TheaterCollapsibleSection
        sectionId="models-add"
        title="Модели"
        defaultOpen
        className="theater-panel-section--fill"
        headerActions={
          <>
            <TheaterBtn
              onClick={vm.addBuiltinModel}
              disabled={!vm.currentScene}
              title="Добавить выбранную"
            >
              +
            </TheaterBtn>
            <TheaterBtn
              onClick={vm.addModel}
              disabled={!vm.currentScene}
              title="Добавить из файла"
            >
              + Файл
            </TheaterBtn>
          </>
        }
      >
        <TheaterBuiltinTemplatePicker
          value={
            isTheaterBuiltinTemplateKey(vm.builtinModelKey)
              ? vm.builtinModelKey
              : undefined
          }
          onChange={(nextKey) => vm.setBuiltinModelKey(nextKey)}
          dragEnabled={Boolean(vm.currentScene)}
        />
      </TheaterCollapsibleSection>
    </div>
  );
}
