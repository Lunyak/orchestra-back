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
    "updateLayout",
    "beginTheaterHistoryTransaction",
    "endTheaterHistoryTransaction",
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
  return out
    .replace(/\bvm\.vm\./g, "vm.")
    .replace(/theater-vm\.layout/g, "theater-layout");
}

function normalizeMarkup(src) {
  return src
    .replace(/<\/motion\.div>/g, "</div>")
    .replace(/<motion\.div/g, "<div");
}

const stageSrc = normalizeMarkup(
  fs.readFileSync(path.join(scriptDir, "stage-L1614.txt"), "utf8"),
);
const recessTitle = '<div className="theater-layout-title">';
const recessMarker = `${recessTitle}\u0423\u0433\u043b\u0443\u0431\u043b\u0435\u043d\u0438\u044f \u0432 \u0441\u0442\u0435\u043d\u0430\u0445</div>`;
const doorsMarker = `${recessTitle}\u0414\u0432\u0435\u0440\u0438</div>`;
const gridStart = stageSrc.indexOf('<div className="theater-layout-grid">');
const recessStart = stageSrc.indexOf(recessMarker);
const doorsStart = stageSrc.indexOf(doorsMarker);
if (gridStart < 0 || recessStart < 0 || doorsStart < 0) {
  throw new Error("stage-L1614.txt markers not found");
}

const STAGE_IMPORTS = `import { STAGE_SHAPE_LABELS } from "../../../model/theater-stage-geometry";
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
import { getStageFrontZBounds, labelM } from "../../../model/theater-metrics";
import {
  TheaterBtn,
  TheaterField,
  TheaterRangeField,
} from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
`;

const stageInner = vmify(stageSrc.slice(gridStart, recessStart));
const customPanel = vmify(
  normalizeMarkup(fs.readFileSync(path.join(scriptDir, "custom-L1741.txt"), "utf8")).replace(
    /theater-spotlight-batch/g,
    "theater-custom-outline-actions",
  ),
);

const stageHeader = `      <TheaterCollapsibleSection
        sectionId="layout-stage"
        title="\u041a\u043e\u043d\u0442\u0443\u0440 \u0438 \u0444\u043e\u0440\u043c\u0430"
        summary={layoutShapeLabel}
        badge={isCustomStageOutline ? "\u0421\u0432\u043e\u0439 \u043a\u043e\u043d\u0442\u0443\u0440" : undefined}
        defaultOpen={isCustomStageOutline}
      >
        <TheaterStageLayoutGuide layout={vm.layout} compact />
`;

const stageFrontZ = `
        {(vm.layout.stageShape ?? "rectangle") !== "custom" ? (
          <TheaterRangeField
            label={labelM("\u041f\u0435\u0440\u0435\u0434\u043d\u0438\u0439 \u043a\u0440\u0430\u0439 \u0441\u0446\u0435\u043d\u044b (Z)")}
            min={getStageFrontZBounds(vm.layout).min}
            max={getStageFrontZBounds(vm.layout).max}
            step={0.1}
            value={vm.layout.stageFrontZ ?? vm.layout.audienceStartZ}
            formatValue={(v) => v.toFixed(1)}
            onChange={(stageFrontZ) => vm.updateLayout({ stageFrontZ })}
            onInteractStart={vm.beginTheaterHistoryTransaction}
            onInteractEnd={vm.endTheaterHistoryTransaction}
          />
        ) : null}
`;

const stageBody =
  stageHeader + stageInner + stageFrontZ + customPanel + "\n      </TheaterCollapsibleSection>";

const stageFile = `${STAGE_IMPORTS}
export function TheaterControlsLayoutStageSection({ vm, layout }: LayoutSectionProps) {
  const { layoutShapeLabel, isCustomStageOutline } = layout;

  return (
    <>
${stageBody}
    </>
  );
}
`;

fs.writeFileSync(
  path.join(layoutDir, "TheaterControlsLayoutStageSection.tsx"),
  stageFile,
  "utf8",
);

const RECESS_IMPORTS = `import { THEATER_RECESS_WALL_LABELS } from "../../../model/theater-wall-recesses";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { labelM } from "../../../model/theater-metrics";
import type { LayoutSectionProps } from "./types";
`;

const recessListStart = stageSrc.indexOf(
  '<div className="theater-door-list">',
  recessStart,
);
const recessInner = vmify(stageSrc.slice(recessListStart, doorsStart)).replace(
  /theater-door-actions/g,
  "theater-btn-row theater-btn-row--3",
);

const recessFile = `${RECESS_IMPORTS}
export function TheaterControlsLayoutRecessesSection({ vm }: LayoutSectionProps) {
  if ((vm.layout.stageShape ?? "rectangle") === "custom") return null;

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-recesses"
        title="\u041d\u0438\u0448\u0438"
        summary="\u0423\u0433\u043b\u0443\u0431\u043b\u0435\u043d\u0438\u044f \u0432 \u0441\u0442\u0435\u043d\u0430\u0445"
        badge={vm.layoutRecesses.length > 0 ? String(vm.layoutRecesses.length) : undefined}
      >
${recessInner}
      </TheaterCollapsibleSection>
    </>
  );
}
`;

fs.writeFileSync(
  path.join(layoutDir, "TheaterControlsLayoutRecessesSection.tsx"),
  recessFile,
  "utf8",
);

const DOORS_IMPORTS = `import { THEATER_DOOR_WALL_LABELS } from "../../../model/theater-doors";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { labelM } from "../../../model/theater-metrics";
import type { LayoutSectionProps } from "./types";
`;

const doorsRaw = normalizeMarkup(
  fs.readFileSync(path.join(scriptDir, "doors-L995.txt"), "utf8"),
);
const doorsListStart = doorsRaw.indexOf('<div className="theater-door-list">');
if (doorsListStart < 0) throw new Error("theater-door-list not found in doors-L995.txt");
const doorsInner = vmify(doorsRaw.slice(doorsListStart));

const doorsFile = `${DOORS_IMPORTS}
export function TheaterControlsLayoutDoorsSection({ vm }: LayoutSectionProps) {
  if ((vm.layout.stageShape ?? "rectangle") === "custom") return null;

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-doors"
        title="\u0414\u0432\u0435\u0440\u0438"
        summary="\u041f\u0440\u043e\u0451\u043c\u044b \u0432 \u0441\u0442\u0435\u043d\u0430\u0445"
        badge={vm.layoutDoors.length > 0 ? String(vm.layoutDoors.length) : undefined}
      >
${doorsInner}
      </TheaterCollapsibleSection>
    </>
  );
}
`;

fs.writeFileSync(
  path.join(layoutDir, "TheaterControlsLayoutDoorsSection.tsx"),
  doorsFile,
  "utf8",
);

console.log("stage, doors, recesses written");
