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

function parseContentLength(headers: Record<string, unknown> | undefined): number | null {
  const raw =
    headers?.["content-length"] ??
    headers?.["Content-Length"] ??
    (headers as { get?: (name: string) => string | null } | undefined)?.get?.(
      "content-length",
    );
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function parseContentRangeTotal(headers: Record<string, unknown> | undefined): number | null {
  const raw =
    headers?.["content-range"] ??
    headers?.["Content-Range"] ??
    (headers as { get?: (name: string) => string | null } | undefined)?.get?.(
      "content-range",
    );
  const match = String(raw ?? "").match(/\/(\d+)\s*$/);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Размер файла в байтах без полной загрузки (HEAD / Range). */
export async function probeFileSizeBytes(opts: {
  accessToken?: string | null;
  remoteKey?: string | null;
  url?: string | null;
}): Promise<number | null> {
  const token = String(opts.accessToken ?? "").trim() || null;
  const key = String(opts.remoteKey ?? "").trim();
  const url = String(opts.url ?? "").trim();

  if (key && token) {
    try {
      const head = await api.head("/files/stream", {
        params: { key },
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: (status) => status >= 200 && status < 500,
      });
      const fromHead = parseContentLength(head.headers as Record<string, unknown>);
      if (fromHead != null) return fromHead;
    } catch {
      // ignore — попробуем Range
    }
    try {
      const ranged = await api.get("/files/stream", {
        params: { key },
        headers: {
          Authorization: `Bearer ${token}`,
          Range: "bytes=0-0",
        },
        responseType: "arraybuffer",
        validateStatus: (status) => status >= 200 && status < 500,
      });
      const fromRange = parseContentRangeTotal(
        ranged.headers as Record<string, unknown>,
      );
      if (fromRange != null) return fromRange;
      const fromLen = parseContentLength(ranged.headers as Record<string, unknown>);
      if (fromLen != null && ranged.status === 206) return fromLen;
    } catch {
      // ignore
    }
  }

  if (/^https?:\/\//i.test(url) || url.startsWith("/")) {
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (head.ok) {
        const len = head.headers.get("content-length");
        const value = Number(len);
        if (Number.isFinite(value) && value >= 0) return value;
      }
    } catch {
      // ignore
    }
    try {
      const ranged = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
      });
      const fromRange = ranged.headers.get("content-range");
      const match = String(fromRange ?? "").match(/\/(\d+)\s*$/);
      if (match?.[1]) {
        const value = Number(match[1]);
        if (Number.isFinite(value) && value >= 0) return value;
      }
    } catch {
      // ignore
    }
  }

  return null;
}
