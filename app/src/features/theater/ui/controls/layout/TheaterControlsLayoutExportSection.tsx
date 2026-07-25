import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutExportSection({
  vm,
}: LayoutSectionProps) {
  return (
    <TheaterCollapsibleSection
      sectionId="layout-export"
      title="Экспорт плана"
    >
      <div className="theater-btn-row theater-btn-row--3">
        <TheaterBtn
          onClick={vm.exportFloorPlanSvg}
          disabled={!vm.currentScene}
        >
          SVG
        </TheaterBtn>
        <TheaterBtn
          onClick={() => void vm.exportFloorPlanPng()}
          disabled={!vm.currentScene}
        >
          PNG
        </TheaterBtn>
        <TheaterBtn
          onClick={vm.exportFloorPlanPdf}
          disabled={!vm.currentScene}
        >
          PDF
        </TheaterBtn>
      </div>
      <TheaterBtn
        onClick={() => void vm.copyFloorPlanToClipboard()}
        disabled={!vm.currentScene}
      >
        Скопировать план
      </TheaterBtn>
    </TheaterCollapsibleSection>
  );
}
