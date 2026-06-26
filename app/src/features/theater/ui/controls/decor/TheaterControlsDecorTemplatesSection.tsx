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

export function TheaterControlsDecorTemplatesSection({ vm, decor }: DecorSectionProps) {
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
            sectionId="decor-templates"
            title="Шаблоны сцены"
            summary="Готовые наборы и JSON"
          >
          <div className="theater-decor-template-list">
            {vm.decorTemplateList.map((template) => (
              <div key={template.id} className="theater-decor-template-row">
                <TheaterBtn
                  onClick={() => vm.applyDecorTemplateByListId(template.id)}
                  disabled={!vm.currentScene}
                  title={
                    template.description
                      ? `${template.description} — добавить`
                      : "Добавить на сцену"
                  }
                >
                  + {template.label}
                  {template.revision ? ` · r${template.revision}` : ""}
                  {template.source !== "builtin" ? " *" : ""}
                </TheaterBtn>
                {template.source === "builtin" ? (
                  <TheaterBtn
                    onClick={() => vm.applyDecorTemplateByListId(template.id, true)}
                    disabled={!vm.currentScene}
                    title="Заменить весь декор шаблоном"
                  >
                    ↺
                  </TheaterBtn>
                ) : null}
              </div>
            ))}
          </div>
          <div className="theater-decor-template-actions">
            <input
              ref={decorTemplateInputRef}
              type="file"
              accept="application/json,.json"
              className="theater-decor-texture-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void file.text().then((text) => {
                  try {
                    vm.importDecorTemplateFromJson(JSON.parse(text), true);
                  } catch {
                    vm.importDecorTemplateFromJson(null, false);
                  }
                });
              }}
            />
            <TheaterBtn
              onClick={() => decorTemplateInputRef.current?.click()}
              disabled={!vm.currentScene}
              title="Загрузить JSON-шаблон из файла"
            >
              Импорт JSON
            </TheaterBtn>
            <TheaterBtn
              onClick={vm.exportCurrentDecorAsJsonTemplate}
              disabled={!vm.currentScene}
              title="Сохранить текущий декор как JSON-шаблон"
            >
              Экспорт JSON
            </TheaterBtn>
            <TheaterBtn
              onClick={() => void vm.saveDecorTemplatesToProject()}
              disabled={!vm.currentScene}
              title="Записать импортированные шаблоны в файл проекта (desktop)"
            >
              В проект
            </TheaterBtn>
          </div>
          </TheaterCollapsibleSection>
</>
  );
}
