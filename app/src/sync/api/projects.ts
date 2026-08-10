import { api } from "./client";
import type { ProjectSummary } from "./types/project";

export async function fetchProjects(
  accessToken: string,
): Promise<ProjectSummary[]> {
  const { data } = await api.get<ProjectSummary[]>("/projects", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export type ProjectLinks = {
  workspaceId: string;
  theaters: Array<{
    participationType: string;
    theater: {
      id: string;
      title: string;
    };
  }>;
};

export async function fetchProjectLinks(
  accessToken: string,
  projectSlug: string,
): Promise<ProjectLinks> {
  const { data } = await api.get<ProjectLinks>(
    `/projects/${encodeURIComponent(projectSlug)}/links`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export async function ensureProject(
  accessToken: string,
  slug: string,
  name?: string,
  workspaceId?: string,
): Promise<ProjectSummary> {
  const projects = await fetchProjects(accessToken);
  const existing = projects.find((p) => p.slug === slug);
  if (existing) return existing;

  try {
    const { data } = await api.post<ProjectSummary>(
      "/projects",
      { slug, name: name ?? slug, workspaceId },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return data;
  } catch (error: any) {
    if (error?.response?.status === 403) {
      const message =
        error?.response?.data?.message ||
        "Project limit reached for current plan";
      throw new Error(message);
    }
    throw error;
  }
}

export async function updateProject(
  accessToken: string,
  slug: string,
  body: { name?: string; description?: string | null },
): Promise<ProjectSummary> {
  const { data } = await api.patch<ProjectSummary>(
    `/projects/${encodeURIComponent(slug)}`,
    body,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export async function inviteToProject(
  accessToken: string,
  slug: string,
  email: string,
  role?: string,
): Promise<{
  id: string;
  token: string;
  invitePath: string;
  role: string;
  email: string;
}> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(slug)}/invite`,
    { email: email.trim(), role: role ?? "editor" },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export interface ProjectMemberInfo {
  id: string;
  role: string;
  user: { id: string; email: string; displayName?: string | null };
}

export async function getProjectMembers(
  accessToken: string,
  slug: string,
): Promise<{
  id: string;
  owner: { id: string; email: string; displayName?: string | null } | null;
  members: ProjectMemberInfo[];
}> {
  const { data } = await api.get(
    `/projects/${encodeURIComponent(slug)}/members`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export type ProjectRoleInfo = {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  avatarKey?: string | null;
  aliases: string[];
  emails: string[];
};

export async function getProjectRoles(
  accessToken: string,
  projectSlug: string,
): Promise<{ projectId: string; roles: ProjectRoleInfo[] }> {
  const { data } = await api.get(
    `/projects/${encodeURIComponent(projectSlug)}/roles`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function createProjectRole(
  accessToken: string,
  projectSlug: string,
  body: {
    title: string;
    description?: string;
    aliases?: string[];
    avatarKey?: string | null;
  },
): Promise<{ ok: boolean; roleId: string }> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(projectSlug)}/roles`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function updateProjectRole(
  accessToken: string,
  projectSlug: string,
  roleId: string,
  body: {
    title?: string;
    description?: string;
    aliases?: string[];
    avatarKey?: string | null;
  },
): Promise<{ ok: boolean; roleId: string }> {
  const { data } = await api.put(
    `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function deleteProjectRole(
  accessToken: string,
  projectSlug: string,
  roleId: string,
): Promise<{ ok: boolean; deleted?: number }> {
  const { data } = await api.delete(
    `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function setProjectRoleAssignments(
  accessToken: string,
  projectSlug: string,
  roleId: string,
  emails: string[],
): Promise<{ ok: boolean }> {
  const { data } = await api.put(
    `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(
      roleId,
    )}/assignments`,
    { emails },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export type RoleNoteItem = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorEmail: string | null;
  authorUserId: string | null;
};

export async function getProjectRoleNotes(
  accessToken: string,
  projectSlug: string,
  roleId: string,
): Promise<{
  role: { id: string; title: string; key: string };
  notes: RoleNoteItem[];
}> {
  const { data } = await api.get(
    `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}/notes`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function addProjectRoleNote(
  accessToken: string,
  projectSlug: string,
  roleId: string,
  content: string,
): Promise<{ ok: boolean; noteId: string }> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}/notes`,
    { content },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function cleanupProjectImages(
  accessToken: string,
  projectSlug: string,
): Promise<{
  ok: boolean;
  projectId: string;
  storage: "s3" | "local";
  referencedCount: number;
  existingCount?: number;
  deletedCount: number;
  skipped?: boolean;
}> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(projectSlug)}/images/cleanup`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function updateProjectMemberRole(
  accessToken: string,
  slug: string,
  memberId: string,
  role: "editor" | "viewer",
): Promise<ProjectMemberInfo> {
  const { data } = await api.patch(
    `/projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(
      memberId,
    )}`,
    { role },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function removeProjectMember(
  accessToken: string,
  slug: string,
  memberId: string,
): Promise<void> {
  await api.delete(
    `/projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(
      memberId,
    )}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

export async function transferProjectOwnership(
  accessToken: string,
  slug: string,
  userId: string,
): Promise<{ ok: true; ownerId: string }> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(slug)}/transfer-ownership`,
    { userId },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function unlinkProjectTheater(
  accessToken: string,
  projectSlug: string,
  theaterId: string,
): Promise<void> {
  await api.delete(
    `/projects/${encodeURIComponent(projectSlug)}/theaters/${encodeURIComponent(theaterId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

export type ProjectTheaterInviteCreated = {
  id: string;
  token: string;
  invitePath: string;
  expiresAt: string | null;
};

export async function createProjectTheaterInvite(
  accessToken: string,
  projectSlug: string,
): Promise<ProjectTheaterInviteCreated> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(projectSlug)}/theater-invites`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function listProjectTheaterInvites(
  accessToken: string,
  projectSlug: string,
): Promise<Array<{ id: string; expiresAt: string | null; createdAt: string }>> {
  const { data } = await api.get(
    `/projects/${encodeURIComponent(projectSlug)}/theater-invites`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function revokeProjectTheaterInvite(
  accessToken: string,
  projectSlug: string,
  inviteId: string,
): Promise<void> {
  await api.post(
    `/projects/${encodeURIComponent(projectSlug)}/theater-invites/${encodeURIComponent(inviteId)}/revoke`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

export type ProjectTheaterInvitePreview = {
  kind: "project_theater_invite";
  id: string;
  project: { id: string; slug: string; name: string };
  invitedByEmail: string;
  expiresAt: string | null;
  createdAt: string;
  theaters: Array<{ id: string; title: string }>;
};

export async function previewProjectTheaterInvite(
  accessToken: string,
  token: string,
): Promise<ProjectTheaterInvitePreview> {
  const { data } = await api.get(
    `/projects/theater-invites/${encodeURIComponent(token)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function acceptProjectTheaterInvite(
  accessToken: string,
  token: string,
  theaterId: string,
): Promise<{ ok: true; projectSlug: string; theaterId: string }> {
  const { data } = await api.post(
    `/projects/theater-invites/${encodeURIComponent(token)}/accept`,
    { theaterId },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}
