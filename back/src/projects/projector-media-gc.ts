/** Ключ объекта в хранилище из remoteKey или URL (как на фронте). */
export function resolveProjectorStorageKey(item: {
  remoteKey?: string;
  remoteUrl?: string;
}): string | null {
  const direct = String(item.remoteKey ?? '').trim();
  if (direct) return direct;

  const remote = String(item.remoteUrl ?? '').trim();
  if (!remote) return null;

  const minio =
    /\/orchestra-media\/([^/?#]+\/(?:image|video)\/[^/?#]+)/i.exec(remote);
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

/** Ключи image/* из projectorMedia, которые GC не должен удалять. */
export function extractReferencedImageKeysFromProjectorMedia(
  raw: unknown,
): string[] {
  const out: string[] = [];
  if (!raw || typeof raw !== 'object') return out;
  const bag = raw as {
    v?: number;
    holdImages?: Array<{ remoteKey?: string; remoteUrl?: string }>;
    projector?: { holdImageRemoteKey?: string; holdImageRemoteUrl?: string };
  };
  if (bag.v !== 1) return out;

  const holds = Array.isArray(bag.holdImages) ? bag.holdImages : [];
  for (const hold of holds) {
    const key = resolveProjectorStorageKey(hold ?? {});
    if (key) out.push(key);
  }

  const legacy = resolveProjectorStorageKey({
    remoteKey: bag.projector?.holdImageRemoteKey,
    remoteUrl: bag.projector?.holdImageRemoteUrl,
  });
  if (legacy) out.push(legacy);

  return out;
}
