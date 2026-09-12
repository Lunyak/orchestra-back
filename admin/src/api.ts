const base = () =>
  (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export function getApiBaseUrl(): string {
  return base();
}

function headers(): HeadersInit {
  const token = sessionStorage.getItem("adminToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function adminLogin(secret: string): Promise<boolean> {
  const res = await fetch(`${base()}/admin/plans`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (res.ok) {
    sessionStorage.setItem("adminToken", secret);
    return true;
  }
  return false;
}

export function adminLogout() {
  sessionStorage.removeItem("adminToken");
}

export function isAdminLoggedIn(): boolean {
  return !!sessionStorage.getItem("adminToken");
}

export async function getUsers(): Promise<UserRow[]> {
  const res = await fetch(`${base()}/admin/users`, { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getProjects(): Promise<ProjectRow[]> {
  const res = await fetch(`${base()}/admin/projects`, { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getPlans(): Promise<PlanRow[]> {
  const res = await fetch(`${base()}/admin/plans`, { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updatePlan(
  planId: string,
  patch: { maxProjects?: number | null; maxCollaboratorsPerProject?: number | null }
): Promise<PlanRow> {
  const res = await fetch(`${base()}/admin/plans/${planId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setUserSubscription(
  userId: string,
  subscriptionId: string | null
): Promise<UserRow> {
  const res = await fetch(`${base()}/admin/users/${userId}/subscription`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ subscriptionId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setProjectDeleted(
  projectId: string,
  deleted: boolean
): Promise<ProjectRow> {
  const res = await fetch(`${base()}/admin/projects/${projectId}/deleted`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ deleted }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadSiteMedia(params: {
  file: File;
  path: string;
  prefix?: string;
}): Promise<{ key: string; url: string }> {
  const token = sessionStorage.getItem("adminToken");
  if (!token) throw new Error("Нет adminToken (выйди/войти заново)");

  const q = new URLSearchParams();
  q.set("path", params.path);
  if (params.prefix?.trim()) q.set("prefix", params.prefix.trim());

  const fd = new FormData();
  fd.append("file", params.file);

  const res = await fetch(`${base()}/admin/files/upload?${q.toString()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type TheaterKitGroup =
  | "spotlights"
  | "rig"
  | "doors"
  | "humans"
  | "library";

export type TheaterAssetSlot = {
  id: string;
  group: TheaterKitGroup;
  label: string;
  key: string;
  present: boolean;
  size: number | null;
  lastModified: string | null;
  url: string;
};

export type TheaterAssetsList = {
  prefix: string;
  missing: number;
  total: number;
  slots: TheaterAssetSlot[];
  extras: Array<{
    key: string;
    size: number;
    lastModified: string | null;
    url: string;
  }>;
};

function adminAuthHeader(): HeadersInit {
  const token = sessionStorage.getItem("adminToken");
  if (!token) throw new Error("Нет adminToken (выйди/войти заново)");
  return { Authorization: `Bearer ${token}` };
}

export async function getTheaterAssets(): Promise<TheaterAssetsList> {
  const res = await fetch(`${base()}/admin/theater-assets`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadTheaterAsset(
  file: File,
  key?: string,
): Promise<{ key: string; url: string }> {
  const q = new URLSearchParams();
  if (key?.trim()) q.set("key", key.trim());
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${base()}/admin/theater-assets/upload?${q.toString()}`, {
    method: "POST",
    headers: adminAuthHeader(),
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadTheaterAssetsMany(files: File[]): Promise<{
  uploaded: Array<{ key: string; url: string; name: string }>;
  errors: Array<{ name: string; message: string }>;
}> {
  const fd = new FormData();
  files.forEach((file) => fd.append("files", file));
  const res = await fetch(`${base()}/admin/theater-assets/upload-many`, {
    method: "POST",
    headers: adminAuthHeader(),
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type SiteEventViewRow = { slug: string; total: number; lastHitAt: string };

export async function getSiteEventViews(): Promise<{
  version: 1;
  updatedAt: string;
  events: SiteEventViewRow[];
}> {
  const res = await fetch(`${base()}/admin/site/event-views`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface PlanRow {
  id: string;
  name: string;
  maxProjects: number | null;
  maxCollaboratorsPerProject: number | null;
}

export interface UserRow {
  id: string;
  email: string;
  createdAt: string;
  subscriptionId: string | null;
  subscription: PlanRow | null;
  _count: { projectsOwned: number };
}

export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  ownerId: string;
  owner: { id: string; email: string };
}
