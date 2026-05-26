import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const layoutDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/features/theater/ui/controls/layout",
);

const files = [
  "TheaterControlsLayoutTemplateSection.tsx",
  "TheaterControlsLayoutViewSection.tsx",
  "TheaterControlsLayoutStageGridSection.tsx",
  "TheaterControlsLayoutSeatsSection.tsx",
  "TheaterControlsLayoutHallSizeSection.tsx",
  "TheaterControlsLayoutWallsSection.tsx",
  "TheaterControlsLayoutStageSection.tsx",
  "TheaterControlsLayoutRecessesSection.tsx",
  "TheaterControlsLayoutDoorsSection.tsx",
];

function fixBody(raw) {
  let body = raw
    .replace(/\n\s*<TheaterCollapsibleSection\s*$/m, "")
    .trimEnd();
  if (/^\s*sectionId=/m.test(body) && !body.includes("<TheaterCollapsibleSection")) {
    body = `          <TheaterCollapsibleSection\n${body}`;
  }
  body = body.replace(/Cue\s*>\s*[^\n<]+/g, "Cue → буфер");
  body = body.replace(/Места\s*>\s*зал/g, "Места → зал");
  body = body.replace(/[^\n<]{2,}\s*>\s*зал/g, (m) =>
    m.includes(">") && !m.includes("<") ? "Места → зал" : m,
  );
  return body;
}

const LAYOUT_IMPORTS = `import { THEATER_DOOR_WALL_LABELS } from "../../../model/theater-doors";
import { THEATER_RECESS_WALL_LABELS } from "../../../model/theater-wall-recesses";
import { STAGE_SHAPE_LABELS } from "../../../model/theater-stage-geometry";
import {
  defaultCustomStageOutline,
  defaultCustomStageOutlineOpenEdges,
  MIN_STAGE_OUTLINE_POINTS,
  resolveStageOutlinePoints,
} from "../../../model/theater-custom-outline";
import { TheaterCollapsibleSection } from "../TheaterCollapsibleSection";
import { TheaterStageLayoutGuide } from "../TheaterStageLayoutGuide";
import type { TheaterStageShape } from "../../../../../shared/types/script";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { getAudienceStartZBounds, getStageFrontZBounds, labelM } from "../../../model/theater-metrics";
import {
  TheaterBtn,
  TheaterField,
  TheaterRangeField,
  TheaterSelect,
} from "../theater-controls-ui";
import { useTheaterControlsLightChannels } from "../use-theater-controls-light-channels";
import type { LayoutSectionProps } from "./types";
`;

const LAYOUT_DESTRUCTURE = `  const {
    hallTemplatePick,
    setHallTemplatePick,
    outlineFitSeats,
    setOutlineFitSeats,
    outlineFitSeatsFocusedRef,
    hallTemplateOptions,
    commitOutlineFitSeats,
    layoutSeatBadge,
    layoutHallBadge,
    layoutShapeLabel,
    isCustomStageOutline,
  } = layout;`;

for (const file of files) {
  const filePath = path.join(layoutDir, file);
  const src = fs.readFileSync(filePath, "utf8");
  const m = src.match(/return \(\s*<>\s*([\s\S]*?)\s*<\/>/);
  if (!m) {
    console.warn("skip (no body):", file);
    continue;
  }
  const body = fixBody(m[1]);
  const name = path.basename(file, ".tsx");
  const extraHook =
    file === "TheaterControlsLayoutViewSection.tsx"
      ? "\n  const { lightChannels } = useTheaterControlsLightChannels();\n"
      : "";
  const content = `${LAYOUT_IMPORTS}
export function ${name}({ vm, layout }: LayoutSectionProps) {
${LAYOUT_DESTRUCTURE}${extraHook}
  return (
<>
${body}
</>
  );
}
`;
  fs.writeFileSync(filePath, content);
  console.log("fixed", file);
}
