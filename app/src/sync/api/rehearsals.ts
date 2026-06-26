import { api } from "./client";

export type RehearsalParticipantStatus = "unknown" | "present" | "absent" | "late";

export interface RehearsalParticipant {
  id: string;
  email: string;
  status: RehearsalParticipantStatus;
  telegramId?: string | null;
  userName?: string | null;
  lateTime?: string | null;
  respondedAt?: string | null;
}

export type RehearsalSelectedScene = { playbookId: string; sceneId: number };

export interface Rehearsal {
  id: string;
  title: string;
  startsAt: string;
  durationMin?: number | null;
  notes?: string | null;
  place?: string | null;
  selectedPlaybookIds?: string[] | null;
  selectedScenes?: RehearsalSelectedScene[] | null;
  telegramChatId?: string | null;
  telegramMessageId?: string | null;
  telegramThreadId?: string | null;
  publishedAt?: string | null;
  participants?: RehearsalParticipant[];
}

export interface RehearsalMyComment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export async function updateRehearsal(
  accessToken: string,
  rehearsalId: string,
  patch: Partial<
    Pick<
      Rehearsal,
      "title" | "startsAt" | "durationMin" | "notes" | "selectedPlaybookIds" | "selectedScenes"
    >
  >,
): Promise<Rehearsal> {
  const { data } = await api.patch(
    `/rehearsals/${encodeURIComponent(rehearsalId)}`,
    patch,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function getRehearsalScenes(
  accessToken: string,
  rehearsalId: string,
): Promise<{
  rehearsal: { id: string; title: string; startsAt: string };
  selectedPlaybookIds: string[];
  selectedScenes: RehearsalSelectedScene[];
  playbooks: Array<{ id: string; name: string; scenes: Array<{ id: number; title: string }> }>;
}> {
  const { data } = await api.get(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/scenes`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function listRehearsals(
  accessToken: string,
  projectSlug: string,
  from?: string,
  to?: string,
): Promise<{
  project: { id: string; slug: string; name: string };
  rehearsals: Rehearsal[];
}> {
  const { data } = await api.get("/rehearsals", {
    params: { projectSlug, from, to },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function createRehearsal(
  accessToken: string,
  body: {
    projectSlug: string;
    title: string;
    startsAt: string;
    durationMin?: number;
    notes?: string;
  },
): Promise<Rehearsal> {
  const { data } = await api.post("/rehearsals", body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function getRehearsal(
  accessToken: string,
  rehearsalId: string,
): Promise<Rehearsal> {
  const { data } = await api.get(`/rehearsals/${encodeURIComponent(rehearsalId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function getMyRehearsalComment(
  accessToken: string,
  rehearsalId: string,
): Promise<{ comment: RehearsalMyComment | null }> {
  const { data } = await api.get(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/my-comment`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function upsertMyRehearsalComment(
  accessToken: string,
  rehearsalId: string,
  body: { content?: string },
): Promise<{ comment: RehearsalMyComment | null }> {
  const { data } = await api.put(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/my-comment`,
    body ?? {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function setRehearsalParticipants(
  accessToken: string,
  rehearsalId: string,
  body: {
    participants: Array<{
      email: string;
      status: RehearsalParticipantStatus;
      roles?: any;
    }>;
  },
): Promise<Rehearsal> {
  const { data } = await api.post(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/participants`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function publishRehearsal(
  accessToken: string,
  rehearsalId: string,
): Promise<{ ok: boolean; published?: Rehearsal }> {
  const { data } = await api.post(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/publish`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function planRehearsal(
  accessToken: string,
  rehearsalId: string,
): Promise<any> {
  const { data } = await api.post(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/plan`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}
