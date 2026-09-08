import type { TheaterViewPrefs } from "./theater-view-prefs-storage";

export type TheaterSidebarPanelId =
  | "scene"
  | "view"
  | "help"
  | "spotlights"
  | "models"
  | "decor"
  | "room"
  | "layout";

export type TheaterLayoutSectionId = "room" | "openings";

export type TheaterRoomSectionId =
  | "hall"
  | "audience"
  | "stage"
  | "grid"
  | "materials"
  | "export";

export type TheaterRoomNavItem = {
  id: TheaterRoomSectionId;
  label: string;
};

export const THEATER_ROOM_NAV: TheaterRoomNavItem[] = [
  { id: "hall", label: "Габариты" },
  { id: "audience", label: "Кресла" },
  { id: "stage", label: "Форма стен" },
  { id: "grid", label: "Сетка сцены" },
  { id: "materials", label: "Материалы" },
  { id: "export", label: "Экспорт" },
];

export function getTheaterRoomSectionLabel(sectionId: TheaterRoomSectionId): string {
  return THEATER_ROOM_NAV.find((item) => item.id === sectionId)?.label ?? sectionId;
}

export type TheaterSidebarGroupId = "overview" | "tools" | "help";

export type TheaterSidebarNavItem = {
  id: TheaterSidebarPanelId;
  label: string;
};

export type TheaterSidebarNavGroup = {
  id: TheaterSidebarGroupId;
  title: string;
  items: TheaterSidebarNavItem[];
};

export const THEATER_SIDEBAR_GROUPS: TheaterSidebarNavGroup[] = [
  {
    id: "overview",
    title: "Обзор",
    items: [
      { id: "scene", label: "Список элементов" },
      { id: "view", label: "Вид" },
    ],
  },
  {
    id: "tools",
    title: "Инструменты",
    items: [
      { id: "spotlights", label: "Софиты" },
      { id: "models", label: "Модели" },
      { id: "decor", label: "Декор" },
      { id: "room", label: "Помещение" },
      { id: "layout", label: "План" },
    ],
  },
  {
    id: "help",
    title: "Справка",
    items: [{ id: "help", label: "Клавиши" }],
  },
];

const OVERVIEW_PANEL_IDS: TheaterSidebarPanelId[] = ["scene", "view", "help"];

export function isTheaterSidebarOverviewPanel(
  panelId: TheaterSidebarPanelId,
): panelId is "scene" | "view" | "help" {
  return OVERVIEW_PANEL_IDS.includes(panelId);
}

export function getTheaterSidebarPanelLabel(panelId: TheaterSidebarPanelId): string {
  for (const group of THEATER_SIDEBAR_GROUPS) {
    const item = group.items.find((entry) => entry.id === panelId);
    if (item) return item.label;
  }
  return panelId;
}

export type TheaterSpotlightsSectionId = "regular" | "rgb" | "trusses" | "control";

export type TheaterSpotlightsNavItem = {
  id: TheaterSpotlightsSectionId;
  label: string;
};

export const THEATER_SPOTLIGHTS_NAV: TheaterSpotlightsNavItem[] = [
  { id: "regular", label: "Софиты" },
  { id: "rgb", label: "RGB" },
  { id: "trusses", label: "Световые фермы" },
  { id: "control", label: "Управление" },
];

export function getTheaterSpotlightsSectionLabel(
  sectionId: TheaterSpotlightsSectionId,
): string {
  return THEATER_SPOTLIGHTS_NAV.find((item) => item.id === sectionId)?.label ?? sectionId;
}

type TheaterSidebarNavVm = {
  setActiveTab: (tab: TheaterViewPrefs["activeTab"]) => void;
  setEditMode: (mode: "spotlights" | "models" | "decor") => void;
};

export function applyTheaterSidebarPanel(
  vm: TheaterSidebarNavVm,
  panelId: TheaterSidebarPanelId,
) {
  if (panelId === "spotlights") {
    vm.setActiveTab("spotlights");
    vm.setEditMode("spotlights");
    return;
  }
  if (panelId === "models") {
    vm.setActiveTab("models");
    vm.setEditMode("models");
    return;
  }
  if (panelId === "decor") {
    vm.setActiveTab("decor");
    vm.setEditMode("decor");
    return;
  }
  if (panelId === "room" || panelId === "layout") {
    vm.setActiveTab("layout");
    return;
  }
  vm.setActiveTab("navigate");
}
