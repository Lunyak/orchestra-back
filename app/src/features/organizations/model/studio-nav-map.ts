import {
  studioAssignmentsPath,
  studioInvitesPath,
  studioMembersPath,
  studioOrgPremisesPath,
  studioOverviewPath,
  studioProgramSectionPath,
  studioVideosSectionPath,
} from "../../../app/router/paths";

export type StudioNavNode = {
  id: string;
  label: string;
  href?: string;
  children?: ReadonlyArray<StudioNavNode>;
};

export type StudioNavMap = {
  root: StudioNavNode;
  branches: ReadonlyArray<StudioNavNode>;
};

type NavNodeDef = {
  id: string;
  label: string;
  href?: (studioId: string) => string;
  children?: ReadonlyArray<NavNodeDef>;
};

const WORK_CHILDREN: ReadonlyArray<NavNodeDef> = [
  { id: "program", label: "Обучение", href: studioProgramSectionPath },
  { id: "assignments", label: "Задания", href: studioAssignmentsPath },
  { id: "videos", label: "Видео", href: studioVideosSectionPath },
  { id: "premises", label: "Помещения", href: studioOrgPremisesPath },
];

const PEOPLE_CHILDREN: ReadonlyArray<NavNodeDef> = [
  { id: "members", label: "Участники", href: studioMembersPath },
  { id: "invites", label: "Приглашения", href: studioInvitesPath },
];

const NAV_BRANCH_DEFS: ReadonlyArray<NavNodeDef> = [
  {
    id: "work",
    label: "Работа",
    children: WORK_CHILDREN,
  },
  {
    id: "people",
    label: "Люди",
    children: PEOPLE_CHILDREN,
  },
];

function toNode(studioId: string, def: NavNodeDef): StudioNavNode {
  const href = def.href?.(studioId);
  const children = def.children?.map((child) => toNode(studioId, child));

  return {
    id: def.id,
    label: def.label,
    href,
    children: children?.length ? children : undefined,
  };
}

export function getStudioNavMap(
  studioId: string,
  rootLabel: string,
): StudioNavMap {
  return {
    root: {
      id: "overview",
      label: rootLabel,
      href: studioOverviewPath(studioId),
    },
    branches: NAV_BRANCH_DEFS.map((def) => toNode(studioId, def)),
  };
}
