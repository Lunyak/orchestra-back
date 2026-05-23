import fs from "fs";
import path from "path";

const threeDir = path.resolve("app/src/features/theater/ui/three");
const types = 'from "../../../../shared/types/script"';

const patches = {
  "theater-seating.tsx": `import * as THREE from "three";
import type { TheaterLayout } ${types};
`,
  "StrawGridModel.tsx": `import { useCallback, useEffect, useMemo } from "react";
import * as THREE from "three";
`,
  "DancerModel.tsx": `import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
`,
  "TheaterStage.tsx": null, // already ok
  "SpotlightCone.tsx": `import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
`,
  "BuiltinModel.tsx": `import type { TheaterModel } ${types};
import { DancerModel } from "./DancerModel";
import { StrawGridModel } from "./StrawGridModel";
`,
  "BuiltinModelInstance.tsx": `import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { TheaterModel } ${types};
import { BuiltinModel } from "./BuiltinModel";
`,
  "FileModelInstance.tsx": `import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { TheaterModel } ${types};
`,
  "SpotlightItem.tsx": `import { Billboard, Text, TransformControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { TheaterSpotlight } ${types};
import { SpotlightCone } from "./SpotlightCone";
`,
};

for (const [file, header] of Object.entries(patches)) {
  if (!header) continue;
  const p = path.join(threeDir, file);
  let body = fs.readFileSync(p, "utf8");
  const match = body.match(/^(export )?const /m);
  const start = body.search(/^(export )?const /m);
  if (start < 0) continue;
  body = header + "\n" + body.slice(start).replace(/^const /gm, "export const ");
  fs.writeFileSync(p, body + "\n");
  console.log("fixed", file);
}

// TheaterStage path fix
const stagePath = path.join(threeDir, "TheaterStage.tsx");
let stage = fs.readFileSync(stagePath, "utf8");
stage = stage.replace(
  '../../../shared/types/script',
  '../../../../shared/types/script',
);
fs.writeFileSync(stagePath, stage);

// theater-defaults path
const defPath = path.resolve("app/src/features/theater/model/theater-defaults.ts");
let def = fs.readFileSync(defPath, "utf8");
def = def.replace("../../shared/types", "../../../shared/types");
fs.writeFileSync(defPath, def);

console.log("done");
