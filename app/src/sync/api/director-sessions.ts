import { api } from "./client";

export type DirectorSessionParticipantStatus = "unknown" | "present" | "absent" | "late";

export type DirectorSessionSlotRef = { projectSlug: string; sceneId: number };

export type DirectorSlotRoleRehearsalPick = {
  roleKey: string;
  email: string;
  checked: boolean;
};

export type DirectorSessionSlot = {
  id: string;
  offsetMin: number;
  durationMin: number;
  title?: string;
  ref?: DirectorSessionSlotRef;
  notes?: string;
  participantEmails?: string[];
  isProgRun?: boolean;
  roleRehearsalPicks?: DirectorSlotRoleRehearsalPick[];
};

export type DirectorSessionParticipant = {
  email: string;
  status: DirectorSessionParticipantStatus;
  telegramId?: string | null;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  lateTime?: string | null;
  respondedAt?: string | null;
  callTime?: string | null;
};

export type DirectorSession = {
  id: string;
  title: string;
  startsAt: string;
  theaterId?: string;
  slots: DirectorSessionSlot[];
  comment?: string | null;
  plannedEmails?: string[];
  updatedAt?: string;
  participants?: DirectorSessionParticipant[];
  telegramChatId?: string | null;
  telegramMessageId?: string | null;
  telegramThreadId?: string | null;
  publishedAt?: string | null;
};

export type DirectorSessionMyComment = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export async function publishDirectorSession(
  accessToken: string,
  sessionId: string,
  body?: { comment?: string | null; includeUnavailable?: boolean },
): Promise<{ ok: boolean; telegramSent?: boolean; telegramDeferred?: boolean; session?: DirectorSession }> {
  const { data } = await api.post(
    `/director-sessions/${encodeURIComponent(sessionId)}/publish`,
    body ?? null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function remindDirectorSessionMissingAvailability(
  accessToken: string,
  sessionId: string,
): Promise<{
  ok: boolean;
  sentCount: number;
  skippedCount: number;
  totalWithoutAvailability: number;
}> {
  const { data } = await api.post(
    `/director-sessions/${encodeURIComponent(sessionId)}/remind-missing-availability`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function getDirectorSessions(
  accessToken: string,
): Promise<{ projectId: string; sessions: any[] }> {
  const { data } = await api.get("/director-sessions", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data as any;
}

export async function getDirectorSessionInvitations(
  accessToken: string,
  fromIso: string,
  toIso: string,
): Promise<{ sessions: any[] }> {
  const { data } = await api.get("/director-sessions/invitations", {
    params: { fromIso, toIso },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data as any;
}

export async function getDirectorSession(
  accessToken: string,
  sessionId: string,
): Promise<DirectorSession> {
  const { data } = await api.get(
    `/director-sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function confirmMyDirectorSessionAttendance(
  accessToken: string,
  sessionId: string,
): Promise<{ ok: boolean; session: DirectorSession }> {
  const { data } = await api.post(
    `/director-sessions/${encodeURIComponent(sessionId)}/confirm-attendance`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function declineMyDirectorSessionAttendance(
  accessToken: string,
  sessionId: string,
): Promise<{ ok: boolean; session: DirectorSession }> {
  const { data } = await api.post(
    `/director-sessions/${encodeURIComponent(sessionId)}/decline-attendance`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function getMyDirectorSessionComment(
  accessToken: string,
  sessionId: string,
): Promise<{ comment: DirectorSessionMyComment | null }> {
  const { data } = await api.get(
    `/director-sessions/${encodeURIComponent(sessionId)}/my-comment`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function upsertMyDirectorSessionComment(
  accessToken: string,
  sessionId: string,
  body: { content?: string },
): Promise<{ comment: DirectorSessionMyComment | null }> {
  const { data } = await api.put(
    `/director-sessions/${encodeURIComponent(sessionId)}/my-comment`,
    body ?? {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function replaceDirectorSessions(
  accessToken: string,
  sessions: any[],
): Promise<{ ok: boolean }> {
  const { data } = await api.put(
    "/director-sessions",
    { sessions },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function deleteDirectorSession(
  accessToken: string,
  sessionId: string,
): Promise<{ ok: boolean }> {
  const { data } = await api.delete(
    `/director-sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}
