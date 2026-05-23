import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const srcPath = path.join(root, "app/src/pages/rehearsals/RehearsalsPage.tsx");
const src = fs.readFileSync(srcPath, "utf8");
const lines = src.split(/\r?\n/);

const hookStart = lines.findIndex((l) => l === "export function RehearsalsPage() {");
if (hookStart < 0) throw new Error("RehearsalsPage export not found");

const authGuardIdx = lines.findIndex(
  (l, i) => i > hookStart && l.includes("if (!accessToken)") && l.includes("rehearsals-muted"),
);
const returnIdx = lines.findIndex((l, i) => i > hookStart && l === "  return (");
const hookEnd = authGuardIdx >= 0 ? authGuardIdx : returnIdx;

if (returnIdx < 0) throw new Error("view return not found");

const hookBody = lines.slice(hookStart + 1, hookEnd).join("\n");
const viewBody = lines.slice(returnIdx + 1, lines.length - 1).join("\n");

const hookImports = `import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import {
  extractRolesSmart,
  formatMemberLabel,
  isoDate,
  normalizeEmail,
  normalizeRoleName,
} from "./rehearsals-page-utils";
import { useProject } from "../../project";
import { useScene } from "../../scene";
import { useTeam } from "../../team";
import type { CalendarSectionState } from "../../../shared/components/calendar/CalendarSection";
import {
  getMyProfile,
  getProfilesBatch,
  type MyProfile,
  type TeamProfile,
} from "../../../sync/api/profile";
import { getProjectRoles, type ProjectRoleInfo } from "../../../sync/api/projects";
import {
  createRehearsal,
  getRehearsal,
  getRehearsalSteps,
  listRehearsals,
  publishRehearsal,
  updateRehearsal,
  type Rehearsal,
  type RehearsalSelectedStep,
} from "../../../sync/api/rehearsals";

dayjs.extend(isoWeek);
dayjs.locale("ru");
`;

const viewImports = `import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { CalendarSection } from "../../../shared/components/calendar/CalendarSection";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import { formatMemberLabel, RehearsalPlanBlock } from "..";
import type { RehearsalsPageViewModel } from "../model/useRehearsalsPage";
import "../../../pages/rehearsals/style.css";

dayjs.extend(isoWeek);
dayjs.locale("ru");
`;

// Top-level hook bindings only (2-space indent)
const names = new Set();
const topDecl = /^  (?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/gm;
const topFn = /^  (?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const topArr = /^  const\s+\[([^\]]+)\]/gm;
const topObj = /^  const\s+\{([^}]+)\}\s*=/gm;
let m;
while ((m = topDecl.exec(hookBody))) names.add(m[1]);
while ((m = topFn.exec(hookBody))) names.add(m[1]);
while ((m = topArr.exec(hookBody))) {
  for (const part of m[1].split(",")) {
    const id = part.trim().split(":")[0].trim();
    if (id && /^[A-Za-z_$]/.test(id)) names.add(id);
  }
}
while ((m = topObj.exec(hookBody))) {
  for (const part of m[1].split(",")) {
    const id = part.trim().split(":")[0].trim();
    if (id && /^[A-Za-z_$]/.test(id)) names.add(id);
  }
}
names.delete("accessToken"); // needsAuth instead for page guard

// Exclude hooks-only internals if any - keep all for view
const returnEntries = [...names].sort().map((n) => `    ${n},`).join("\n");

const hookFile = `${hookImports}
export type RehearsalsPageViewModel = ReturnType<typeof useRehearsalsPage>;

export function useRehearsalsPage() {
${hookBody}
  return {
${returnEntries}
    accessToken,
    needsAuth: !accessToken,
  };
}
`;

const uiFile = `${viewImports}
export type { RehearsalsPageViewModel } from "../model/useRehearsalsPage";
export { useRehearsalsPage } from "../model/useRehearsalsPage";

export function RehearsalsPageView(vm: RehearsalsPageViewModel) {
  const {
${[...names].sort().map((n) => `    ${n},`).join("\n")}
  } = vm;

  return (
${viewBody}
  );
}

export function RehearsalsPage() {
  const vm = useRehearsalsPage();
  if (vm.needsAuth) {
    return <div className="rehearsals-muted">Нужно войти.</div>;
  }
  return <RehearsalsPageView vm={vm} />;
}
`;

const hookOut = path.join(root, "app/src/features/rehearsals/model/useRehearsalsPage.ts");
const uiOut = path.join(root, "app/src/features/rehearsals/ui/RehearsalsPage.tsx");
const pageOut = path.join(root, "app/src/pages/rehearsals/RehearsalsPage.tsx");

fs.writeFileSync(hookOut, hookFile, "utf8");
fs.writeFileSync(uiOut, uiFile, "utf8");
fs.writeFileSync(
  pageOut,
  `export {
  RehearsalsPage,
  RehearsalsPageView,
  useRehearsalsPage,
} from "../../features/rehearsals/ui/RehearsalsPage";
export type { RehearsalsPageViewModel } from "../../features/rehearsals/model/useRehearsalsPage";
`,
  "utf8",
);

console.log("hook:", hookOut, hookFile.split("\n").length, "lines");
console.log("ui:", uiOut, uiFile.split("\n").length, "lines");
console.log("bindings:", names.size);
