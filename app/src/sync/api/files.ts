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

export type UploadProjectFileType = "playlist" | "image" | "sound" | "model" | "video";

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

async function fetchStreamBlobUrl(
  accessToken: string | null | undefined,
  key: string,
  allowedPrefixes: string[],
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const { data } = await api.get<Blob>("/files/stream", {
      params: { key },
      responseType: "blob",
      headers,
    });
    if (!data || !(data instanceof Blob)) return null;
    if (data.size === 0) return null;
    const type = data.type;
    if (
      type &&
      type !== "application/octet-stream" &&
      !allowedPrefixes.some((prefix) => type.startsWith(prefix))
    ) {
      return null;
    }
    return URL.createObjectURL(data);
  } catch {
    return null;
  }
}

export async function fetchSoundStreamBlobUrl(
  accessToken: string | null | undefined,
  key: string,
): Promise<string | null> {
  return fetchStreamBlobUrl(accessToken, key, ["audio/"]);
}

export async function fetchVideoStreamBlobUrl(
  accessToken: string | null | undefined,
  key: string,
): Promise<string | null> {
  return fetchStreamBlobUrl(accessToken, key, ["video/", "audio/"]);
}

export async function fetchImageStreamBlobUrl(
  accessToken: string | null | undefined,
  key: string,
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const { data } = await api.get<Blob>("/files/stream", {
      params: { key },
      responseType: "blob",
      headers,
    });
    if (!data || !(data instanceof Blob)) return null;
    if (data.size === 0) return null;
    const type = (data.type || "").toLowerCase();
    if (
      type.startsWith("text/") ||
      type.startsWith("application/json") ||
      type.startsWith("application/xml")
    ) {
      return null;
    }
    return URL.createObjectURL(data);
  } catch {
    return null;
  }
}
