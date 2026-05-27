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
import { labelM } from "../../../model/theater-metrics";
import { TheaterBtn, TheaterField, TheaterRangeField, TheaterSelect } from "../../theater-controls-ui";
import type { DecorSectionProps } from "./types";

export function TheaterControlsDecorSizeSection({ vm, decor }: DecorSectionProps) {
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
          {vm.activeDecorPreset.parametric ? (
<TheaterCollapsibleSection
            sectionId="decor-size"
              title="Размер"
              summary={
                activeParametricSize ? "Выбранный объект" : "Следующий предмет"
              }
              defaultOpen={Boolean(vm.activeModelId)}
            >
              <div className="theater-layout-grid">
                <TheaterRangeField
                  label={labelM("Ширина")}
                  min={0.2}
                  max={Math.max(2, vm.layout.hallWidth)}
                  step={0.1}
                  value={(activeParametricSize ?? draftDecorSize)[0]}
                  onChange={(value) => setDraftSizeAxis(0, value)}
                  {...historyTx}
                />
                <TheaterRangeField
                  label={labelM("Высота")}
                  min={0.1}
                  max={Math.max(1, vm.layout.wallHeight)}
                  step={0.1}
                  value={(activeParametricSize ?? draftDecorSize)[1]}
                  onChange={(value) => setDraftSizeAxis(1, value)}
                  {...historyTx}
                />
                <TheaterRangeField
                  label={labelM("Глубина")}
                  min={0.05}
                  max={2}
                  step={0.05}
                  value={(activeParametricSize ?? draftDecorSize)[2]}
                  onChange={(value) => setDraftSizeAxis(2, value)}
                  {...historyTx}
                />
              </div>
            </TheaterCollapsibleSection>
          ) : null}
</>
  );
}
