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

export function TheaterControlsDecorModeSection({ vm, decor }: DecorSectionProps) {
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
            sectionId="decor-mode"
            title="Режим"
            summary={vm.decorPlaceMode ? "Расстановка" : "Редактирование"}
            defaultOpen
          >
            <p className="theater-layout-hint">
              <strong>Расстановка</strong> — клик по полу ставит предмет.
              <strong> Редактирование</strong> — выделение и gizmo. Esc — снять выделение.
              Shift+клик — в выделение. Задняя стена — отрицательный Z.
            </p>
            <div className="theater-btn-row">
              <TheaterBtn
                active={vm.decorPlaceMode}
                onClick={vm.enterDecorPlaceMode}
                title="Клик по полу добавляет выбранный предмет"
              >
                Расстановка
              </TheaterBtn>
              <TheaterBtn
                active={!vm.decorPlaceMode}
                onClick={vm.exitDecorPlaceMode}
                title="Выделение объектов и перемещение стрелками"
              >
                Редактирование
              </TheaterBtn>
            </div>
          </TheaterCollapsibleSection>
</>
  );
}
