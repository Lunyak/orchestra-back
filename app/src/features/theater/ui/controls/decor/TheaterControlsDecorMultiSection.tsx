import { tc } from "../../../../../shared/styles/theme-color";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { DECOR_CATALOG } from "../../../model/theater-decor-catalog";
import {
  DECOR_TEXTURE_MODES,
  DECOR_TEXTURE_PRESETS,
} from "../../../model/theater-decor-textures";
import { DECOR_TEXTURE_FACE_OPTIONS } from "../../../model/theater-decor-faces";
import { DecorTexturePreview } from "../../DecorTexturePreview";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField, TheaterSelect } from "../../theater-controls-ui";
import type { DecorSectionProps } from "./types";

export function TheaterControlsDecorMultiSection({ vm, decor }: DecorSectionProps) {
  const {
    decorTextureInputRef,
    decorTemplateInputRef,
    draftDecorSize,
    draftDecorColor,
    activeParametricSize,
    showDecorTextures,
    activeDecorTexture,
    activeDecorTexturePresetId,
    activeDecorTextureRepeat,
    activeDecorTextureMode,
    activeTextureFaces,
    setDraftSizeAxis,
    historyTx,
    projectName,
    modelSelectOptions,
  } = decor;
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
                <TheaterBtn disabled={!vm.currentStep} onClick={() => vm.alignSelectedModels("z")}>
                  Выровнять Z
                </TheaterBtn>
                <TheaterBtn disabled={!vm.currentStep} onClick={() => vm.alignSelectedModels("x")}>
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
                  Клон
                </TheaterBtn>
              </div>
            </TheaterCollapsibleSection>
          ) : null}
</>
  );
}
