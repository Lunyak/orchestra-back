import { useEffect, useRef, useState } from "react";
import cn from "classnames";
import { fetchImageStreamBlobUrl } from "../../../sync/api/files";
import {
  resolveSoundIconDisplaySrc,
  type SoundIconFields,
} from "../../platform/resolve-sound-icon-url";
import { useAppSelector } from "../../store/hooks";

type SoundTrackIconProps = {
  projectName: string;
  track: SoundIconFields & { name: string };
  className?: string;
};

export function SoundTrackIcon({ projectName, track, className }: SoundTrackIconProps) {
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    const projectId =
      typeof window !== "undefined"
        ? window.localStorage.getItem(`projectId:${projectName}`)
        : null;

    void (async () => {
      const resolved = await resolveSoundIconDisplaySrc(
        projectName,
        track,
        accessToken,
        projectId,
      );
      if (cancelled) {
        if (resolved.startsWith("blob:")) URL.revokeObjectURL(resolved);
        return;
      }
      if (resolved.startsWith("blob:")) {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = resolved;
      }
      setSrc(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    projectName,
    track.icon,
    track.iconRemoteKey,
    track.iconRemoteUrl,
    track.iconPreviewUrl,
    accessToken,
  ]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handleError = () => {
    if (failed) return;
    setFailed(true);
    const key = String(track.iconRemoteKey ?? "").trim();
    const token =
      accessToken ??
      (typeof window !== "undefined" ? localStorage.getItem("accessToken") : null);
    if (!key || !token) return;
    void fetchImageStreamBlobUrl(token, key).then((blobUrl) => {
      if (!blobUrl) return;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = blobUrl;
      setSrc(blobUrl);
    });
  };

  if (!src) {
    return (
      <div className={cn("header-player-track-name", className)} title={track.name}>
        {track.name}
      </div>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={track.name}
      title={track.name}
      onError={handleError}
    />
  );
}
