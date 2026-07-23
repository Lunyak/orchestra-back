import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterSelect } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutTemplateSection({ vm, layout }: LayoutSectionProps) {
  const { hallTemplatePick, setHallTemplatePick, hallTemplateOptions } = layout;

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-template"
        title="Быстрый старт"
        summary="Готовая конфигурация зала"
        defaultOpen
      >
        <p className="theater-layout-hint">
          Выберите основу, затем уточните размеры и форму в следующих разделах.
        </p>
        <TheaterSelect
          label="Шаблон зала"
          value={hallTemplatePick}
          options={hallTemplateOptions}
          onChange={(nextValue) => {
            if (!nextValue) return;
            vm.applyHallTemplate(nextValue);
            setHallTemplatePick("");
          }}
          disabled={!vm.currentScene}
          placeholder="Выбрать шаблон…"
        />
      </TheaterCollapsibleSection>
    </>
  );
}
