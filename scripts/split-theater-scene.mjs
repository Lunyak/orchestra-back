import fs from "fs";
import path from "path";

const srcPath = path.resolve(
  "app/src/shared/components/theater/TheaterScene.tsx",
);
const outRoot = path.resolve("app/src/features/theater");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

function write(rel, content, header = "") {
  const file = path.join(outRoot, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, header + content + "\n", "utf8");
  console.log("wrote", rel);
}

const threeHeader = `import { Billboard, Text, TransformControls, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { TheaterLayout, TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import { DEFAULT_SPOTLIGHTS } from "../../model/theater-defaults";
`;

write(
  "ui/three/theater-seating.tsx",
  slice(33, 84),
  threeHeader.replace("DEFAULT_SPOTLIGHTS", "").replace(
    'import { DEFAULT_SPOTLIGHTS } from "../../model/theater-defaults";\n',
    "",
  ),
);

write("ui/three/StrawGridModel.tsx", slice(86, 149).replace(/^const /, "export const "), threeHeader);
write("ui/three/DancerModel.tsx", slice(151, 226).replace(/^const /, "export const "), threeHeader);

const stageBody = slice(228, 273)
  .replace(/^const TheaterStage/, "export const TheaterStage")
  .replace("<SeatRow", "<SeatRow");
write(
  "ui/three/TheaterStage.tsx",
  `import * as THREE from "three";
import type { TheaterLayout } from "../../../shared/types/script";
import { SeatRow } from "./theater-seating";
\n${stageBody}`,
);

write(
  "model/theater-defaults.ts",
  `import type { TheaterLayout, TheaterSpotlight } from "../../shared/types/script";

export const DEFAULT_THEATER_LAYOUT: TheaterLayout = {
  hallWidth: 9,
  hallDepth: 6,
  wallHeight: 6,
  audienceStartZ: 3,
  seatRows: 4,
  seatsPerRow: 7,
  seatSpacing: 1.1,
  rowSpacing: 0.8,
  rowRise: 0.25,
  aisleWidth: 1.2,
  aisleCenterX: 0,
  doorWidth: 1.2,
  doorHeight: 2.2,
  doorZ: -6,
};

${slice(275, 309).replace(/^const DEFAULT_SPOTLIGHTS/, "export const DEFAULT_SPOTLIGHTS")}`,
);

write(
  "ui/three/SpotlightCone.tsx",
  slice(311, 405).replace(/^const /, "export const "),
  threeHeader,
);

write(
  "ui/three/BuiltinModel.tsx",
  slice(407, 571).replace(/^const /, "export const "),
  threeHeader + 'import { StrawGridModel } from "./StrawGridModel";\nimport { DancerModel } from "./DancerModel";\n',
);

write(
  "ui/three/BuiltinModelInstance.tsx",
  slice(573, 634).replace(/^const /, "export const "),
  threeHeader + 'import { BuiltinModel } from "./BuiltinModel";\n',
);

write(
  "ui/three/FileModelInstance.tsx",
  slice(636, 783).replace(/^const /, "export const "),
  threeHeader,
);

write(
  "ui/three/SpotlightItem.tsx",
  slice(785, 947).replace(/^const /, "export const "),
  threeHeader + 'import { SpotlightCone } from "./SpotlightCone";\n',
);

// Fix theater-seating exports
const seating = fs.readFileSync(path.join(outRoot, "ui/three/theater-seating.tsx"), "utf8");
fs.writeFileSync(
  path.join(outRoot, "ui/three/theater-seating.tsx"),
  seating
    .replace(/^const TheaterChair/, "export const TheaterChair")
    .replace(/^const SeatRow/, "export const SeatRow"),
);

console.log("done three/ + defaults");
