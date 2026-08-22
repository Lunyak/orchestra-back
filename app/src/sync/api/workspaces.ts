import { createSingleflight } from "../../shared/utils/singleflight";
import { api } from "./client";
import type { TroupeResponse } from "./troupe";

export type WorkspaceSummary = {
  id: string;
  type: "PERSONAL" | "THEATER" | "TROUPE";
  name: string;
  theater: { id: string; title: string } | null;
  troupe: { id: string; title: string } | null;
};

export type TheaterSummary = {
  id: string;
  title: string;
  workspaceId: string;
  premises: {
    id: string;
    name: string;
    address: string | null;
    capacity: number | null;
  }[];
  homeTroupes?: {
    id: string;
    title: string;
    workspaceId: string;
  }[];
};

export type TroupeSummary = {
  id: string;
  title: string;
  workspaceId: string;
  theaterId: string | null;
  theater?: { id: string; title: string } | null;
};

export type TheaterRehearsal = {
  id: string;
  source: "rehearsal" | "director-session";
  title: string;
  startsAt: string;
  durationMin: number | null;
  place: string | null;
  publishedAt: string | null;
  project: {
    id: string;
    slug: string;
    name: string;
  };
  projects: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
};

export type TheaterRehearsalsResponse = {
  theater: {
    id: string;
    title: string;
    myRole: "OWNER" | "ADMIN" | "MEMBER";
  };
  projects: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  rehearsals: TheaterRehearsal[];
};

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

const workspacesSingleflight = createSingleflight<[string], WorkspaceSummary[]>();

export async function fetchWorkspaces(accessToken: string) {
  return workspacesSingleflight(accessToken, async (token) => {
    const { data } = await api.get<WorkspaceSummary[]>("/workspaces", {
      headers: authHeaders(token),
    });
    return data;
  }, accessToken);
}

export async function fetchTheaters(accessToken: string) {
  const { data } = await api.get<TheaterSummary[]>("/workspaces/theaters", {
    headers: authHeaders(accessToken),
  });
  return data;
}

export async function fetchTroupes(accessToken: string) {
  const { data } = await api.get<TroupeSummary[]>("/workspaces/troupes", {
    headers: authHeaders(accessToken),
  });
  return data;
}

export async function fetchTheaterHomeTroupe(
  accessToken: string,
  theaterId: string,
  month?: string,
) {
  const { data } = await api.get<TroupeResponse>(
    `/workspaces/theaters/${encodeURIComponent(theaterId)}/troupe`,
    {
      headers: authHeaders(accessToken),
      params: month ? { month } : undefined,
    },
  );
  return data;
}

export async function createTheater(accessToken: string, title: string) {
  const { data } = await api.post<{
    id: string;
    title: string;
    workspaceId: string;
  }>("/workspaces/theaters", { title }, { headers: authHeaders(accessToken) });
  return data;
}

export async function createTroupe(
  accessToken: string,
  title: string,
  theaterId?: string,
) {
  const path = theaterId
    ? `/workspaces/theaters/${encodeURIComponent(theaterId)}/troupes`
    : "/workspaces/troupes";
  const { data } = await api.post<{
    id: string;
    title: string;
    workspaceId: string;
    theaterId: string | null;
  }>(
    path,
    theaterId ? { title } : { title, theaterId: null },
    { headers: authHeaders(accessToken) },
  );
  return data;
}

export async function fetchTheaterRehearsals(
  accessToken: string,
  theaterId: string,
  from?: string,
  to?: string,
) {
  const { data } = await api.get<TheaterRehearsalsResponse>(
    `/workspaces/theaters/${encodeURIComponent(theaterId)}/rehearsals`,
    {
      headers: authHeaders(accessToken),
      params: { from, to },
    },
  );
  return data;
}

export async function createTheaterPremise(
  accessToken: string,
  theaterId: string,
  name: string,
) {
  await api.post(
    `/workspaces/theaters/${encodeURIComponent(theaterId)}/premises`,
    { name },
    { headers: authHeaders(accessToken) },
  );
}

export async function linkProjectTheater(
  accessToken: string,
  projectSlug: string,
  theaterId: string,
) {
  await api.post(
    `/projects/${encodeURIComponent(projectSlug)}/theaters/${encodeURIComponent(theaterId)}`,
    { participationType: "PARTNER" },
    { headers: authHeaders(accessToken) },
  );
}

export async function linkTheaterTroupe(
  accessToken: string,
  theaterId: string,
  troupeId: string,
) {
  await api.post(
    `/workspaces/theaters/${encodeURIComponent(theaterId)}/troupes/${encodeURIComponent(troupeId)}`,
    { participationType: "PARTNER" },
    { headers: authHeaders(accessToken) },
  );
}
