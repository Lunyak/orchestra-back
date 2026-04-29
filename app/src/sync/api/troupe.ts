import { api } from "./client";
import type { TeamProfile } from "./profile";

export interface TroupeSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface TroupeMemberItem {
  id: string;
  troupeId: string;
  email: string;
  createdAt: string;
  profile: TeamProfile | null;
  /** Id строки в TroupeMember режиссёра; только для владельца проекта и email из его труппы. */
  troupeMemberId?: string | null;
}

export async function getMyTroupe(
  accessToken: string,
  opts: { month?: string; project: string },
): Promise<{ troupe: TroupeSummary | null; members: TroupeMemberItem[] }> {
  const { data } = await api.get("/troupe", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      project: opts.project,
      ...(opts.month ? { month: opts.month } : {}),
    },
  });
  return data;
}

export async function addTroupeMember(
  accessToken: string,
  email: string,
  opts: { project: string },
): Promise<TroupeMemberItem> {
  const { data } = await api.post(
    "/troupe/members",
    { email: email.trim() },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { project: opts.project },
    },
  );
  return data;
}

export async function removeTroupeMember(
  accessToken: string,
  memberId: string,
  opts: { project: string },
): Promise<void> {
  await api.delete(`/troupe/members/${encodeURIComponent(memberId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { project: opts.project },
  });
}

export async function patchMyTroupeTitle(
  accessToken: string,
  title: string,
): Promise<TroupeSummary> {
  const { data } = await api.patch<TroupeSummary>(
    "/troupe",
    { title: title.trim() },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}
