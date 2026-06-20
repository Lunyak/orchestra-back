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
  kind: TroupeMemberKind;
  createdAt: string;
  profile: TeamProfile | null;
  /** Id строки в TroupeMember режиссёра; только для владельца проекта и email из его труппы. */
  troupeMemberId?: string | null;
}

export type TroupeMemberKind = "regular" | "guest";

export type TeamMemberRole =
  | "actor"
  | "director"
  | "accountant"
  | "artist"
  | "producer"
  | "smm"
  | "assistant_director"
  | "troupe_manager";

export interface TeamMemberItem {
  id: string;
  ownerUserId: string;
  userId: string | null;
  email: string;
  roles: TeamMemberRole[];
  createdAt: string;
  updatedAt: string;
  profile: TeamProfile | null;
  troupeMemberId?: string | null;
}

export interface TeamRoleAssignmentItem {
  id: string;
  createdAt: string;
  teamMember: TeamMemberItem;
}

export interface TeamRoleDefinitionItem {
  id: string;
  troupeId: string;
  slug: string;
  title: string;
  parentId: string | null;
  sortOrder: number;
  description: string;
  createdAt: string;
  updatedAt: string;
  assignmentCount: number;
  assignees: TeamMemberItem[];
}

export interface TeamRoleDetails extends TeamRoleDefinitionItem {
  assignments: TeamRoleAssignmentItem[];
}

export interface ProjectCastMemberItem extends TroupeMemberItem {
  projectMemberId: string | null;
  projectRole: string;
  isProjectOwner: boolean;
  inTroupe: boolean;
  teamMemberId?: string | null;
}

export interface MyTroupeResponse {
  troupe: TroupeSummary | null;
  members: TroupeMemberItem[];
  troupeMembers: TroupeMemberItem[];
  teamMembers: TeamMemberItem[];
  projectCastMembers: ProjectCastMemberItem[];
}

export async function getMyTroupe(
  accessToken: string,
  opts: { month?: string; project: string },
): Promise<MyTroupeResponse> {
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

export async function patchTroupeMemberKind(
  accessToken: string,
  memberId: string,
  kind: TroupeMemberKind,
  opts: { project: string },
): Promise<TroupeMemberItem> {
  const { data } = await api.patch<TroupeMemberItem>(
    `/troupe/members/${encodeURIComponent(memberId)}`,
    { kind },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { project: opts.project },
    },
  );
  return data;
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

export async function addTeamMember(
  accessToken: string,
  email: string,
  roles: TeamMemberRole[],
): Promise<TeamMemberItem> {
  const { data } = await api.post<TeamMemberItem>(
    "/troupe/team-members",
    { email: email.trim(), roles },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function patchTeamMember(
  accessToken: string,
  memberId: string,
  roles: TeamMemberRole[],
): Promise<TeamMemberItem> {
  const { data } = await api.patch<TeamMemberItem>(
    `/troupe/team-members/${encodeURIComponent(memberId)}`,
    { roles },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function removeTeamMember(
  accessToken: string,
  memberId: string,
): Promise<void> {
  await api.delete(`/troupe/team-members/${encodeURIComponent(memberId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getTeamRoles(accessToken: string): Promise<TeamRoleDefinitionItem[]> {
  const { data } = await api.get<TeamRoleDefinitionItem[]>("/troupe/team-roles", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function getTeamRole(
  accessToken: string,
  roleId: string,
): Promise<TeamRoleDetails> {
  const { data } = await api.get<TeamRoleDetails>(
    `/troupe/team-roles/${encodeURIComponent(roleId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function patchTeamRole(
  accessToken: string,
  roleId: string,
  patch: Partial<Pick<TeamRoleDetails, "title" | "parentId" | "sortOrder" | "description">>,
): Promise<TeamRoleDetails> {
  const { data } = await api.patch<TeamRoleDetails>(
    `/troupe/team-roles/${encodeURIComponent(roleId)}`,
    patch,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function addTeamRoleAssignment(
  accessToken: string,
  roleId: string,
  email: string,
): Promise<TeamRoleDetails> {
  const { data } = await api.post<TeamRoleDetails>(
    `/troupe/team-roles/${encodeURIComponent(roleId)}/assignments`,
    { email: email.trim() },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function removeTeamRoleAssignment(
  accessToken: string,
  roleId: string,
  assignmentId: string,
): Promise<void> {
  await api.delete(
    `/troupe/team-roles/${encodeURIComponent(roleId)}/assignments/${encodeURIComponent(
      assignmentId,
    )}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}
