import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const srcPath = path.join(root, "app/src/pages/sessions/DirectorSessionSlotPage.tsx");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

const cutStart = lines.findIndex((l) => l.startsWith("type ProjectDataCache"));
const cutEnd = lines.findIndex(
  (l, i) => i > cutStart && l.startsWith("export function DirectorSessionSlotPage"),
);
if (cutStart < 0 || cutEnd < 0) throw new Error("cut markers not found");

const extraImports = `import {
  classifyActorSlotAvailability,
  formatSlotTime,
  getSessionStartLocalMinutes,
  looksLikeEmail,
  normalizeEmail,
  normalizeRoleKey,
  parseStepsFromPull,
  toDateKey,
} from "../../model/session-page-utils";
import type { DirectorSessionProjectDataCache } from "../../model/session-page-types";
import {
  getAllAssigneeEmailsForDirectorSlotChart,
  getNormalizedRoleKeysForSlotStep,
  type DirectorSlotPlannedData,
} from "../../model/session-slot-planned";
import { SlotRoleRehearsalPicker } from "../SlotRoleRehearsalPicker";
import { TroupeSchedulePreview } from "../TroupeSchedulePreview";
`;

let head = lines.slice(0, cutStart).join("\n");
head = head
  .replace(/from "\.\.\/\.\.\/features\/auth"/, 'from "../../../auth"')
  .replace(
    /from "\.\.\/\.\.\/features\/director-sessions\/directorSessionsSync"/,
    'from "../../directorSessionsSync"',
  )
  .replace(/from "\.\.\/\.\.\/features\/project"/, 'from "../../../project"')
  .replace(/from "\.\.\/\.\.\/features\/rehearsals-card\/RehearsalsCard"/, 'from "../../../rehearsals-card/RehearsalsCard"')
  .replace(/from "\.\.\/\.\.\/features\/scene"/, 'from "../../../scene"')
  .replace(/from "\.\.\/\.\.\/shared\//g, 'from "../../../../shared/')
  .replace(/from "\.\.\/\.\.\/sync\//g, 'from "../../../../sync/')
  .replace(/import type { SyncPullResponse }[^\n]+\n/, "")
  .replace(/import { SlotRoleRehearsalPicker }[^\n]+\n/, "")
  .replace(/import \{[\s\S]*?session-slot-planned";\n/, "")
  .replace(/import { TroupeSchedulePreview }[^\n]+\n/, "")
  .replace('import "../style.css";\n', 'import "../../../pages/sessions/style.css";\n')
  .concat("\n", extraImports);

const body = lines.slice(cutEnd).join("\n").replace(/ProjectDataCache/g, "DirectorSessionProjectDataCache");

const outPath = path.join(
  root,
  "app/src/features/director-sessions/ui/DirectorSessionSlotPage.tsx",
);
fs.writeFileSync(outPath, head + "\n" + body, "utf8");

fs.writeFileSync(
  path.join(root, "app/src/pages/sessions/DirectorSessionSlotPage.tsx"),
  'export { DirectorSessionSlotPage } from "../../features/director-sessions/ui/DirectorSessionSlotPage";\n',
  "utf8",
);

let index = fs.readFileSync(
  path.join(root, "app/src/features/director-sessions/index.ts"),
  "utf8",
);
if (!index.includes("DirectorSessionSlotPage")) {
  index += '\nexport { DirectorSessionSlotPage } from "./ui/DirectorSessionSlotPage";\n';
  fs.writeFileSync(
    path.join(root, "app/src/features/director-sessions/index.ts"),
    index,
    "utf8",
  );
}

console.log("moved DirectorSessionSlotPage");
