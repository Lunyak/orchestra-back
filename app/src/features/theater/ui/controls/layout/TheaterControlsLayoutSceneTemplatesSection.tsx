import { useRef } from "react";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutSceneTemplatesSection({
  vm,
}: LayoutSectionProps) {
  const templateInputRef = useRef<HTMLInputElement>(null);

  return (
    <TheaterCollapsibleSection
      sectionId="layout-scene-templates"
      title="Композиции сцены"
      summary="Готовые расстановки и JSON"
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
                onClick={() =>
                  vm.applyDecorTemplateByListId(template.id, true)
                }
                disabled={!vm.currentScene}
                title="Заменить композицию сцены шаблоном"
              >
                ↺
              </TheaterBtn>
            ) : null}
          </div>
        ))}
      </div>
      <div className="theater-decor-template-actions">
        <input
          ref={templateInputRef}
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
          onClick={() => templateInputRef.current?.click()}
          disabled={!vm.currentScene}
          title="Загрузить JSON-шаблон из файла"
        >
          Импорт JSON
        </TheaterBtn>
        <TheaterBtn
          onClick={vm.exportCurrentDecorAsJsonTemplate}
          disabled={!vm.currentScene}
          title="Сохранить композицию сцены как JSON-шаблон"
        >
          Экспорт JSON
        </TheaterBtn>
        <TheaterBtn
          onClick={() => void vm.saveDecorTemplatesToProject()}
          disabled={!vm.currentScene}
          title="Записать импортированные шаблоны в файл проекта"
        >
          В проект
        </TheaterBtn>
      </div>
    </TheaterCollapsibleSection>
  );
}
