import { tc } from "../../../../../shared/styles/theme-color";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { DECOR_CATALOG } from "../../../model/theater-decor-catalog";
import {
  DECOR_TEXTURE_MODES,
  DECOR_TEXTURE_PRESETS,
} from "../../../model/theater-decor-textures";
import { DECOR_MATERIAL_SIDE_OPTIONS } from "../../../model/theater-decor-material";
import { DecorTexturePreview } from "../../DecorTexturePreview";
import {
  DECOR_TEXTURE_FACE_OPTIONS,
  supportsDecorTextureFaces,
  toggleDecorTextureFace,
} from "../../../model/theater-decor-faces";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField, TheaterRangeField, TheaterSelect } from "../../theater-controls-ui";
import type { DecorSectionProps } from "./types";

export function TheaterControlsDecorAppearanceSection({ vm, decor }: DecorSectionProps) {
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
            sectionId="decor-appearance"
            title="Вид"
            summary="Цвет и текстура"
            defaultOpen={Boolean(vm.activeModelId)}
          >
          <label className="theater-color-field">
            <span>Цвет</span>
            <input
              type="color"
              className="theater-color-input"
              value={vm.activeModel?.decorColor ?? draftDecorColor}
              onChange={(event) => {
                const next = event.target.value;
                if (vm.activeModelId && vm.activeModel) {
                  vm.updateModel(vm.activeModelId, { decorColor: next });
                  return;
                }
                vm.setDecorDraftColor(next);
              }}
            />
          </label>
          {vm.activeModel ? (
            <>
              <div className="theater-layout-subtitle">Материал Three.js</div>
              <div className="theater-layout-grid">
                <TheaterRangeField
                  label={`Прозрачность ${(vm.activeModel.decorOpacity ?? 1).toFixed(2)}`}
                  min={0}
                  max={1}
                  step={0.02}
                  value={vm.activeModel.decorOpacity ?? 1}
                  onChange={(value) =>
                    vm.activeModelId &&
                    vm.updateModel(vm.activeModelId, { decorOpacity: value })
                  }
                  {...historyTx}
                />
                <TheaterRangeField
                  label={`Roughness ${(vm.activeModel.decorRoughness ?? 0.82).toFixed(2)}`}
                  min={0}
                  max={1}
                  step={0.02}
                  value={vm.activeModel.decorRoughness ?? 0.82}
                  onChange={(value) =>
                    vm.activeModelId &&
                    vm.updateModel(vm.activeModelId, { decorRoughness: value })
                  }
                  {...historyTx}
                />
                <TheaterRangeField
                  label={`Metalness ${(vm.activeModel.decorMetalness ?? 0).toFixed(2)}`}
                  min={0}
                  max={1}
                  step={0.02}
                  value={vm.activeModel.decorMetalness ?? 0}
                  onChange={(value) =>
                    vm.activeModelId &&
                    vm.updateModel(vm.activeModelId, { decorMetalness: value })
                  }
                  {...historyTx}
                />
                <TheaterRangeField
                  label={`Emissive ${(vm.activeModel.decorEmissiveIntensity ?? 0).toFixed(2)}`}
                  min={0}
                  max={3}
                  step={0.05}
                  value={vm.activeModel.decorEmissiveIntensity ?? 0}
                  onChange={(value) =>
                    vm.activeModelId &&
                    vm.updateModel(vm.activeModelId, {
                      decorEmissiveIntensity: value,
                    })
                  }
                  {...historyTx}
                />
              </div>
              <label className="theater-color-field">
                <span>Свечение</span>
                <input
                  type="color"
                  className="theater-color-input"
                  value={vm.activeModel.decorEmissiveColor ?? "#000000"}
                  onChange={(event) =>
                    vm.activeModelId &&
                    vm.updateModel(vm.activeModelId, {
                      decorEmissiveColor: event.target.value,
                    })
                  }
                />
              </label>
              <TheaterSelect
                label="Сторона"
                value={vm.activeModel.decorMaterialSide ?? "double"}
                options={[...DECOR_MATERIAL_SIDE_OPTIONS]}
                onChange={(value) =>
                  vm.activeModelId &&
                  vm.updateModel(vm.activeModelId, {
                    decorMaterialSide: value as typeof vm.activeModel.decorMaterialSide,
                  })
                }
              />
              <div className="theater-btn-row">
                <TheaterBtn
                  onClick={() =>
                    vm.activeModelId &&
                    vm.updateModel(vm.activeModelId, {
                      decorOpacity: undefined,
                      decorRoughness: undefined,
                      decorMetalness: undefined,
                      decorEmissiveColor: undefined,
                      decorEmissiveIntensity: undefined,
                      decorMaterialSide: undefined,
                    })
                  }
                >
                  Сбросить материал
                </TheaterBtn>
              </div>
            </>
          ) : null}
          {showDecorTextures ? (
            <>
              <div className="theater-layout-subtitle">Текстура</div>
              {activeDecorTexture ? (
                <DecorTexturePreview
                  projectName={projectName}
                  textureRef={activeDecorTexture}
                  fallbackColor={vm.activeModel?.decorColor ?? draftDecorColor}
                  label={
                    DECOR_TEXTURE_PRESETS.find(
                      (item) => item.id === activeDecorTexturePresetId,
                    )?.label ?? "Текущая текстура"
                  }
                />
              ) : null}
              <div className="theater-decor-texture-palette">
                {DECOR_TEXTURE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`theater-decor-texture-swatch${
                      activeDecorTexturePresetId === preset.id
                        ? " theater-decor-texture-swatch--active"
                        : ""
                    }`}
                    title={preset.label}
                    style={{ backgroundColor: preset.tint }}
                    onClick={() => vm.applyDecorTexturePreset(preset.id)}
                  />
                ))}
              </div>
              <div className="theater-spotlight-grid">
                <TheaterBtn
                  onClick={() => decorTextureInputRef.current?.click()}
                  disabled={!vm.currentStep}
                >
                  Загрузить PNG/JPG
                </TheaterBtn>
                <TheaterBtn
                  onClick={() => vm.clearDecorTexture()}
                  disabled={!activeDecorTexture}
                >
                  Без текстуры
                </TheaterBtn>
              </div>
              <input
                ref={decorTextureInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="theater-decor-texture-input"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void vm.uploadDecorTextureFile(file);
                }}
              />
              <div className="theater-layout-subtitle">Режим текстуры</div>
              <div className="theater-btn-row theater-btn-row--3">
                {DECOR_TEXTURE_MODES.map((mode) => (
                  <TheaterBtn
                    key={mode.id}
                    active={activeDecorTextureMode === mode.id}
                    title={mode.title}
                    onClick={() => vm.setDecorTextureModeForTarget(mode.id)}
                  >
                    {mode.label}
                  </TheaterBtn>
                ))}
              </div>
              {activeDecorTextureMode === "repeat" && (
                <TheaterRangeField
                  label={`Плотность узора ${activeDecorTextureRepeat.toFixed(2)}/м`}
                  min={0.2}
                  max={3}
                  step={0.05}
                  value={activeDecorTextureRepeat}
                  onChange={(value) => vm.setDecorTextureRepeatForTarget(value)}
                  {...historyTx}
                />
              )}
              {activeDecorTextureMode === "once" && (
                <TheaterRangeField
                  label={`Масштаб ${activeDecorTextureRepeat.toFixed(2)} (1 = максимум)`}
                  min={0.1}
                  max={2}
                  step={0.05}
                  value={activeDecorTextureRepeat}
                  onChange={(value) => vm.setDecorTextureRepeatForTarget(value)}
                  {...historyTx}
                />
              )}
              {activeDecorTexture &&
                vm.activeModel &&
                supportsDecorTextureFaces(vm.activeModel.builtin) && (
                  <>
                    <div className="theater-layout-subtitle">Грани текстуры</div>
                    <div className="theater-btn-row theater-btn-row--3">
                      {DECOR_TEXTURE_FACE_OPTIONS.map((face) => (
                        <TheaterBtn
                          key={face.id}
                          active={activeTextureFaces.includes(face.id)}
                          disabled={!vm.activeModelId || vm.activeTab !== "decor"}
                          onClick={() => {
                            if (!vm.activeModelId || !vm.activeModel?.builtin) return;
                            vm.updateModel(vm.activeModelId, {
                              decorTextureFaces: toggleDecorTextureFace(
                                vm.activeModel.decorTextureFaces,
                                vm.activeModel.builtin,
                                face.id,
                              ),
                            });
                          }}
                        >
                          {face.label}
                        </TheaterBtn>
                      ))}
                    </div>
                  </>
                )}
            </>
          ) : null}
          </TheaterCollapsibleSection>
</>
  );
}
