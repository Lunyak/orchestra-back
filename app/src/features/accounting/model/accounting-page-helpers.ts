import type {
  AccountingScopes,
  CollectionSummary,
} from "../../../sync/api/accounting";
import type {
  AccountingTab,
  AccountingTabItem,
  TariffDraft,
} from "./accounting-page-types";

export function newTariffDraft(): TariffDraft {
  return {
    key: `tariff-${Date.now()}-${Math.random()}`,
    title: "",
    amountRub: "",
  };
}

export function emptyScopes(): AccountingScopes {
  return { theaters: [], studios: [], projects: [] };
}

export function resolveDefaultTab(scopes: AccountingScopes): AccountingTab | null {
  if (scopes.theaters.length > 0) return "theaters";
  if (scopes.studios.length > 0) return "studios";
  if (scopes.projects.length > 0) return "projects";
  return null;
}

export function filterCollections(
  collections: CollectionSummary[],
  tab: AccountingTab,
  scopes: AccountingScopes,
  entityId: string,
): CollectionSummary[] {
  if (tab === "studios") {
    return collections.filter((collection) => {
      const matchesStudio =
        collection.scope === "studio" && collection.studioId === entityId;
      return entityId ? matchesStudio : collection.scope === "studio";
    });
  }

  if (tab === "theaters") {
    return collections.filter((collection) => {
      if (collection.scope !== "troupe") return false;
      if (!entityId) return true;
      return collection.theaterId === entityId;
    });
  }

  const project = scopes.projects.find((item) => item.id === entityId);
  const projectTroupeIds = new Set(project?.troupeIds ?? []);
  return collections.filter((collection) => {
    if (collection.scope !== "troupe") return false;
    if (!entityId) {
      return scopes.projects.some((item) =>
        item.troupeIds.includes(collection.troupeId),
      );
    }
    return projectTroupeIds.has(collection.troupeId);
  });
}

export function buildVisibleTabs(scopes: AccountingScopes): AccountingTabItem[] {
  const tabs: AccountingTabItem[] = [];
  if (scopes.theaters.length > 0) {
    tabs.push({ id: "theaters", label: "Театры" });
  }
  if (scopes.studios.length > 0) {
    tabs.push({ id: "studios", label: "Студии" });
  }
  if (scopes.projects.length > 0) {
    tabs.push({ id: "projects", label: "Проекты" });
  }
  return tabs;
}

export const DEFAULT_TARIFFS: TariffDraft[] = [
  { key: "t1", title: "Полный", amountRub: "5000" },
  { key: "t2", title: "Льготный", amountRub: "2300" },
];
