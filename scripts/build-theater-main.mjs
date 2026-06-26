import fs from "fs";
import path from "path";

const root = path.resolve("app/src");
const lines = fs
  .readFileSync(path.join(root, "shared/components/theater/TheaterScene.tsx"), "utf8")
  .split(/\r?\n/);

let main = lines.slice(948).join("\n");
const layoutStart = main.indexOf("  const DEFAULT_LAYOUT: TheaterLayout = {");
if (layoutStart >= 0) {
  const layoutEnd = main.indexOf("  };", layoutStart) + 5;
  main =
    main.slice(0, layoutStart) +
    "  const DEFAULT_LAYOUT = DEFAULT_THEATER_LAYOUT;\n" +
    main.slice(layoutEnd);
}

const header = `import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Dispatch,
  SetStateAction,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { useScene } from "../../scene";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import {
  ScriptScene,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { DEFAULT_SPOTLIGHTS, DEFAULT_THEATER_LAYOUT } from "../model/theater-defaults";
import { BuiltinModelInstance } from "./three/BuiltinModelInstance";
import { FileModelInstance } from "./three/FileModelInstance";
import { SpotlightItem } from "./three/SpotlightItem";
import { TheaterStage } from "./three/TheaterStage";
import "./style.css";

`;

const outPath = path.join(root, "features/theater/ui/TheaterScene.tsx");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + main + "\n", "utf8");
console.log("wrote TheaterScene.tsx", (header + main).split("\n").length, "lines");
