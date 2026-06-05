/** Извлечь ключ MinIO из remoteKey или прямого/прокси URL. */
export function resolveProjectorStorageKey(item: {
  remoteKey?: string;
  remoteUrl?: string;
}): string | null {
  const direct = String(item.remoteKey ?? "").trim();
  if (direct) return direct;

  const remote = String(item.remoteUrl ?? "").trim();
  if (!remote) return null;

  const minio = /\/orchestra-media\/([^/?#]+\/(?:image|video)\/[^/?#]+)/i.exec(remote);
  if (minio?.[1]) {
    try {
      return decodeURIComponent(minio[1]);
    } catch {
      return minio[1];
    }
  }

  const play = /\/files\/play\/([^/?#]+)/i.exec(remote);
  if (play?.[1]) {
    try {
      return decodeURIComponent(play[1]);
    } catch {
      return play[1];
    }
  }

  return null;
}

/** Прямой URL бакета (MinIO/S3) — в <img>/<video> из браузера обычно не работает. */
export function isDirectObjectStorageUrl(url: string): boolean {
  const u = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(u)) return false;
  if (/\/files\/(?:play|stream)(?:\/|\?)/i.test(u)) return false;
  return /\/orchestra-media\//i.test(u);
}

export function enrichProjectorMediaRemoteKey<T extends { remoteKey?: string; remoteUrl?: string }>(
  item: T,
): T {
  if (String(item.remoteKey ?? "").trim()) return item;
  const key = resolveProjectorStorageKey(item);
  return key ? { ...item, remoteKey: key } : item;
}
