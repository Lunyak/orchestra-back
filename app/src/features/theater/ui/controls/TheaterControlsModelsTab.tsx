import { isTheaterBuiltinTemplateKey } from "../../model/theater-model-builtin";
import { TheaterBuiltinTemplatePicker } from "../TheaterBuiltinTemplatePicker";
import { TheaterBtn } from "../theater-controls-ui";
import { TheaterCollapsibleSection } from "../TheaterCollapsibleSection";
import type { TheaterControlsTabProps } from "./types";

export function TheaterControlsModelsTab({ vm }: TheaterControlsTabProps) {
  return (
    <TheaterCollapsibleSection
      sectionId="models-add"
      title="Модели"
      summary="Встроенные и из файла"
      defaultOpen
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
      <div className="theater-model-actions">
        <TheaterBtn onClick={vm.addBuiltinModel} disabled={!vm.currentScene}>
          + Модель
        </TheaterBtn>
        <TheaterBtn onClick={vm.addModel} disabled={!vm.currentScene}>
          + Файл
        </TheaterBtn>
      </div>
    </TheaterCollapsibleSection>
  );
}
