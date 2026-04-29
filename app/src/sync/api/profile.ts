import { api } from "./client";

export interface MyProfile {
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  telegramUsername?: string | null;
  telegramId?: string | null;
  avatarUrl?: string | null;
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
  availabilityCalendar?: Record<string, "present" | "absent"> | null;
  availabilityTimeRanges?: Record<string, Array<{ from: string; to: string }>> | null;
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

export async function uploadMyAvatar(
  accessToken: string,
  file: File,
): Promise<MyProfile> {
  const form = new FormData();
  form.append("file", file, file.name);
  const { data } = await api.post<MyProfile>("/profile/avatar", form, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}
