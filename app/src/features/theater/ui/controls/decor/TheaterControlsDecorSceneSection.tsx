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

export function TheaterControlsDecorSceneSection({ vm, decor }: DecorSectionProps) {
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
            sectionId="decor-scene"
            title="На сцене"
            summary="Выбор объекта"
          >
          <div className="theater-model-list">
            <TheaterSelect
              label="Объект на сцене"
              value={vm.activeModelId != null ? String(vm.activeModelId) : ""}
              options={modelSelectOptions}
              onChange={(nextValue) => {
                const nextId = Number(nextValue);
                if (!Number.isFinite(nextId)) return;
                vm.exitDecorPlaceMode();
                vm.setEditMode("decor");
                vm.updateCurrentScene({ theaterActiveModelId: nextId });
              }}
              disabled={!vm.currentScene}
              placeholder="Выберите объект"
              noOptionsLabel="Объектов нет"
            />
          </div>
          <p className="theater-layout-hint">
            Клик по объекту — панель в правом верхнем углу сцены. Shift+клик — несколько.
            Стрелки — сдвиг, Shift — точнее. Ctrl+Shift+стрелки — поворот 15°. Ctrl+D — клон. Delete — удалить.
          </p>
          </TheaterCollapsibleSection>
</>
  );
}
