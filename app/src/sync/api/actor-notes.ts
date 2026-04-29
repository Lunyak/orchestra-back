import { api } from "./client";

export interface ActorStepNote {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export type ActorAnnotationField = "markdown" | "playMarkdown" | "explicationMarkdown";

export interface ActorAnnotation {
  id: string;
  startOffset: number;
  endOffset: number;
  selectedText?: string | null;
  noteText: string;
  createdAt: string;
  updatedAt: string;
}

export async function getActorStepNote(
  accessToken: string,
  params: { projectSlug: string; sceneName: string; stepId: number },
): Promise<{ note: ActorStepNote | null }> {
  const { data } = await api.get<{ note: ActorStepNote | null }>(
    "/actor-notes/step",
    {
      params,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export async function upsertActorStepNote(
  accessToken: string,
  body: { projectSlug: string; sceneName: string; stepId: number; text?: string },
): Promise<{ note: ActorStepNote | null }> {
  const { data } = await api.put<{ note: ActorStepNote | null }>(
    "/actor-notes/step",
    body,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export async function deleteActorStepNote(
  accessToken: string,
  params: { projectSlug: string; sceneName: string; stepId: number },
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>("/actor-notes/step", {
    params,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function listActorAnnotations(
  accessToken: string,
  params: {
    projectSlug: string;
    sceneName: string;
    stepId: number;
    field: ActorAnnotationField;
  },
): Promise<{ annotations: ActorAnnotation[] }> {
  const { data } = await api.get<{ annotations: ActorAnnotation[] }>(
    "/actor-notes/annotations",
    {
      params,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export async function createActorAnnotation(
  accessToken: string,
  body: {
    projectSlug: string;
    sceneName: string;
    stepId: number;
    field: ActorAnnotationField;
    startOffset: number;
    endOffset: number;
    selectedText?: string;
    noteText: string;
  },
): Promise<{ annotation: ActorAnnotation }> {
  const { data } = await api.post<{ annotation: ActorAnnotation }>(
    "/actor-notes/annotations",
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function updateActorAnnotation(
  accessToken: string,
  id: string,
  patch: { noteText?: string },
): Promise<{ annotation: ActorAnnotation }> {
  const { data } = await api.patch<{ annotation: ActorAnnotation }>(
    `/actor-notes/annotations/${encodeURIComponent(id)}`,
    patch,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function deleteActorAnnotation(
  accessToken: string,
  id: string,
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(
    `/actor-notes/annotations/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}
