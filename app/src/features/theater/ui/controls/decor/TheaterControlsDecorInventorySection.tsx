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
            summary="Список и сцены"
          >
          <div className="theater-btn-row theater-btn-row--3">
            <TheaterBtn
              onClick={() => void vm.copyDecorInventoryToClipboard()}
              disabled={!vm.currentScene}
              title="Скопировать список декора в буфер (Markdown)"
            >
              Копировать список
            </TheaterBtn>
            <TheaterBtn
              onClick={vm.exportDecorInventoryCsv}
              disabled={!vm.currentScene}
              title="Сохранить список декора в CSV"
            >
              CSV реквизита
            </TheaterBtn>
            <TheaterBtn
              onClick={vm.syncDecorInventoryToRequisites}
              disabled={!vm.currentScene}
              title="Добавить позиции декора в реквизит сцены"
            >
              В реквизит сцены
            </TheaterBtn>
            <TheaterBtn
              onClick={vm.copyDecorToNextScene}
              disabled={!vm.currentScene || vm.currentPage >= vm.sceneCount - 1}
              title="Скопировать декор текущей сцены на следующую"
            >
              На след. сцену
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
