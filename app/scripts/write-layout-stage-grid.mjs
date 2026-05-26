import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const layoutDir = path.join(
  scriptDir,
  "../src/features/theater/ui/controls/layout",
);

function vmify(src) {
  const names = ["currentStep", "stageGrid", "updateLayoutZoneGrid", "showStageGrid", "setShowStageGrid"];
  let out = src;
  for (const name of names) {
    out = out.replace(new RegExp(`\\b${name}\\b`, "g"), `vm.${name}`);
  }
  return out
    .replace(/\bvm\.vm\./g, "vm.")
    .replace(/theater-vm\.layout/g, "theater-layout");
}

const chunk = fs.readFileSync(path.join(scriptDir, "chunk-L2255.txt"), "utf8");
const sectionMatch = chunk.match(
  /<TheaterCollapsibleSection[\s\S]*?<\/TheaterCollapsibleSection>/,
);
if (!sectionMatch) throw new Error("stage-grid section not found in chunk-L2255.txt");

let inner = vmify(sectionMatch[0]);
inner = inner.replace(
  /<\/TheaterCollapsibleSection>\s*$/,
  `        <LabeledCheckbox checked={vm.showStageGrid} onChange={vm.setShowStageGrid}>
          \u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u043d\u0430 \u0441\u0446\u0435\u043d\u0435 \u0438 \u0432 \u043f\u043b\u0430\u043d\u0435
        </LabeledCheckbox>
      </TheaterCollapsibleSection>`,
);

const file = `import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { TheaterField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutStageGridSection({ vm }: LayoutSectionProps) {
  return (
    <>
      ${inner}
    </>
  );
}
`;

fs.writeFileSync(
  path.join(layoutDir, "TheaterControlsLayoutStageGridSection.tsx"),
  file,
  "utf8",
);
console.log("wrote TheaterControlsLayoutStageGridSection.tsx");
