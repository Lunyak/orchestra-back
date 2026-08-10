import {
  getStudioIdFromPath,
  getTheaterIdFromPath,
} from "../../../app/router/paths";

export type RecentOrganizationKind = "theater" | "studio";

export type RecentOrganizationRef = {
  kind: RecentOrganizationKind;
  id: string;
  openedAt: number;
};

const STORAGE_KEY = "recentOrganizations";
const MAX_RECENT = 8;

function isRecentOrganizationRef(value: unknown): value is RecentOrganizationRef {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecentOrganizationRef>;
  const hasValidKind = item.kind === "theater" || item.kind === "studio";
  const hasValidId = typeof item.id === "string" && item.id.trim().length > 0;
  const hasValidOpenedAt =
    typeof item.openedAt === "number" && Number.isFinite(item.openedAt);
  return hasValidKind && hasValidId && hasValidOpenedAt;
}

export function readRecentOrganizations(): RecentOrganizationRef[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentOrganizationRef).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeRecentOrganizations(items: RecentOrganizationRef[]) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    // ignore quota / private mode
  }
}

export function pushRecentOrganization(
  kind: RecentOrganizationKind,
  id: string,
) {
  const normalizedId = id.trim();
  if (!normalizedId) return;

  const nextItem: RecentOrganizationRef = {
    kind,
    id: normalizedId,
    openedAt: Date.now(),
  };
  const previous = readRecentOrganizations().filter((item) => {
    const isSameItem = item.kind === kind && item.id === normalizedId;
    return !isSameItem;
  });
  writeRecentOrganizations([nextItem, ...previous]);
}

export function rememberOrganizationFromPath(pathname: string) {
  const theaterId = getTheaterIdFromPath(pathname);
  if (theaterId) {
    pushRecentOrganization("theater", theaterId);
    return;
  }

  const studioId = getStudioIdFromPath(pathname);
  if (studioId) {
    pushRecentOrganization("studio", studioId);
  }
}
