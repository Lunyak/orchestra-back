import {
  projectPath,
  type ProjectSection,
} from "../../../app/router/paths";
import { isTheaterRouteEnabled } from "../../../app/router/routeMeta";

export type ProjectNavNode = {
  id: string;
  label: string;
  href?: string;
  children?: ReadonlyArray<ProjectNavNode>;
};

export type ProjectNavMap = {
  root: ProjectNavNode;
  branches: ReadonlyArray<ProjectNavNode>;
};

type NavNodeDef = {
  id: string;
  label: string;
  section?: ProjectSection;
  children?: ReadonlyArray<NavNodeDef>;
};

const SCRIPT_MODES: ReadonlyArray<NavNodeDef> = [
  { id: "script-play", label: "Текст", section: "script" },
  { id: "script-explication", label: "Экспликация", section: "script" },
  { id: "script-comments", label: "Комментарии", section: "script" },
];

const TECH_MODES: ReadonlyArray<NavNodeDef> = [
  { id: "tech-rehearsal", label: "Сборка", section: "light-plot" },
  { id: "tech-prog-run", label: "Прогон", section: "light-plot" },
];

const SPECTACLE_CHILDREN: ReadonlyArray<NavNodeDef> = [
  {
    id: "script",
    label: "Сценарий",
    children: SCRIPT_MODES,
  },
  {
    id: "light-plot",
    label: "Техчасть",
    children: TECH_MODES,
  },
  { id: "sufer", label: "Суфлер", section: "sufer" },
  { id: "theater", label: "3D театр", section: "theater" },
];

const WORK_CHILDREN: ReadonlyArray<NavNodeDef> = [
  { id: "sessions", label: "Репетиции", section: "sessions" },
  { id: "board", label: "Доска", section: "board" },
  { id: "tasks", label: "Задачи", section: "tasks" },
];

const PEOPLE_BRANCH_DEFS: ReadonlyArray<NavNodeDef> = [
  { id: "team", label: "Должности", section: "team" },
  { id: "roles", label: "Роли", section: "roles" },
  { id: "cast", label: "Каст", section: "cast" },
];

const SETTINGS_CHILDREN: ReadonlyArray<NavNodeDef> = [
  { id: "settings-general", label: "Основные", section: "settings" },
  { id: "settings-rights", label: "Права", section: "settings" },
  { id: "settings-media", label: "Медиа", section: "settings" },
  { id: "settings-bot", label: "Бот", section: "settings" },
  { id: "settings-styles", label: "Стили", section: "settings" },
];

const NAV_BRANCH_DEFS: ReadonlyArray<NavNodeDef> = [
  {
    id: "spectacle",
    label: "Спектакль",
    children: SPECTACLE_CHILDREN,
  },
  {
    id: "work",
    label: "Работа",
    children: WORK_CHILDREN,
  },
  {
    id: "people",
    label: "Люди",
    children: PEOPLE_BRANCH_DEFS,
  },
  {
    id: "settings",
    label: "Настройки",
    children: SETTINGS_CHILDREN,
  },
];

function filterNodeDefs(
  defs: ReadonlyArray<NavNodeDef>,
): ReadonlyArray<NavNodeDef> {
  return defs
    .filter(({ id }) => id !== "theater" || isTheaterRouteEnabled())
    .map((def) =>
      def.children
        ? { ...def, children: filterNodeDefs(def.children) }
        : def,
    );
}

function settingsTabFromNodeId(id: string): string | null {
  if (!id.startsWith("settings-")) return null;
  return id.slice("settings-".length);
}

function toNode(projectSlug: string, def: NavNodeDef): ProjectNavNode {
  const tab = settingsTabFromNodeId(def.id);
  const href = def.section
    ? tab
      ? `${projectPath(projectSlug, def.section)}?tab=${encodeURIComponent(tab)}`
      : projectPath(projectSlug, def.section)
    : undefined;
  const children = def.children?.map((child) => toNode(projectSlug, child));

  return {
    id: def.id,
    label: def.label,
    href,
    children: children?.length ? children : undefined,
  };
}

export function getProjectNavMap(
  projectSlug: string,
  rootLabel: string,
): ProjectNavMap {
  return {
    root: {
      id: "overview",
      label: rootLabel,
      href: projectPath(projectSlug, "overview"),
    },
    branches: filterNodeDefs(NAV_BRANCH_DEFS).map((def) =>
      toNode(projectSlug, def),
    ),
  };
}
