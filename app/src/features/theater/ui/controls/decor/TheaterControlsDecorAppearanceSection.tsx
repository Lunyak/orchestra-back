import cn from "classnames";
import {
  DECOR_TEXTURE_MODES,
  DECOR_TEXTURE_PRESETS,
  toDecorTexturePresetRef,
} from "../../../model/theater-decor-textures";
import {
  DECOR_TEXTURE_FACE_OPTIONS,
  supportsDecorTextureFaces,
  toggleDecorTextureFace,
} from "../../../model/theater-decor-faces";
import { DECOR_MATERIAL_SIDE_OPTIONS } from "../../../model/theater-decor-material";
import { DecorTexturePreview } from "../../DecorTexturePreview";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterModelPreview } from "../../TheaterModelPreview";
import {
  TheaterBtn,
  TheaterRangeField,
  TheaterSelect,
} from "../../theater-controls-ui";
import type { DecorSectionProps } from "./types";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M4 15v4h16v-4" />
    </svg>
  );
}

export function TheaterControlsDecorAppearanceSection({
  vm,
  decor,
}: DecorSectionProps) {
  const {
    activeDecorTexture,
    activeDecorTexturePresetId,
    activeDecorTextureRepeat,
    activeDecorTextureMode,
    activeTextureFaces,
    decorTextureInputRef,
    historyTx,
    projectName,
    showDecorTextures,
  } = decor;
  const activeModel = vm.activeModel;
  const activeModelId = vm.activeModelId;

  if (!activeModel || activeModelId == null) {
    return (
      <div className="theater-decor-empty-state">
        <strong>Выберите объект на сцене</strong>
        <span>Настройки цвета и материала появятся здесь.</span>
      </div>
    );
  }

  const activeColor = activeModel.decorColor ?? "#ffffff";
  const textureLabel =
    DECOR_TEXTURE_PRESETS.find(
      (item) => item.id === activeDecorTexturePresetId,
    )?.label ?? "Загруженная текстура";

  return (
    <>
      <div className="theater-decor-selected-model">
        <TheaterModelPreview projectName={projectName} model={activeModel} />
        <strong>{activeModel.name}</strong>
      </div>

      <TheaterCollapsibleSection
        sectionId="decor-color"
        title="Цвет"
        defaultOpen
      >
        <div className="theater-color-field theater-color-field--inline theater-decor-color-row">
          <input
            type="color"
            className="theater-color-input"
            value={activeColor}
            aria-label="Цвет"
            onChange={(event) =>
              vm.updateModel(activeModelId, {
                decorColor: event.target.value,
              })
            }
          />
          <span className="theater-decor-color-value">{activeColor}</span>
          <TheaterBtn
            onClick={() =>
              vm.updateModel(activeModelId, { decorColor: undefined })
            }
            disabled={!activeModel.decorColor}
          >
            Сбросить
          </TheaterBtn>
        </div>
      </TheaterCollapsibleSection>

      {showDecorTextures ? (
        <TheaterCollapsibleSection
          sectionId="decor-texture"
          title="Текстура"
          defaultOpen
          headerActions={
            <>
              <TheaterBtn
                className="theater-btn--icon"
                onClick={() => decorTextureInputRef.current?.click()}
                disabled={!vm.currentScene}
                title="Загрузить изображение"
                aria-label="Загрузить изображение"
              >
                <UploadIcon />
              </TheaterBtn>
              <TheaterBtn
                className="theater-btn--danger"
                onClick={() => vm.clearDecorTexture()}
                disabled={!activeDecorTexture}
                title="Убрать текстуру"
                aria-label="Убрать текстуру"
              >
                ×
              </TheaterBtn>
            </>
          }
        >
          <div className="theater-decor-texture-options">
            {DECOR_TEXTURE_PRESETS.map((preset) => {
              const selected = activeDecorTexturePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "theater-decor-texture-option",
                    selected && "theater-decor-texture-option--active",
                  )}
                  onClick={() => vm.applyDecorTexturePreset(preset.id)}
                >
                  <DecorTexturePreview
                    projectName={projectName}
                    textureRef={toDecorTexturePresetRef(preset.id)}
                    label={preset.label}
                  />
                </button>
              );
            })}
          </div>

          {activeDecorTexture ? (
            <div className="theater-decor-current-texture">
              <span className="theater-label">Сейчас используется</span>
              <DecorTexturePreview
                projectName={projectName}
                textureRef={activeDecorTexture}
                fallbackColor={activeColor}
                label={textureLabel}
              />
            </div>
          ) : (
            <span className="theater-layout-hint">
              Текстура не выбрана — используется только цвет.
            </span>
          )}

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

          <TheaterSelect
            label="Наложение"
            value={activeDecorTextureMode}
            options={DECOR_TEXTURE_MODES.map((mode) => ({
              value: mode.id,
              label: mode.label,
            }))}
            onChange={(value) => {
              const mode = DECOR_TEXTURE_MODES.find(
                (item) => item.id === value,
              );
              if (mode) vm.setDecorTextureModeForTarget(mode.id);
            }}
          />

          {activeDecorTextureMode === "repeat" ? (
            <TheaterRangeField
              label="Повтор узора"
              min={0.2}
              max={3}
              step={0.05}
              value={activeDecorTextureRepeat}
              formatValue={(value) => value.toFixed(2)}
              onChange={(value) => vm.setDecorTextureRepeatForTarget(value)}
              {...historyTx}
            />
          ) : null}
          {activeDecorTextureMode === "once" ? (
            <TheaterRangeField
              label="Масштаб"
              min={0.1}
              max={2}
              step={0.05}
              value={activeDecorTextureRepeat}
              formatValue={(value) => value.toFixed(2)}
              onChange={(value) => vm.setDecorTextureRepeatForTarget(value)}
              {...historyTx}
            />
          ) : null}

          {activeDecorTexture &&
          activeModel.builtin &&
          supportsDecorTextureFaces(activeModel.builtin) ? (
            <>
              <span className="theater-label">Показывать на гранях</span>
              <div className="theater-btn-row theater-btn-row--3">
                {DECOR_TEXTURE_FACE_OPTIONS.map((face) => (
                  <TheaterBtn
                    key={face.id}
                    active={activeTextureFaces.includes(face.id)}
                    onClick={() =>
                      vm.updateModel(activeModelId, {
                        decorTextureFaces: toggleDecorTextureFace(
                          activeModel.decorTextureFaces,
                          activeModel.builtin,
                          face.id,
                        ),
                      })
                    }
                  >
                    {face.label}
                  </TheaterBtn>
                ))}
              </div>
            </>
          ) : null}
        </TheaterCollapsibleSection>
      ) : null}

      <TheaterCollapsibleSection
        sectionId="decor-material"
        title="Дополнительно"
        className="theater-panel-section--compact-labels"
      >
        <TheaterRangeField
          label="Непрозрачность"
          min={0}
          max={1}
          step={0.02}
          value={activeModel.decorOpacity ?? 1}
          formatValue={(value) => value.toFixed(2)}
          onChange={(value) =>
            vm.updateModel(activeModelId, { decorOpacity: value })
          }
          {...historyTx}
        />
        <TheaterRangeField
          label="Шероховатость"
          min={0}
          max={1}
          step={0.02}
          value={activeModel.decorRoughness ?? 0.82}
          formatValue={(value) => value.toFixed(2)}
          onChange={(value) =>
            vm.updateModel(activeModelId, { decorRoughness: value })
          }
          {...historyTx}
        />
        <TheaterRangeField
          label="Металличность"
          min={0}
          max={1}
          step={0.02}
          value={activeModel.decorMetalness ?? 0}
          formatValue={(value) => value.toFixed(2)}
          onChange={(value) =>
            vm.updateModel(activeModelId, { decorMetalness: value })
          }
          {...historyTx}
        />
        <label className="theater-color-field">
          <span className="theater-label">Цвет свечения</span>
          <input
            type="color"
            className="theater-color-input"
            value={activeModel.decorEmissiveColor ?? "#000000"}
            onChange={(event) =>
              vm.updateModel(activeModelId, {
                decorEmissiveColor: event.target.value,
              })
            }
          />
        </label>
        <TheaterRangeField
          label="Яркость свечения"
          min={0}
          max={3}
          step={0.05}
          value={activeModel.decorEmissiveIntensity ?? 0}
          formatValue={(value) => value.toFixed(2)}
          onChange={(value) =>
            vm.updateModel(activeModelId, {
              decorEmissiveIntensity: value,
            })
          }
          {...historyTx}
        />
        <TheaterSelect
          label="Видимые стороны"
          value={activeModel.decorMaterialSide ?? "double"}
          options={[...DECOR_MATERIAL_SIDE_OPTIONS]}
          onChange={(value) => {
            const side = DECOR_MATERIAL_SIDE_OPTIONS.find(
              (item) => item.value === value,
            );
            if (side) {
              vm.updateModel(activeModelId, {
                decorMaterialSide: side.value,
              });
            }
          }}
        />
        <TheaterBtn
          onClick={() =>
            vm.updateModel(activeModelId, {
              decorOpacity: undefined,
              decorRoughness: undefined,
              decorMetalness: undefined,
              decorEmissiveColor: undefined,
              decorEmissiveIntensity: undefined,
              decorMaterialSide: undefined,
            })
          }
        >
          Сбросить дополнительные параметры
        </TheaterBtn>
      </TheaterCollapsibleSection>
    </>
  );
}
