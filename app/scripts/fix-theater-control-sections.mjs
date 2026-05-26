import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const controls = path.join(root, "src/features/theater/ui/controls");

const SPOTLIGHTS_IMPORTS = `import { tc } from "../../../../../shared/styles/theme-color";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import {
  formatLightChannelSlot,
  spotlightMatchesChannelSlot,
} from "../../../model/theater-light-channel-link";
import { LightChannelSelect } from "../../LightChannelSelect";
import { TheaterCollapsibleSection } from "../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../theater-controls-ui";
import type { SpotlightsSectionProps } from "./types";
`;

const DECOR_IMPORTS = `import { tc } from "../../../../../shared/styles/theme-color";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { DECOR_CATALOG } from "../../../model/theater-decor-catalog";
import {
  DECOR_TEXTURE_FACE_OPTIONS,
  DECOR_TEXTURE_MODES,
  DECOR_TEXTURE_PRESETS,
} from "../../../model/theater-decor-textures";
import { DecorTexturePreview } from "../../DecorTexturePreview";
import { TheaterCollapsibleSection } from "../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField, TheaterSelect } from "../theater-controls-ui";
import type { DecorSectionProps } from "./types";
`;

function readBody(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const m = src.match(/return \(\s*<>\s*([\s\S]*?)\s*<\/>/);
  return m ? m[1] : "";
}

function writeSection(filePath, imports, destructure, body) {
  const content = `${imports}
export function ${path.basename(filePath, ".tsx")}({ vm, ${destructure.includes("spot") ? "spot" : "decor"} }: ${destructure.includes("spot") ? "SpotlightsSectionProps" : "DecorSectionProps"}) {
${destructure}
  return (
<>
${body.trimEnd()}
</>
  );
}
`;
  fs.writeFileSync(filePath, content);
}

const spotlightsDestructureFull = `  const {
    spotlightBatchCount,
    setSpotlightBatchCount,
    rgbBatchCount,
    setRgbBatchCount,
    spotlightLayoutRows,
    setSpotlightLayoutRows,
    regularSpotlights,
    rgbSpotlights,
    totalSpotlights,
    linkStats,
    spotlightLinkBadge,
    spotlightCountBadge,
    lightChannels,
    selectedLightSlot,
  } = spot;`;

const decorDestructureFull = `  const {
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
  } = decor;`;

const spotlightsDir = path.join(controls, "spotlights");
const decorDir = path.join(controls, "decor");

// --- Spotlights ---
writeSection(
  path.join(spotlightsDir, "TheaterControlsSpotlightsLightplotSection.tsx"),
  SPOTLIGHTS_IMPORTS,
  spotlightsDestructureFull,
  readBody(path.join(spotlightsDir, "TheaterControlsSpotlightsLightplotSection.tsx")).replace(
    /\s*\{vm\.multiSelectedSpotlightIds\.length >= 2 \? \(\s*<TheaterCollapsibleSection\s*$/,
    "",
  ),
);

writeSection(
  path.join(spotlightsDir, "TheaterControlsSpotlightsMultiSection.tsx"),
  SPOTLIGHTS_IMPORTS,
  spotlightsDestructureFull,
  `{vm.multiSelectedSpotlightIds.length >= 2 ? (
            <TheaterCollapsibleSection
${readBody(path.join(spotlightsDir, "TheaterControlsSpotlightsMultiSection.tsx"))
  .replace(/^\s*sectionId="/, '              sectionId="')
  .replace(/\s*<TheaterCollapsibleSection\s*$/, "")}`,
);

writeSection(
  path.join(spotlightsDir, "TheaterControlsSpotlightsRegularSection.tsx"),
  SPOTLIGHTS_IMPORTS,
  spotlightsDestructureFull,
  `<TheaterCollapsibleSection
${readBody(path.join(spotlightsDir, "TheaterControlsSpotlightsRegularSection.tsx"))
  .replace(/^\s*sectionId="/, '            sectionId="')
  .replace(/\s*<TheaterCollapsibleSection\s*$/, "")}`,
);

writeSection(
  path.join(spotlightsDir, "TheaterControlsSpotlightsRgbSection.tsx"),
  SPOTLIGHTS_IMPORTS,
  spotlightsDestructureFull,
  `<TheaterCollapsibleSection
${readBody(path.join(spotlightsDir, "TheaterControlsSpotlightsRgbSection.tsx"))
  .replace(/^\s*sectionId="/, '            sectionId="')
  .replace(/\s*<TheaterCollapsibleSection\s*$/, "")}`,
);

writeSection(
  path.join(spotlightsDir, "TheaterControlsSpotlightsSceneSection.tsx"),
  SPOTLIGHTS_IMPORTS,
  spotlightsDestructureFull,
  `<TheaterCollapsibleSection
${readBody(path.join(spotlightsDir, "TheaterControlsSpotlightsSceneSection.tsx")).replace(
  /^\s*sectionId="/,
  '            sectionId="',
)}`,
);

writeSection(
  path.join(spotlightsDir, "TheaterControlsSpotlightsLayoutSection.tsx"),
  SPOTLIGHTS_IMPORTS,
  spotlightsDestructureFull,
  readBody(path.join(spotlightsDir, "TheaterControlsSpotlightsLayoutSection.tsx")),
);

// --- Decor ---
writeSection(
  path.join(decorDir, "TheaterControlsDecorModeSection.tsx"),
  DECOR_IMPORTS,
  decorDestructureFull,
  readBody(path.join(decorDir, "TheaterControlsDecorModeSection.tsx")).replace(
    /\s*\{vm\.multiSelectedModelIds\.length >= 2 \? \(\s*<TheaterCollapsibleSection\s*$/,
    "",
  ),
);

writeSection(
  path.join(decorDir, "TheaterControlsDecorMultiSection.tsx"),
  DECOR_IMPORTS,
  decorDestructureFull,
  `{vm.multiSelectedModelIds.length >= 2 ? (
            <TheaterCollapsibleSection
${readBody(path.join(decorDir, "TheaterControlsDecorMultiSection.tsx"))
  .replace(/^\s*sectionId="/, '              sectionId="')
  .replace(/\s*<TheaterCollapsibleSection\s*$/, "")}`,
);

for (const file of [
  "TheaterControlsDecorGridSection.tsx",
  "TheaterControlsDecorTemplatesSection.tsx",
  "TheaterControlsDecorInventorySection.tsx",
  "TheaterControlsDecorSizeSection.tsx",
  "TheaterControlsDecorAppearanceSection.tsx",
]) {
  let body = readBody(path.join(decorDir, file));
  body = `<TheaterCollapsibleSection
${body.replace(/^\s*sectionId="/, '            sectionId="').replace(/\s*<TheaterCollapsibleSection\s*$/, "")}`;
  writeSection(path.join(decorDir, file), DECOR_IMPORTS, decorDestructureFull, body);
}

writeSection(
  path.join(decorDir, "TheaterControlsDecorSceneSection.tsx"),
  DECOR_IMPORTS,
  decorDestructureFull,
  `<TheaterCollapsibleSection
${readBody(path.join(decorDir, "TheaterControlsDecorSceneSection.tsx"))
  .replace(/^\s*sectionId="/, '            sectionId="')
  .replace(/<\/>\s*\);\s*\}\s*<\/>\s*\);\s*\}\s*$/, "")
  .replace(/\s*<\/div>\s*$/, "")}`,
);

console.log("fixed theater control sections");
