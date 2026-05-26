import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const controls = path.join(root, "src/features/theater/ui/controls");

function extractTab(tabFile, outSubdir, sections, shellImports) {
  const src = path.join(controls, tabFile);
  const outDir = path.join(controls, outSubdir);
  const lines = fs.readFileSync(src, "utf8").split(/\r?\n/);
  const maxEnd = Math.max(...sections.map((s) => s.end));
  if (lines.length < maxEnd) {
    throw new Error(
      `${tabFile} has ${lines.length} lines but extract needs ${maxEnd}. Run extract only on full tab file.`,
    );
  }
  fs.mkdirSync(outDir, { recursive: true });

  const typesPath = path.join(outDir, "types.ts");
  const typesContent =
    outSubdir === "spotlights"
      ? `import type { TheaterControlsTabProps } from "../types";
import type { useTheaterControlsSpotlightsTab } from "../use-theater-controls-spotlights-tab";

export type SpotlightsSectionProps = TheaterControlsTabProps & {
  spot: ReturnType<typeof useTheaterControlsSpotlightsTab>;
};
`
      : `import type { TheaterControlsTabProps } from "../types";
import type { useTheaterControlsDecorTab } from "../use-theater-controls-decor-tab";

export type DecorSectionProps = TheaterControlsTabProps & {
  decor: ReturnType<typeof useTheaterControlsDecorTab>;
};
`;
  fs.writeFileSync(typesPath, typesContent);

  const propsType = outSubdir === "spotlights" ? "SpotlightsSectionProps" : "DecorSectionProps";
  const hookName =
    outSubdir === "spotlights"
      ? "useTheaterControlsSpotlightsTab"
      : "useTheaterControlsDecorTab";
  const destructure =
    outSubdir === "spotlights"
      ? `  const {
    spotlightBatchCount,
    setSpotlightBatchCount,
    rgbBatchCount,
    setRgbBatchCount,
    spotlightLayoutRows,
    setSpotlightLayoutRows,
    regularSpotlights,
    rgbSpotlights,
    spotlightLinkBadge,
    spotlightCountBadge,
    lightChannels,
    selectedLightSlot,
  } = spot;`
      : `  const {
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
  } = decor;`;

  for (const { file, name, start, end } of sections) {
    const body = lines.slice(start - 1, end).join("\n");
    const content = `import type { ${propsType} } from "./types";

export function ${name}({ vm, ${outSubdir === "spotlights" ? "spot" : "decor"} }: ${propsType}) {
${destructure}
  return (
<>
${body}
</>
  );
}
`;
    fs.writeFileSync(path.join(outDir, file), content);
  }

  const shell = `${shellImports}

export function ${tabFile.replace(".tsx", "")}({ vm }: TheaterControlsTabProps) {
  const ${outSubdir === "spotlights" ? "spot" : "decor"} = ${hookName}(vm);
  return (
    <div className="theater-layout-panel">
${sections.map((s) => `      <${s.name} vm={vm} ${outSubdir === "spotlights" ? "spot" : "decor"}={${outSubdir === "spotlights" ? "spot" : "decor"}} />`).join("\n")}
    </div>
  );
}
`;
  fs.writeFileSync(src, shell);
}

// Fix spotlights sectionId bug in existing file before extract
let spotlights = fs.readFileSync(
  path.join(controls, "TheaterControlsSpotlightsTab.tsx"),
  "utf8",
);
spotlights = spotlights.replace('sectionId="spotlights-vm.layout"', 'sectionId="spotlights-layout"');
fs.writeFileSync(path.join(controls, "TheaterControlsSpotlightsTab.tsx"), spotlights);

extractTab(
  "TheaterControlsSpotlightsTab.tsx",
  "spotlights",
  [
    { file: "TheaterControlsSpotlightsLightplotSection.tsx", name: "TheaterControlsSpotlightsLightplotSection", start: 40, end: 124 },
    { file: "TheaterControlsSpotlightsMultiSection.tsx", name: "TheaterControlsSpotlightsMultiSection", start: 125, end: 169 },
    { file: "TheaterControlsSpotlightsRegularSection.tsx", name: "TheaterControlsSpotlightsRegularSection", start: 170, end: 290 },
    { file: "TheaterControlsSpotlightsRgbSection.tsx", name: "TheaterControlsSpotlightsRgbSection", start: 291, end: 456 },
    { file: "TheaterControlsSpotlightsSceneSection.tsx", name: "TheaterControlsSpotlightsSceneSection", start: 457, end: 490 },
    { file: "TheaterControlsSpotlightsLayoutSection.tsx", name: "TheaterControlsSpotlightsLayoutSection", start: 492, end: 632 },
  ],
  `import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsSpotlightsTab } from "./use-theater-controls-spotlights-tab";
import { TheaterControlsSpotlightsLightplotSection } from "./spotlights/TheaterControlsSpotlightsLightplotSection";
import { TheaterControlsSpotlightsMultiSection } from "./spotlights/TheaterControlsSpotlightsMultiSection";
import { TheaterControlsSpotlightsRegularSection } from "./spotlights/TheaterControlsSpotlightsRegularSection";
import { TheaterControlsSpotlightsRgbSection } from "./spotlights/TheaterControlsSpotlightsRgbSection";
import { TheaterControlsSpotlightsSceneSection } from "./spotlights/TheaterControlsSpotlightsSceneSection";
import { TheaterControlsSpotlightsLayoutSection } from "./spotlights/TheaterControlsSpotlightsLayoutSection";`,
);

extractTab(
  "TheaterControlsDecorTab.tsx",
  "decor",
  [
    { file: "TheaterControlsDecorModeSection.tsx", name: "TheaterControlsDecorModeSection", start: 42, end: 72 },
    { file: "TheaterControlsDecorMultiSection.tsx", name: "TheaterControlsDecorMultiSection", start: 73, end: 120 },
    { file: "TheaterControlsDecorGridSection.tsx", name: "TheaterControlsDecorGridSection", start: 121, end: 179 },
    { file: "TheaterControlsDecorTemplatesSection.tsx", name: "TheaterControlsDecorTemplatesSection", start: 180, end: 255 },
    { file: "TheaterControlsDecorInventorySection.tsx", name: "TheaterControlsDecorInventorySection", start: 256, end: 298 },
    { file: "TheaterControlsDecorSizeSection.tsx", name: "TheaterControlsDecorSizeSection", start: 299, end: 338 },
    { file: "TheaterControlsDecorAppearanceSection.tsx", name: "TheaterControlsDecorAppearanceSection", start: 339, end: 483 },
    { file: "TheaterControlsDecorSceneSection.tsx", name: "TheaterControlsDecorSceneSection", start: 484, end: 550 },
  ],
  `import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsDecorTab } from "./use-theater-controls-decor-tab";
import { useTheaterControlsHistoryTx } from "./use-theater-controls-history-tx";
import { TheaterControlsDecorModeSection } from "./decor/TheaterControlsDecorModeSection";
import { TheaterControlsDecorMultiSection } from "./decor/TheaterControlsDecorMultiSection";
import { TheaterControlsDecorGridSection } from "./decor/TheaterControlsDecorGridSection";
import { TheaterControlsDecorTemplatesSection } from "./decor/TheaterControlsDecorTemplatesSection";
import { TheaterControlsDecorInventorySection } from "./decor/TheaterControlsDecorInventorySection";
import { TheaterControlsDecorSizeSection } from "./decor/TheaterControlsDecorSizeSection";
import { TheaterControlsDecorAppearanceSection } from "./decor/TheaterControlsDecorAppearanceSection";
import { TheaterControlsDecorSceneSection } from "./decor/TheaterControlsDecorSceneSection";`,
);

// Fix decor tab - historyTx should come from hook
const decorTab = path.join(controls, "TheaterControlsDecorTab.tsx");
let decorShell = fs.readFileSync(decorTab, "utf8");
if (!decorShell.includes("useTheaterControlsHistoryTx")) {
  decorShell = decorShell.replace(
    'import { useTheaterControlsDecorTab } from "./use-theater-controls-decor-tab";',
    'import { useTheaterControlsDecorTab } from "./use-theater-controls-decor-tab";\nimport { useTheaterControlsHistoryTx } from "./use-theater-controls-history-tx";',
  );
  decorShell = decorShell.replace(
    "  const decor = useTheaterControlsDecorTab(vm);",
    "  const decor = useTheaterControlsDecorTab(vm);\n  const historyTx = useTheaterControlsHistoryTx(vm);",
  );
  decorShell = decorShell.replace(
    /<TheaterControlsDecor(\w+)Section vm=\{vm\} decor=\{decor\} \/>/g,
    "<TheaterControlsDecor$1Section vm={vm} decor={{ ...decor, historyTx }} />",
  );
}
fs.writeFileSync(decorTab, decorShell);

// Update decor hook to include historyTx
const decorHook = path.join(controls, "use-theater-controls-decor-tab.ts");
let decorHookSrc = fs.readFileSync(decorHook, "utf8");
if (!decorHookSrc.includes("historyTx")) {
  decorHookSrc = decorHookSrc.replace(
    "import type { TheaterSceneViewModel }",
    "import { useTheaterControlsHistoryTx } from \"./use-theater-controls-history-tx\";\nimport type { TheaterSceneViewModel }",
  );
  decorHookSrc = decorHookSrc.replace(
    "export function useTheaterControlsDecorTab(vm: TheaterSceneViewModel) {",
    "export function useTheaterControlsDecorTab(vm: TheaterSceneViewModel) {\n  const historyTx = useTheaterControlsHistoryTx(vm);",
  );
  decorHookSrc = decorHookSrc.replace(
    "  return {\n    decorTextureInputRef,",
    "  return {\n    historyTx,\n    decorTextureInputRef,",
  );
  fs.writeFileSync(decorHook, decorHookSrc);
}

// Simpler decor tab - pass historyTx in shell only to appearance section
decorShell = fs.readFileSync(decorTab, "utf8");
decorShell = decorShell.replace(
  /decor=\{\{ \.\.\.decor, historyTx \}\}/g,
  "decor={decor}",
);
decorShell = decorShell.replace(
  'import { useTheaterControlsHistoryTx } from "./use-theater-controls-history-tx";\n',
  "",
);
decorShell = decorShell.replace(
  "  const historyTx = useTheaterControlsHistoryTx(vm);\n",
  "",
);
fs.writeFileSync(decorTab, decorShell);

// Appearance section needs historyTx - add to decor hook return (already done)

// Delete TheaterZoneFloor
const zoneFloor = path.join(root, "src/features/theater/ui/three/TheaterZoneFloor.tsx");
if (fs.existsSync(zoneFloor)) {
  fs.unlinkSync(zoneFloor);
  console.log("deleted TheaterZoneFloor.tsx");
}

console.log("spotlights and decor sections extracted");
