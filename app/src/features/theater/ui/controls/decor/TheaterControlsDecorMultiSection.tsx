import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn } from "../../theater-controls-ui";
import { TheaterCopyToSceneButtons } from "../TheaterCopyToSceneButtons";
import type { DecorSectionProps } from "./types";

export function TheaterControlsDecorMultiSection({ vm }: DecorSectionProps) {
  return (
<>
{vm.multiSelectedModelIds.length >= 2 ? (
            <TheaterCollapsibleSection
              sectionId="decor-multi"
              title="Выделение"
              summary="Групповые действия"
              badge={String(vm.multiSelectedModelIds.length)}
              defaultOpen
            >
              <div className="theater-btn-row theater-btn-row--3">
                <TheaterBtn disabled={!vm.currentScene} onClick={() => vm.alignSelectedModels("z")}>
                  Выровнять Z
                </TheaterBtn>
                <TheaterBtn disabled={!vm.currentScene} onClick={() => vm.alignSelectedModels("x")}>
                  Выровнять X
                </TheaterBtn>
                <TheaterBtn
                  disabled={!vm.currentScene || vm.multiSelectedModelIds.length < 3}
                  onClick={() => vm.distributeSelectedModels("z")}
                >
                  Разнести Z
                </TheaterBtn>
                <TheaterBtn
                  disabled={!vm.currentScene || vm.multiSelectedModelIds.length < 3}
                  onClick={() => vm.distributeSelectedModels("x")}
                >
                  Разнести X
                </TheaterBtn>
                <TheaterBtn
                  disabled={!vm.currentScene}
                  onClick={() => vm.setSelectedModelsVisibility(true)}
                >
                  Скрыть выбранные
                </TheaterBtn>
                <TheaterBtn
                  disabled={!vm.currentScene}
                  onClick={() => vm.setSelectedModelsVisibility(false)}
                >
                  Показать выбранные
                </TheaterBtn>
                <TheaterBtn disabled={!vm.currentScene} onClick={vm.removeSelectedModels}>
                  Удалить выбранные
                </TheaterBtn>
                <TheaterBtn disabled={!vm.currentScene} onClick={vm.cloneSelectedModels}>
                  Клон
                </TheaterBtn>
              </div>
              <p className="theater-layout-hint">На другую сцену</p>
              <TheaterCopyToSceneButtons
                vm={vm}
                modelIds={vm.multiSelectedModelIds}
              />
            </TheaterCollapsibleSection>
          ) : null}
</>
  );
}
