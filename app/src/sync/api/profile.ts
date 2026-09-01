import { api } from "./client";

export interface MyProfile {
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  telegramUsername?: string | null;
  telegramId?: string | null;
  avatarUrl?: string | null;
  avatarSmallUrl?: string | null;
  phone?: string | null;
  availabilityCalendar?: Record<string, "present" | "absent"> | null;
  availabilityTimeRanges?: Record<string, Array<{ from: string; to: string }>> | null;
}

export interface TeamProfile {
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  telegramId?: string | null;
  avatarUrl?: string | null;
  avatarSmallUrl?: string | null;
  phone?: string | null;
  availabilityCalendar?: Record<string, "present" | "absent"> | null;
  availabilityTimeRanges?: Record<string, Array<{ from: string; to: string }>> | null;
}

/** Для списков и мини-чипов: маленький аватар, иначе полный. */
export function profileListAvatarSrc(
  profile?: { avatarUrl?: string | null; avatarSmallUrl?: string | null } | null,
): string | null {
  const small = String(profile?.avatarSmallUrl ?? "").trim();
  if (small) return small;
  const full = String(profile?.avatarUrl ?? "").trim();
  return full || null;
}

/** Для карточек-плиток: полный аватар, иначе маленький. */
export function profilePosterAvatarSrc(
  profile?: { avatarUrl?: string | null; avatarSmallUrl?: string | null } | null,
): string | null {
  const full = String(profile?.avatarUrl ?? "").trim();
  if (full) return full;
  const small = String(profile?.avatarSmallUrl ?? "").trim();
  return small || null;
}

export async function getMyProfile(accessToken: string): Promise<MyProfile> {
  const { data } = await api.get<MyProfile>("/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function deleteMyProfile(accessToken: string): Promise<{ ok: boolean; deleted?: number }> {
  const { data } = await api.delete<{ ok: boolean; deleted?: number }>("/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function getProfilesBatch(
  accessToken: string,
  emails: string[],
): Promise<TeamProfile[]> {
  const { data } = await api.post<TeamProfile[]>(
    "/profile/batch",
    { emails },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data ?? [];
}

export async function updateMyProfile(
  accessToken: string,
  patch: Partial<MyProfile>,
): Promise<MyProfile> {
  const { data } = await api.patch<MyProfile>("/profile", patch, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export type ProfileAvatarVariant = "full" | "small";

export async function uploadMyAvatar(
  accessToken: string,
  file: File,
  variant: ProfileAvatarVariant = "full",
): Promise<MyProfile> {
  const form = new FormData();
  form.append("file", file, file.name);
  const query = variant === "small" ? "?variant=small" : "";
  const { data } = await api.post<MyProfile>(`/profile/avatar${query}`, form, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}
