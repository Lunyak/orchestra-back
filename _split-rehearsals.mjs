import fs from "fs";

const src = fs.readFileSync("app/src/pages/rehearsals/RehearsalsPage.tsx", "utf8");
const lines = src.split(/\r?\n/);

const utils = lines.slice(0, 102).join("\n");
const utilsOut = utils
  .replace(
    'import type { RehearsalSelectedStep } from "../../sync/api/rehearsals";',
    "",
  )
  .replace(
    'import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";',
    "",
  )
  .replace('import "./style.css";', "")
  .replace(
    `import { useLocation } from "react-router-dom";`,
    "",
  );

fs.mkdirSync("app/src/features/rehearsals/model", { recursive: true });
fs.mkdirSync("app/src/features/rehearsals/ui", { recursive: true });

fs.writeFileSync(
  "app/src/features/rehearsals/model/rehearsals-page-utils.ts",
  `import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);
dayjs.locale("ru");

${utilsOut.split("\n").slice(8).join("\n")}
`,
  "utf8",
);

const hookImports = `import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
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
import {
  extractRolesSmart,
  formatMemberLabel,
  isoDate,
  normalizeEmail,
  normalizeRoleName,
} from "./rehearsals-page-utils";

export function useRehearsalsPage() {
`;

const hookBody = lines.slice(104, 732).join("\n");
fs.writeFileSync(
  "app/src/features/rehearsals/model/useRehearsalsPage.ts",
  hookImports + hookBody + `
  return {
    needsAuth: !accessToken,
    accessToken,
    projectSlug,
    members,
    calendarState,
    setCalendarState,
    calendarError,
    rehearsals,
    loading,
    error,
    activeRehearsalId,
    setActiveRehearsalId,
    activeRehearsal,
    publishing,
    publishError,
    stepsLoading,
    stepsError,
    stepsOptions,
    selectedSteps,
    setSelectedSteps,
    savingSteps,
    saveStepsError,
    metaTitle,
    setMetaTitle,
    metaStartsAtLocal,
    setMetaStartsAtLocal,
    metaEndsAtLocal,
    setMetaEndsAtLocal,
    metaDurationMin,
    setMetaDurationMin,
    metaEndTouched,
    setMetaEndTouched,
    metaSaving,
    metaSaveError,
    rolesLoading,
    rolesError,
    roleByNorm,
    scriptStepById,
    availabilityByStepKey,
    availableEmailSetForSelectedDate,
    createRehearsalForDate,
    publishActiveRehearsal,
    saveMeta,
    saveSelectedSteps,
    formatMemberLabel,
    normalizeEmail,
    dayjs,
  };
}
`,
  "utf8",
);

// Fix hook - the return block I appended might be wrong. Better extract return dynamically - for now read hook end and fix manually

const planBlock = lines.slice(1170).join("\n");
const planBlockOut = planBlock
  .replace(
    'import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";',
    "",
  )
  .replace(/from "\.\/style\.css";/, 'from "../../../pages/rehearsals/style.css";')
  .replace(
    'import { planRehearsal } from "../../sync/api/rehearsals";',
    'import { planRehearsal } from "../../../sync/api/rehearsals";',
  );

fs.writeFileSync(
  "app/src/features/rehearsals/ui/RehearsalPlanBlock.tsx",
  `import { useEffect, useState } from "react";
import { planRehearsal } from "../../../sync/api/rehearsals";
import "../../../pages/rehearsals/style.css";

${planBlock}
`,
  "utf8",
);

const viewBody = lines.slice(735, 1169).join("\n");

const uiFile = `import dayjs from "dayjs";
import { CalendarSection } from "../../../shared/components/calendar/CalendarSection";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import "../../../pages/rehearsals/style.css";
import {
  useRehearsalsPage,
  type RehearsalsPageViewModel,
} from "../model/useRehearsalsPage";
import { RehearsalPlanBlock } from "./RehearsalPlanBlock";

export type { RehearsalsPageViewModel } from "../model/useRehearsalsPage";
export { useRehearsalsPage } from "../model/useRehearsalsPage";

export function RehearsalsPageView(vm: RehearsalsPageViewModel) {
  const {
    accessToken,
    projectSlug,
    members,
    calendarState,
    setCalendarState,
    calendarError,
    rehearsals,
    loading,
    error,
    activeRehearsalId,
    setActiveRehearsalId,
    activeRehearsal,
    publishing,
    publishError,
    stepsLoading,
    stepsError,
    stepsOptions,
    selectedSteps,
    setSelectedSteps,
    savingSteps,
    saveStepsError,
    metaTitle,
    setMetaTitle,
    metaStartsAtLocal,
    setMetaStartsAtLocal,
    metaEndsAtLocal,
    setMetaEndsAtLocal,
    metaDurationMin,
    setMetaDurationMin,
    metaEndTouched,
    setMetaEndTouched,
    metaSaving,
    metaSaveError,
    rolesLoading,
    rolesError,
    roleByNorm,
    scriptStepById,
    availabilityByStepKey,
    availableEmailSetForSelectedDate,
    createRehearsalForDate,
    publishActiveRehearsal,
    saveMeta,
    saveSelectedSteps,
    formatMemberLabel,
    normalizeEmail,
    dayjs,
  } = vm;

${viewBody}
}

export function RehearsalsPage() {
  const vm = useRehearsalsPage();
  if (vm.needsAuth) {
    return <div className="rehearsals-muted">Нужно войти.</div>;
  }
  return <RehearsalsPageView vm={vm} />;
}
`;

fs.writeFileSync("app/src/features/rehearsals/ui/RehearsalsPage.tsx", uiFile, "utf8");

fs.writeFileSync(
  "app/src/pages/rehearsals/RehearsalsPage.tsx",
  `export {
  RehearsalsPage,
  RehearsalsPageView,
  useRehearsalsPage,
} from "../../features/rehearsals/ui/RehearsalsPage";
export type { RehearsalsPageViewModel } from "../../features/rehearsals/model/useRehearsalsPage";
`,
  "utf8",
);

fs.writeFileSync(
  "app/src/features/rehearsals/index.ts",
  `export * from "./model/rehearsals-page-utils";
export { useRehearsalsPage } from "./model/useRehearsalsPage";
export type { RehearsalsPageViewModel } from "./model/useRehearsalsPage";
export { RehearsalPlanBlock } from "./ui/RehearsalPlanBlock";
export { RehearsalsPage, RehearsalsPageView } from "./ui/RehearsalsPage";
`,
  "utf8",
);

console.log("split done");
