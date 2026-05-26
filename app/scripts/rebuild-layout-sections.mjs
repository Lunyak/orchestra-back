import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const layoutDir = path.join(
  scriptDir,
  "../src/features/theater/ui/controls/layout",
);

function vmify(src) {
  const names = [
    "currentStep",
    "layout",
    "showSeats",
    "setShowSeats",
    "showGrid",
    "setShowGrid",
    "showStageGrid",
    "setShowStageGrid",
    "snapToGrid",
    "setSnapToGrid",
    "alignGuidesEnabled",
    "setAlignGuidesEnabled",
    "showFloorPlan",
    "setShowFloorPlan",
    "floorPlanExpanded",
    "setFloorPlanExpanded",
    "spectaclePreviewMode",
    "setSpectaclePreviewMode",
    "stepRehearsalMode",
    "setStepRehearsalMode",
    "gridStep",
    "setGridStep",
    "stageGrid",
    "updateLayoutZoneGrid",
    "wallsHideFromCamera",
    "setWallsHideFromCamera",
    "wallsOpaque",
    "setWallsOpaque",
    "wallsHidden",
    "setWallsHidden",
    "updateLayout",
    "beginTheaterHistoryTransaction",
    "endTheaterHistoryTransaction",
    "applyHallTemplate",
    "exportFloorPlanSvg",
    "exportFloorPlanPng",
    "exportFloorPlanPdf",
    "copyFloorPlanToClipboard",
    "copyLightCuesToClipboard",
    "applyTargetSeatCount",
    "fitLayoutFromOutline",
    "fitLayoutToSeatCount",
    "setAudienceSeatsHighlight",
    "outlineDrawMode",
    "setOutlineDrawMode",
    "activeOutlineVertexIndex",
    "setActiveTab",
    "removeActiveOutlineVertex",
    "removeLastOutlinePoint",
    "seedStageOutlineFromCurrentShape",
    "resetStageOutlineToRectangle",
    "layoutDoors",
    "activeDoorId",
    "setActiveDoorId",
    "addDoor",
    "removeActiveDoor",
    "updateActiveDoor",
    "layoutRecesses",
    "activeRecessId",
    "setActiveRecessId",
    "addWallRecess",
    "removeActiveWallRecess",
    "updateActiveWallRecess",
  ];
  let out = src;
  for (const name of names) {
    out = out.replace(new RegExp(`\\b${name}\\b`, "g"), `vm.${name}`);
  }
  return out.replace(/\bvm\.vm\./g, "vm.");
}

function wrapSection(name, imports, destructure, body) {
  return `${imports}
export function ${name}({ vm, layout }: LayoutSectionProps) {
${destructure}
  return (
    <>
${body}
    </>
  );
}
`;
}

const VIEW = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { labelM } from "../../../model/theater-metrics";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { useTheaterControlsLightChannels } from "../use-theater-controls-light-channels";
import type { LayoutSectionProps } from "./types";
`;

fs.copyFileSync(
  path.join(scriptDir, "seats-L2683.txt"),
  path.join(layoutDir, "TheaterControlsLayoutSeatsSection.tsx"),
);

const viewBody = fs.readFileSync(path.join(scriptDir, "_layout-chunk.txt"), "utf8");
const viewMatch = viewBody.match(
  /<TheaterCollapsibleSection[\s\S]*?sectionId="layout-view"[\s\S]*?<\/TheaterCollapsibleSection>/,
);
if (!viewMatch) throw new Error("layout-view block missing");
let viewBlock = vmify(viewMatch[0]);
viewBlock = viewBlock.replace(
  /<LabeledCheckbox checked={vm\.showGrid} onChange={vm\.setShowGrid}>\s*Сетка\s*<\/LabeledCheckbox>/,
  `<LabeledCheckbox checked={vm.showStageGrid} onChange={vm.setShowStageGrid}>
            Сетка сцены
          </LabeledCheckbox>
          <LabeledCheckbox checked={vm.showGrid} onChange={vm.setShowGrid}>
            Сетка зала
          </LabeledCheckbox>`,
);
viewBlock = viewBlock.replace(/\{layoutHallBadge\}/g, "{layoutHallBadge}");
viewBlock = viewBlock.replace(/\blayoutHallBadge\b/g, "layoutHallBadge");

fs.writeFileSync(
  path.join(layoutDir, "TheaterControlsLayoutViewSection.tsx"),
  wrapSection(
    "TheaterControlsLayoutViewSection",
    VIEW,
    `  const { layoutHallBadge } = layout;
  const { lightChannels } = useTheaterControlsLightChannels();
`,
    viewBlock,
  ),
  "utf8",
);

const template = fs.readFileSync(
  path.join(layoutDir, "TheaterControlsLayoutTemplateSection.tsx"),
  "utf8",
);
fs.writeFileSync(
  path.join(layoutDir, "TheaterControlsLayoutTemplateSection.tsx"),
  template.replace('sectionId="vm.layout-template"', 'sectionId="layout-template"'),
  "utf8",
);

const STAGE_GRID_IMPORTS = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { TheaterField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
`;
const stageGridRaw = fs.readFileSync(path.join(scriptDir, "chunk-L2255.txt"), "utf8");
const stageGridMatch = stageGridRaw.match(
  /<TheaterCollapsibleSection[\s\S]*?sectionId="layout-stage-grid"[\s\S]*?<\/TheaterCollapsibleSection>/,
);
if (!stageGridMatch) throw new Error("stage-grid missing");
let stageGridBlock = vmify(stageGridMatch[0]);
stageGridBlock = stageGridBlock.replace(
  /\$\{vm\.stageGrid\.cols\}\?\$\{vm\.stageGrid\.rows\}/,
  "${vm.stageGrid.cols}×${vm.stageGrid.rows}",
);
stageGridBlock += `
            <LabeledCheckbox checked={vm.showStageGrid} onChange={vm.setShowStageGrid}>
              Показывать на сцене и в плане
            </LabeledCheckbox>`;

fs.writeFileSync(
  path.join(layoutDir, "TheaterControlsLayoutStageGridSection.tsx"),
  wrapSection("TheaterControlsLayoutStageGridSection", STAGE_GRID_IMPORTS, "", stageGridBlock),
  "utf8",
);

const WALLS_IMPORTS = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import type { LayoutSectionProps } from "./types";
`;
const wallsRaw = fs.readFileSync(path.join(scriptDir, "chunk-L2005.txt"), "utf8");
const wallsMatch = wallsRaw.match(
  /<TheaterCollapsibleSection[\s\S]*?sectionId="layout-walls-3d"[\s\S]*?<\/TheaterCollapsibleSection>/,
);
fs.writeFileSync(
  path.join(layoutDir, "TheaterControlsLayoutWallsSection.tsx"),
  wrapSection(
    "TheaterControlsLayoutWallsSection",
    WALLS_IMPORTS,
    "",
    vmify(wallsMatch[0]),
  ),
  "utf8",
);

const HALL_IMPORTS = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { labelM } from "../../../model/theater-metrics";
import { TheaterField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
`;
const hallBody = `      <TheaterCollapsibleSection
        sectionId="layout-hall-size"
        title="Габариты зала"
        summary="Ширина, глубина, ряды"
        badge={layoutHallBadge}
      >
        <div className="theater-layout-grid">
          <TheaterField label={labelM("Ширина")}>
            <input
              type="number"
              className="native-text-input"
              min={6}
              step={0.5}
              value={vm.layout.hallWidth}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ hallWidth: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Глубина")}>
            <input
              type="number"
              className="native-text-input"
              min={6}
              step={0.5}
              value={vm.layout.hallDepth}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ hallDepth: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Высота стен")}>
            <input
              type="number"
              className="native-text-input"
              min={2.5}
              step={0.1}
              value={vm.layout.wallHeight}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ wallHeight: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Проход")}>
            <input
              type="number"
              className="native-text-input"
              min={0}
              step={0.1}
              value={vm.layout.aisleWidth}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ aisleWidth: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Проход X")}>
            <input
              type="number"
              className="native-text-input"
              step={0.1}
              value={vm.layout.aisleCenterX}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ aisleCenterX: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
          <TheaterField label="Ряды">
            <input
              type="number"
              className="native-text-input"
              min={0}
              step={1}
              value={vm.layout.seatRows}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({
                  seatRows: Math.max(0, Number(event.target.value) || 0),
                })
              }
            />
          </TheaterField>
          <TheaterField label="Мест/ряд">
            <input
              type="number"
              className="native-text-input"
              min={1}
              step={1}
              value={vm.layout.seatsPerRow}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({
                  seatsPerRow: Math.max(1, Number(event.target.value) || 1),
                })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Подъём ряда")}>
            <input
              type="number"
              className="native-text-input"
              min={0}
              step={0.05}
              value={vm.layout.rowRise}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ rowRise: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
        </div>
      </TheaterCollapsibleSection>`;

fs.writeFileSync(
  path.join(layoutDir, "TheaterControlsLayoutHallSizeSection.tsx"),
  wrapSection(
    "TheaterControlsLayoutHallSizeSection",
    HALL_IMPORTS,
    "  const { layoutHallBadge } = layout;\n",
    hallBody,
  ),
  "utf8",
);

console.log("rebuilt layout sections OK");
