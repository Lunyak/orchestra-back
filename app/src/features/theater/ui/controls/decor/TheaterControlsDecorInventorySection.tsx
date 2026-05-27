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

export function TheaterControlsDecorInventorySection({ vm, decor }: DecorSectionProps) {
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
<TheaterCollapsibleSection
            sectionId="decor-inventory"
            title="Реквизит"
            summary="Список и шаги"
          >
          <div className="theater-btn-row theater-btn-row--3">
            <TheaterBtn
              onClick={() => void vm.copyDecorInventoryToClipboard()}
              disabled={!vm.currentStep}
              title="Скопировать список декора в буфер (Markdown)"
            >
              Копировать список
            </TheaterBtn>
            <TheaterBtn
              onClick={vm.exportDecorInventoryCsv}
              disabled={!vm.currentStep}
              title="Сохранить список декора в CSV"
            >
              CSV реквизита
            </TheaterBtn>
            <TheaterBtn
              onClick={vm.syncDecorInventoryToRequisites}
              disabled={!vm.currentStep}
              title="Добавить позиции декора в реквизит шага"
            >
              В реквизит шага
            </TheaterBtn>
            <TheaterBtn
              onClick={vm.copyDecorToNextStep}
              disabled={!vm.currentStep || vm.currentPage >= vm.stepCount - 1}
              title="Скопировать декор текущего шага на следующий"
            >
              На след. шаг
            </TheaterBtn>
          </div>
          {vm.decorActionMessage ? (
            <div className="theater-decor-action-message" role="status">
              {vm.decorActionMessage}
            </div>
          ) : null}
          </TheaterCollapsibleSection>
</>
  );
}
