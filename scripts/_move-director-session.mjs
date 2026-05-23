import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pagesSessions = path.join(root, "app/src/pages/sessions");
const featUi = path.join(root, "app/src/features/director-sessions/ui");

function moveFile(relFrom, relTo, replacers = []) {
  const from = path.join(root, relFrom);
  const to = path.join(root, relTo);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  let text = fs.readFileSync(from, "utf8");
  for (const [a, b] of replacers) text = text.split(a).join(b);
  fs.writeFileSync(to, text, "utf8");
  console.log("wrote", relTo);
}

// Panels
const panelReplacers = [
  ['from "../../features/director-sessions/directorSessionsSync"', 'from "../directorSessionsSync"'],
  ['from "../../features/rehearsals-card/RehearsalsCard"', 'from "../../rehearsals-card/RehearsalsCard"'],
  ['from "../../shared/utils/createId"', 'from "../../../shared/utils/createId"'],
];
moveFile(
  "app/src/pages/sessions/DirectorSessionSlotsPanel.tsx",
  "app/src/features/director-sessions/ui/DirectorSessionSlotsPanel.tsx",
  panelReplacers,
);
moveFile(
  "app/src/pages/sessions/SlotRoleRehearsalPicker.tsx",
  "app/src/features/director-sessions/ui/SlotRoleRehearsalPicker.tsx",
  panelReplacers,
);
moveFile(
  "app/src/pages/sessions/TroupeSchedulePreview.tsx",
  "app/src/features/director-sessions/ui/TroupeSchedulePreview.tsx",
  panelReplacers,
);
for (const css of ["SlotRoleRehearsalPicker.css", "TroupeSchedulePreview.css"]) {
  moveFile(`app/src/pages/sessions/${css}`, `app/src/features/director-sessions/ui/${css}`);
}

// DirectorSessionPage
const srcPath = path.join(pagesSessions, "DirectorSessionPage/DirectorSessionPage.tsx");
let page = fs.readFileSync(srcPath, "utf8");
const lines = page.split(/\r?\n/);
const cutStart = lines.findIndex((l) => l.startsWith("type ProjectDataCache"));
const cutEnd = lines.findIndex(
  (l, i) => i > cutStart && l.startsWith("export function DirectorSessionPage"),
);
if (cutStart < 0 || cutEnd < 0) throw new Error("cut markers not found");

const newImports = `import {
  classifyActorSlotAvailability,
  directorSlotRefKey,
  formatSlotTime,
  isReadyStep,
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
  getRolePlannedEmailsForDirectorSlot,
  type DirectorSlotPlannedData,
} from "../../model/session-slot-planned";
import { DirectorSessionSlotsPanel } from "../DirectorSessionSlotsPanel";
import { SlotRoleRehearsalPicker } from "../SlotRoleRehearsalPicker";
import { TroupeSchedulePreview } from "../TroupeSchedulePreview";
`;

let head = lines.slice(0, cutStart).join("\n");
head = head
  .replace(
    /from "\.\.\/\.\.\/features\/director-sessions\/directorSessionsSync"/,
    'from "../../directorSessionsSync"',
  )
  .replace(/from "\.\.\/\.\.\/features\/auth"/, 'from "../../auth"')
  .replace(/from "\.\.\/\.\.\/features\/project"/, 'from "../../project"')
  .replace(/from "\.\.\/\.\.\/features\/rehearsals-card\/RehearsalsCard"/, 'from "../../rehearsals-card/RehearsalsCard"')
  .replace(/from "\.\.\/\.\.\/features\/scene"/, 'from "../../scene"')
  .replace(/from "\.\.\/\.\.\/shared\/types\/script"/, 'from "../../../shared/types/script"')
  .replace(/from "\.\.\/\.\.\/shared\/utils\/textPreview"/, 'from "../../../shared/utils/textPreview"')
  .replace(/from "\.\.\/\.\.\/sync\//g, 'from "../../../sync/')
  .replace(/import { DirectorSessionSlotsPanel } from "\.\.\/DirectorSessionSlotsPanel";\n/, "")
  .replace(/import { SlotRoleRehearsalPicker } from "\.\.\/SlotRoleRehearsalPicker";\n/, "")
  .replace(/import { TroupeSchedulePreview } from "\.\.\/TroupeSchedulePreview";\n/, "")
  .replace(
    /import \{\s*getAllAssigneeEmailsForDirectorSlotChart[\s\S]*?\} from "\.\.\/sessionSlotPlanned";\n/,
    "",
  )
  .replace('import "../style.css";\n', 'import "../../../pages/sessions/style.css";\n')
  .replace('import "./style.css";\n', 'import "./style.css";\n' + newImports);

const body = lines.slice(cutEnd).join("\n");
page = head + "\n" + body.replace(/ProjectDataCache/g, "DirectorSessionProjectDataCache");

const outDir = path.join(featUi, "DirectorSessionPage");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "DirectorSessionPage.tsx"), page, "utf8");
fs.copyFileSync(
  path.join(pagesSessions, "DirectorSessionPage/style.css"),
  path.join(outDir, "style.css"),
);

// Re-exports in pages
const reExport = (name, from) =>
  `export { ${name} } from "${from}";\n`;

fs.writeFileSync(
  path.join(pagesSessions, "DirectorSessionPage/DirectorSessionPage.tsx"),
  reExport(
    "DirectorSessionPage",
    "../../../features/director-sessions/ui/DirectorSessionPage/DirectorSessionPage",
  ),
  "utf8",
);
for (const f of [
  "DirectorSessionSlotsPanel",
  "SlotRoleRehearsalPicker",
  "TroupeSchedulePreview",
]) {
  fs.writeFileSync(
    path.join(pagesSessions, `${f}.tsx`),
    reExport(f, `../../features/director-sessions/ui/${f}`),
    "utf8",
  );
}

// DirectorSessionSlotPage imports
const slotPage = path.join(pagesSessions, "DirectorSessionSlotPage.tsx");
let sp = fs.readFileSync(slotPage, "utf8");
sp = sp
  .replace(
    './SlotRoleRehearsalPicker"',
    '../../features/director-sessions/ui/SlotRoleRehearsalPicker"',
  )
  .replace(
    './TroupeSchedulePreview"',
    '../../features/director-sessions/ui/TroupeSchedulePreview"',
  )
  .replace(
    './sessionSlotPlanned"',
    '../../features/director-sessions/model/session-slot-planned"',
  );
fs.writeFileSync(slotPage, sp, "utf8");

// index exports
const indexPath = path.join(root, "app/src/features/director-sessions/index.ts");
let index = fs.readFileSync(indexPath, "utf8");
if (!index.includes("DirectorSessionPage")) {
  index += `\nexport { DirectorSessionPage } from "./ui/DirectorSessionPage/DirectorSessionPage";\n`;
  index += `export { DirectorSessionSlotsPanel } from "./ui/DirectorSessionSlotsPanel";\n`;
  index += `export { SlotRoleRehearsalPicker } from "./ui/SlotRoleRehearsalPicker";\n`;
  index += `export { TroupeSchedulePreview } from "./ui/TroupeSchedulePreview";\n`;
  fs.writeFileSync(indexPath, index, "utf8");
}

console.log("done");
