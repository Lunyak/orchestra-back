import { useEffect, useState } from "react";
import { getPlayUrl } from "../../sync/api/files";

export function useRoleAvatarUrl(
  accessToken: string | null | undefined,
  avatarKey: string | null | undefined,
): string | null {
  const key = String(avatarKey ?? "").trim();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !key) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void getPlayUrl(accessToken, key)
      .then((res) => {
        if (!cancelled) setUrl(res?.url ?? null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, key]);

  return url;
}
