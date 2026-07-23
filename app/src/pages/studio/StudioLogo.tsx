import cn from "classnames";
import { useEffect, useState } from "react";
import { useAuth } from "../../features/auth";
import { fetchImageStreamBlobUrl } from "../../sync/api/files";
import "./style.css";

function extractStudioImageStorageKey(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  if (!/^https?:\/\//i.test(raw)) {
    return raw.replace(/^\/+/, "");
  }

  try {
    const parsed = new URL(raw);
    const path = parsed.pathname.replace(/^\/+/, "");
    const mediaMatch = /(?:^|\/)orchestra-media\/(.+)$/i.exec(path);
    if (mediaMatch?.[1]) {
      return decodeURIComponent(mediaMatch[1]);
    }
    const parts = path.split("/");
    if (parts.length >= 2) {
      return decodeURIComponent(parts.slice(1).join("/"));
    }
  } catch {
    // ignore
  }

  return null;
}

type StudioLogoProps = {
  imageUrl?: string | null;
  title: string;
  size?: "sm" | "lg" | "cover";
  className?: string;
};

export function StudioLogo({
  imageUrl,
  title,
  size = "sm",
  className,
}: StudioLogoProps) {
  const { accessToken } = useAuth();
  const [src, setSrc] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  const storageKey = imageUrl ? extractStudioImageStorageKey(imageUrl) : null;
  const initial = title.trim().slice(0, 1).toUpperCase() || "?";

  useEffect(() => {
    setBroken(false);
    let cancelled = false;
    let objectUrl: string | null = null;

    const run = async () => {
      if (!storageKey || !accessToken) {
        if (!cancelled) setSrc(null);
        return;
      }
      const blobUrl = await fetchImageStreamBlobUrl(accessToken, storageKey);
      if (cancelled) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        return;
      }
      objectUrl = blobUrl;
      setSrc(blobUrl);
    };

    void run();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, storageKey]);

  const logoClassName = cn(
    "studio-logo",
    size === "lg" && "studio-logo--lg",
    size === "cover" && "studio-logo--cover",
    className,
  );

  const showImage = Boolean(src) && !broken;

  return (
    <div className={logoClassName}>
      {showImage ? (
        <img
          src={src!}
          alt=""
          className="studio-logo__img"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="studio-logo__placeholder">{initial}</span>
      )}
    </div>
  );
}

export function toStudioImageStorageRef(uploaded: {
  key: string;
  url: string;
}): string {
  return uploaded.key.trim() || uploaded.url.trim();
}
