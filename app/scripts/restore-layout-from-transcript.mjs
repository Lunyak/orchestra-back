import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const transcript =
  "C:/Users/Lunyak-Rdp/.cursor/projects/c-Users-Lunyak-Rdp-orchestra-back/agent-transcripts/131cec51-3cdd-44fd-bc4f-1fb807283cb0/131cec51-3cdd-44fd-bc4f-1fb807283cb0.jsonl";
const layoutDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/features/theater/ui/controls/layout",
);

const lines = fs.readFileSync(transcript, "utf8").split("\n");
const blobs = [];

for (const line of lines) {
  if (!line.includes("TheaterCollapsibleSection")) continue;
  try {
    const j = JSON.parse(line);
    for (const c of j.message?.content || []) {
      for (const k of ["contents", "new_string"]) {
        const s = c.input?.[k];
        if (typeof s === "string" && s.includes("sectionId=")) blobs.push(s);
      }
    }
  } catch {
    // ignore
  }
}

const combined = blobs.join("\n");
const sectionRe =
  /<TheaterCollapsibleSection[\s\S]*?<\/TheaterCollapsibleSection>/g;
const sections = new Map();
for (const block of combined.match(sectionRe) || []) {
  const id = block.match(/sectionId="([^"]+)"/)?.[1];
  if (!id || sections.has(id)) continue;
  sections.set(id, block);
}

const idToFile = {
  "layout-template": "TheaterControlsLayoutTemplateSection.tsx",
  "layout-view": "TheaterControlsLayoutViewSection.tsx",
  "layout-stage-grid": "TheaterControlsLayoutStageGridSection.tsx",
  "layout-seats": "TheaterControlsLayoutSeatsSection.tsx",
  "layout-hall-size": "TheaterControlsLayoutHallSizeSection.tsx",
  "layout-walls-3d": "TheaterControlsLayoutWallsSection.tsx",
  "layout-stage": "TheaterControlsLayoutStageSection.tsx",
  "layout-recesses": "TheaterControlsLayoutRecessesSection.tsx",
  "layout-doors": "TheaterControlsLayoutDoorsSection.tsx",
};

function vmify(body) {
  return body
    .replace(/\bcurrentStep\b/g, "vm.currentStep")
    .replace(/\blayout\b/g, "vm.layout")
    .replace(/\bshowSeats\b/g, "vm.showSeats")
    .replace(/\bsetShowSeats\b/g, "vm.setShowSeats")
    .replace(/\bshowGrid\b/g, "vm.showGrid")
    .replace(/\bsetShowGrid\b/g, "vm.setShowGrid")
    .replace(/\bshowStageGrid\b/g, "vm.showStageGrid")
    .replace(/\bsetShowStageGrid\b/g, "vm.setShowStageGrid")
    .replace(/\bsnapToGrid\b/g, "vm.snapToGrid")
    .replace(/\bsetSnapToGrid\b/g, "vm.setSnapToGrid")
    .replace(/\balignGuidesEnabled\b/g, "vm.alignGuidesEnabled")
    .replace(/\bsetAlignGuidesEnabled\b/g, "vm.setAlignGuidesEnabled")
    .replace(/\bshowFloorPlan\b/g, "vm.showFloorPlan")
    .replace(/\bsetShowFloorPlan\b/g, "vm.setShowFloorPlan")
    .replace(/\bfloorPlanExpanded\b/g, "vm.floorPlanExpanded")
    .replace(/\bsetFloorPlanExpanded\b/g, "vm.setFloorPlanExpanded")
    .replace(/\bspectaclePreviewMode\b/g, "vm.spectaclePreviewMode")
    .replace(/\bsetSpectaclePreviewMode\b/g, "vm.setSpectaclePreviewMode")
    .replace(/\bstepRehearsalMode\b/g, "vm.stepRehearsalMode")
    .replace(/\bsetStepRehearsalMode\b/g, "vm.setStepRehearsalMode")
    .replace(/\bgridStep\b/g, "vm.gridStep")
    .replace(/\bsetGridStep\b/g, "vm.setGridStep")
    .replace(/\bstageGrid\b/g, "vm.stageGrid")
    .replace(/\bupdateLayoutZoneGrid\b/g, "vm.updateLayoutZoneGrid")
    .replace(/\bwallsHideFromCamera\b/g, "vm.wallsHideFromCamera")
    .replace(/\bsetWallsHideFromCamera\b/g, "vm.setWallsHideFromCamera")
    .replace(/\bwallsOpaque\b/g, "vm.wallsOpaque")
    .replace(/\bsetWallsOpaque\b/g, "vm.setWallsOpaque")
    .replace(/\bwallsHidden\b/g, "vm.wallsHidden")
    .replace(/\bsetWallsHidden\b/g, "vm.setWallsHidden")
    .replace(/\bupdateLayout\b/g, "vm.updateLayout")
    .replace(/\bbeginTheaterHistoryTransaction\b/g, "vm.beginTheaterHistoryTransaction")
    .replace(/\bendTheaterHistoryTransaction\b/g, "vm.endTheaterHistoryTransaction")
    .replace(/\bapplyHallTemplate\b/g, "vm.applyHallTemplate")
    .replace(/\bexportFloorPlanSvg\b/g, "vm.exportFloorPlanSvg")
    .replace(/\bexportFloorPlanPng\b/g, "vm.exportFloorPlanPng")
    .replace(/\bexportFloorPlanPdf\b/g, "vm.exportFloorPlanPdf")
    .replace(/\bcopyFloorPlanToClipboard\b/g, "vm.copyFloorPlanToClipboard")
    .replace(/\bcopyLightCuesToClipboard\b/g, "vm.copyLightCuesToClipboard")
    .replace(/\bapplyTargetSeatCount\b/g, "vm.applyTargetSeatCount")
    .replace(/\bfitLayoutFromOutline\b/g, "vm.fitLayoutFromOutline")
    .replace(/\bfitLayoutToSeatCount\b/g, "vm.fitLayoutToSeatCount")
    .replace(/\bsetAudienceSeatsHighlight\b/g, "vm.setAudienceSeatsHighlight")
    .replace(/\boutlineDrawMode\b/g, "vm.outlineDrawMode")
    .replace(/\bsetOutlineDrawMode\b/g, "vm.setOutlineDrawMode")
    .replace(/\bactiveOutlineVertexIndex\b/g, "vm.activeOutlineVertexIndex")
    .replace(/\bsetActiveTab\b/g, "vm.setActiveTab")
    .replace(/\bremoveActiveOutlineVertex\b/g, "vm.removeActiveOutlineVertex")
    .replace(/\bremoveLastOutlinePoint\b/g, "vm.removeLastOutlinePoint")
    .replace(/\bseedStageOutlineFromCurrentShape\b/g, "vm.seedStageOutlineFromCurrentShape")
    .replace(/\bresetStageOutlineToRectangle\b/g, "vm.resetStageOutlineToRectangle")
    .replace(/\blayoutDoors\b/g, "vm.layoutDoors")
    .replace(/\bactiveDoorId\b/g, "vm.activeDoorId")
    .replace(/\bsetActiveDoorId\b/g, "vm.setActiveDoorId")
    .replace(/\baddDoor\b/g, "vm.addDoor")
    .replace(/\bremoveActiveDoor\b/g, "vm.removeActiveDoor")
    .replace(/\bupdateActiveDoor\b/g, "vm.updateActiveDoor")
    .replace(/\blayoutRecesses\b/g, "vm.layoutRecesses")
    .replace(/\bactiveRecessId\b/g, "vm.activeRecessId")
    .replace(/\bsetActiveRecessId\b/g, "vm.setActiveRecessId")
    .replace(/\baddWallRecess\b/g, "vm.addWallRecess")
    .replace(/\bremoveActiveWallRecess\b/g, "vm.removeActiveWallRecess")
    .replace(/\bupdateActiveWallRecess\b/g, "vm.updateActiveWallRecess")
    .replace(/\bvm\.vm\./g, "vm.");
}

const VIEW_IMPORTS = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { labelM } from "../../../model/theater-metrics";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { useTheaterControlsLightChannels } from "../use-theater-controls-light-channels";
import type { LayoutSectionProps } from "./types";
`;

const SEATS_IMPORTS = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { getAudienceStartZBounds, labelM } from "../../../model/theater-metrics";
import { TheaterBtn, TheaterField, TheaterRangeField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
`;

const TEMPLATE_IMPORTS = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterSelect } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
`;

const FULL_IMPORTS = `import { THEATER_DOOR_WALL_LABELS } from "../../../model/theater-doors";
import { THEATER_RECESS_WALL_LABELS } from "../../../model/theater-wall-recesses";
import { STAGE_SHAPE_LABELS } from "../../../model/theater-stage-geometry";
import {
  defaultCustomStageOutline,
  defaultCustomStageOutlineOpenEdges,
  MIN_STAGE_OUTLINE_POINTS,
  resolveStageOutlinePoints,
} from "../../../model/theater-custom-outline";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterStageLayoutGuide } from "../../TheaterStageLayoutGuide";
import type { TheaterStageShape } from "../../../../../shared/types/script";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { getAudienceStartZBounds, getStageFrontZBounds, labelM } from "../../../model/theater-metrics";
import {
  TheaterBtn,
  TheaterField,
  TheaterRangeField,
  TheaterSelect,
} from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
`;

const WALLS_IMPORTS = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import type { LayoutSectionProps } from "./types";
`;

const STAGE_GRID_IMPORTS = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { TheaterField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
`;

const HALL_IMPORTS = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { labelM } from "../../../model/theater-metrics";
import { TheaterField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
`;

const DOORS_IMPORTS = `import { THEATER_DOOR_WALL_LABELS } from "../../../model/theater-doors";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField, TheaterSelect } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
`;

const RECESSES_IMPORTS = `import { THEATER_RECESS_WALL_LABELS } from "../../../model/theater-wall-recesses";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField, TheaterSelect } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
`;

const importsById = {
  "layout-template": TEMPLATE_IMPORTS,
  "layout-view": VIEW_IMPORTS,
  "layout-stage-grid": STAGE_GRID_IMPORTS,
  "layout-seats": SEATS_IMPORTS,
  "layout-hall-size": HALL_IMPORTS,
  "layout-walls-3d": WALLS_IMPORTS,
  "layout-stage": FULL_IMPORTS,
  "layout-recesses": RECESSES_IMPORTS,
  "layout-doors": DOORS_IMPORTS,
};

const destructureById = {
  "layout-template": "  const { hallTemplatePick, setHallTemplatePick, hallTemplateOptions } = layout;\n",
  "layout-view":
    "  const { layoutHallBadge } = layout;\n  const { lightChannels } = useTheaterControlsLightChannels();\n",
  "layout-seats":
    "  const {\n    outlineFitSeats,\n    setOutlineFitSeats,\n    outlineFitSeatsFocusedRef,\n    commitOutlineFitSeats,\n    layoutSeatBadge,\n    isCustomStageOutline,\n  } = layout;\n",
  "layout-hall-size": "  const { layoutHallBadge } = layout;\n",
  "layout-stage-grid": "",
  "layout-walls-3d": "",
  "layout-stage":
    "  const { layoutShapeLabel, isCustomStageOutline } = layout;\n",
  "layout-recesses": "",
  "layout-doors": "",
};

console.log("found sections:", [...sections.keys()].sort().join(", "));

for (const [id, file] of Object.entries(idToFile)) {
  let block = sections.get(id);
  if (!block) {
    console.warn("missing section:", id);
    continue;
  }
  block = vmify(block);
  // seats-specific replacements
  if (id === "layout-seats") {
    block = block
      .replace(/\boutlineFitSeats\b/g, "outlineFitSeats")
      .replace(/\bsetOutlineFitSeats\b/g, "setOutlineFitSeats")
      .replace(/\boutlineFitSeatsFocusedRef\b/g, "outlineFitSeatsFocusedRef")
      .replace(/\bcommitOutlineFitSeats\b/g, "commitOutlineFitSeats")
      .replace(/\blayoutSeatBadge\b/g, "layoutSeatBadge")
      .replace(/\bisCustomStageOutline\b/g, "isCustomStageOutline");
  }
  if (id === "layout-template") {
    block = block
      .replace(/\bvm\.hallTemplatePick\b/g, "hallTemplatePick")
      .replace(/\bvm\.setHallTemplatePick\b/g, "setHallTemplatePick")
      .replace(/\bvm\.hallTemplateOptions\b/g, "hallTemplateOptions");
  }
  if (id === "layout-hall-size") {
    block = block.replace(/\bvm\.layoutHallBadge\b/g, "layoutHallBadge");
  }
  if (id === "layout-view") {
    block = block
      .replace(/\bvm\.layoutHallBadge\b/g, "layoutHallBadge")
      .replace(
        /<LabeledCheckbox checked={vm\.showGrid}/,
        `<LabeledCheckbox checked={vm.showStageGrid} onChange={vm.setShowStageGrid}>
            Сетка сцены
          </LabeledCheckbox>
          <LabeledCheckbox checked={vm.showGrid}`,
      );
    // ensure showStageGrid exists - check transcript line 2680 had both
  }

  const name = path.basename(file, ".tsx");
  const imports = importsById[id] || FULL_IMPORTS;
  const destructure = destructureById[id] ?? "";
  const content = `${imports}
export function ${name}({ vm, layout }: LayoutSectionProps) {
${destructure}
  return (
    <>
      ${block}
    </>
  );
}
`;
  fs.writeFileSync(path.join(layoutDir, file), content, "utf8");
  console.log("wrote", file, content.length);
}

fs.writeFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "_sections-found.json"),
  JSON.stringify([...sections.keys()], null, 2),
);
