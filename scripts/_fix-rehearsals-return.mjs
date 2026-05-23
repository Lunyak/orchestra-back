import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const uiPath = path.join(root, "app/src/features/rehearsals/ui/RehearsalsPage.tsx");
const hookPath = path.join(root, "app/src/features/rehearsals/model/useRehearsalsPage.ts");

const ui = fs.readFileSync(uiPath, "utf8");
const m = ui.match(/const \{([\s\S]*?)\} = vm;/);
if (!m) throw new Error("destructure not found");
const names = [...m[1].matchAll(/^\s+([A-Za-z_$][\w$]*),?\s*$/gm)].map((x) => x[1]);

let src = fs.readFileSync(hookPath, "utf8");
const marker = "  }, [availableEmailSetForSelectedDate, roleByNorm, rolesLoading, scriptStepById, stepsOptions]);\n\n";
const idx = src.lastIndexOf(marker);
if (idx < 0) throw new Error("marker not found");
const head = src.slice(0, idx + marker.length);
const returnBlock = `  return {\n${names.map((n) => `    ${n},`).join("\n")}\n    needsAuth: !accessToken,\n  };\n}\n`;
fs.writeFileSync(hookPath, head + returnBlock, "utf8");
console.log("hook return:", names.length);
