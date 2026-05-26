import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutWallsSection({ vm, layout }: LayoutSectionProps) {

  return (
    <>
<TheaterCollapsibleSection
            sectionId="layout-walls-3d"
            title="Стены в 3D"
            summary="Видимость и высота"
          >
            <div className="theater-compact-checks">
              <LabeledCheckbox
                checked={vm.wallsHideFromCamera}
                disabled={vm.wallsHidden}
                onChange={vm.setWallsHideFromCamera}
              >
                Скрыть перед камерой
              </LabeledCheckbox>
              <LabeledCheckbox
                checked={vm.wallsOpaque}
                disabled={vm.wallsHidden}
                onChange={(checked) => {
                  vm.setWallsOpaque(checked);
                  if (checked) vm.setWallsHidden(false);
                }}
              >
                Непрозрачные
              </LabeledCheckbox>
              <LabeledCheckbox
                checked={vm.wallsHidden}
                onChange={(checked) => {
                  vm.setWallsHidden(checked);
                  if (checked) vm.setWallsOpaque(false);
                }}
              >
                Скрыть все
              </LabeledCheckbox>
            </div>
          </TheaterCollapsibleSection>
    </>
  );
}
