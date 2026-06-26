import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterSelect } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutTemplateSection({ vm, layout }: LayoutSectionProps) {
  const { hallTemplatePick, setHallTemplatePick, hallTemplateOptions } = layout;

  return (
    <>
      <TheaterCollapsibleSection
            sectionId="layout-template"
            title="Шаблон и экспорт"
            summary="Готовые залы и выгрузка плана"
            defaultOpen
          >
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
              placeholder="Применить шаблон…"
            />
            <div className="theater-btn-row theater-btn-row--3">
              <TheaterBtn
                onClick={vm.exportFloorPlanSvg}
                disabled={!vm.currentScene}
                title="SVG"
              >
                SVG
              </TheaterBtn>
              <TheaterBtn
                onClick={() => void vm.exportFloorPlanPng()}
                disabled={!vm.currentScene}
                title="PNG"
              >
                PNG
              </TheaterBtn>
              <TheaterBtn
                onClick={vm.exportFloorPlanPdf}
                disabled={!vm.currentScene}
                title="Печать / PDF"
              >
                PDF
              </TheaterBtn>
            </div>
            <TheaterBtn
              onClick={() => void vm.copyFloorPlanToClipboard()}
              disabled={!vm.currentScene}
              title="Скопировать план в буфер обмена как PNG"
            >
              План в буфер
            </TheaterBtn>
          </TheaterCollapsibleSection>
    </>
  );
}
