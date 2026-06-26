import { api } from "./client";

export interface ActorSceneNote {
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

export async function getActorSceneNote(
  accessToken: string,
  params: { projectSlug: string; sceneName: string; sceneId: number },
): Promise<{ note: ActorSceneNote | null }> {
  const { data } = await api.get<{ note: ActorSceneNote | null }>(
    "/actor-notes/scene",
    {
      params,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export async function upsertActorSceneNote(
  accessToken: string,
  body: { projectSlug: string; sceneName: string; sceneId: number; text?: string },
): Promise<{ note: ActorSceneNote | null }> {
  const { data } = await api.put<{ note: ActorSceneNote | null }>(
    "/actor-notes/scene",
    body,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export async function deleteActorSceneNote(
  accessToken: string,
  params: { projectSlug: string; sceneName: string; sceneId: number },
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>("/actor-notes/scene", {
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
    sceneId: number;
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
    sceneId: number;
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
