import { api } from "./client";

export async function getPlayUrl(
  accessToken: string,
  key: string,
): Promise<{ url: string }> {
  const { data } = await api.get<{ url: string }>("/files/play-url", {
    params: { key },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export type UploadProjectFileType = "playlist" | "image" | "sound" | "model";

export async function uploadProjectFile(
  accessToken: string,
  params: { projectId: string; type: UploadProjectFileType; file: File },
): Promise<{ key: string; url: string }> {
  const form = new FormData();
  form.append("file", params.file, params.file.name);
  form.append("projectId", params.projectId);
  form.append("type", params.type);

  const { data } = await api.post<{ key: string; url: string }>(
    "/files/upload",
    form,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function fetchSoundStreamBlobUrl(
  accessToken: string,
  key: string,
): Promise<string | null> {
  try {
    const { data } = await api.get<Blob>("/files/stream", {
      params: { key },
      responseType: "blob",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!data || !(data instanceof Blob)) return null;
    if (data.size === 0) return null;
    const type = data.type;
    if (
      type &&
      !type.startsWith("audio/") &&
      type !== "application/octet-stream"
    )
      return null;
    return URL.createObjectURL(data);
  } catch {
    return null;
  }
}
