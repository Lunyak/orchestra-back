import type { MyProfile, TeamProfile } from "../../../sync/api/profile";

export type AvailabilityStatus = "present" | "absent";
export type AvailabilityTimeRange = { from: string; to: string };
export type AvailabilityDayVisual = "free" | "busy" | "partial" | "unknown";

export function normalizeAvailabilityEmail(
  email: string | null | undefined,
): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

export function getAvailabilityDayVisual(
  calendar: Record<string, AvailabilityStatus> | null | undefined,
  rangesByDay: Record<string, AvailabilityTimeRange[]> | null | undefined,
  dayIso: string,
): { cls: AvailabilityDayVisual; tooltip: string } {
  const status = calendar?.[dayIso];
  const ranges = rangesByDay?.[dayIso] ?? [];
  const hasRanges = ranges.length > 0;

  if (status === "absent") {
    return { cls: "busy", tooltip: "Занят" };
  }
  if (hasRanges) {
    const windows = ranges.map((range) => `${range.from}–${range.to}`).join(", ");
    return { cls: "partial", tooltip: `Свободен: ${windows}` };
  }
  if (status === "present") {
    return { cls: "free", tooltip: "Свободен" };
  }
  return { cls: "unknown", tooltip: "Не отмечено" };
}

export function sortMineFirst<T extends { email: string }>(
  items: T[],
  myEmail: string | null,
): T[] {
  const mineKey = normalizeAvailabilityEmail(myEmail);
  if (!mineKey) return items;
  const mine: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (normalizeAvailabilityEmail(item.email) === mineKey) mine.push(item);
    else rest.push(item);
  }
  return mine.length > 0 ? [...mine, ...rest] : items;
}

export function teamProfileFromMyProfile(
  profile: MyProfile | null | undefined,
): TeamProfile | null {
  const email = normalizeAvailabilityEmail(profile?.email);
  if (!email || !profile) return null;
  return {
    email,
    displayName: profile.displayName,
    firstName: profile.firstName,
    lastName: profile.lastName,
    telegramId: profile.telegramId,
    avatarUrl: profile.avatarUrl,
    avatarSmallUrl: profile.avatarSmallUrl,
    phone: profile.phone,
    availabilityCalendar: profile.availabilityCalendar,
    availabilityTimeRanges: profile.availabilityTimeRanges,
  };
}

export function mergeSelfEmail(
  emails: string[],
  myEmail: string | null | undefined,
): string[] {
  const mineKey = normalizeAvailabilityEmail(myEmail);
  if (!mineKey) return emails;
  if (emails.some((email) => normalizeAvailabilityEmail(email) === mineKey)) {
    return emails;
  }
  return [mineKey, ...emails];
}

export function mergeSelfIntoProfiles(
  profiles: TeamProfile[],
  me: MyProfile | null | undefined,
): TeamProfile[] {
  const self = teamProfileFromMyProfile(me);
  if (!self) return profiles;
  const mineKey = normalizeAvailabilityEmail(self.email);
  if (profiles.some((profile) => normalizeAvailabilityEmail(profile.email) === mineKey)) {
    return profiles;
  }
  return [self, ...profiles];
}
