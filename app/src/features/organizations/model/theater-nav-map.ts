import {
  theaterAvailabilityPath,
  theaterOverviewPath,
  theaterPremisesPath,
  theaterRehearsalsPath,
  theaterTeamPath,
  theaterTroupePath,
} from "../../../app/router/paths";

export type TheaterNavNode = {
  id: string;
  label: string;
  href?: string;
  children?: ReadonlyArray<TheaterNavNode>;
};

export type TheaterNavMap = {
  root: TheaterNavNode;
  branches: ReadonlyArray<TheaterNavNode>;
};

type NavNodeDef = {
  id: string;
  label: string;
  href?: (theaterId: string) => string;
  children?: ReadonlyArray<NavNodeDef>;
};

const WORK_CHILDREN: ReadonlyArray<NavNodeDef> = [
  { id: "rehearsals", label: "Репетиции", href: theaterRehearsalsPath },
  { id: "availability", label: "Занятость", href: theaterAvailabilityPath },
  { id: "premises", label: "Помещения", href: theaterPremisesPath },
];

const PEOPLE_CHILDREN: ReadonlyArray<NavNodeDef> = [
  { id: "troupe", label: "Коллектив", href: theaterTroupePath },
  { id: "team", label: "Должности", href: theaterTeamPath },
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

function toNode(theaterId: string, def: NavNodeDef): TheaterNavNode {
  const href = def.href?.(theaterId);
  const children = def.children?.map((child) => toNode(theaterId, child));

  return {
    id: def.id,
    label: def.label,
    href,
    children: children?.length ? children : undefined,
  };
}

export function getTheaterNavMap(
  theaterId: string,
  rootLabel: string,
): TheaterNavMap {
  return {
    root: {
      id: "overview",
      label: rootLabel,
      href: theaterOverviewPath(theaterId),
    },
    branches: NAV_BRANCH_DEFS.map((def) => toNode(theaterId, def)),
  };
}
