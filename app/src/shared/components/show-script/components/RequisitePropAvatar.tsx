import cn from "classnames";
import React, { useEffect, useRef, useState } from "react";
import { ensureProject } from "../../../../sync/api/projects";
import { getPlayUrl, uploadProjectFile } from "../../../../sync/api/files";
import { MiniAvatar } from "../../mini-avatar/MiniAvatar";

function usePlayImageUrl(
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

export function RequisitePropAvatar({
  label,
  avatarKey,
  isEditing,
  accessToken,
  projectSlug,
  onAvatarKeyChange,
}: {
  label: string;
  avatarKey?: string;
  isEditing: boolean;
  accessToken: string | null | undefined;
  projectSlug: string;
  onAvatarKeyChange: (avatarKey: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const resolvedUrl = usePlayImageUrl(accessToken, avatarKey);
  const displayUrl = previewUrl || resolvedUrl;
  const hasAvatar = Boolean(String(avatarKey ?? "").trim() || previewUrl);

  useEffect(() => {
    setPreviewUrl(null);
  }, [avatarKey]);

  const uploadFile = async (file: File | null) => {
    if (!file || !isEditing) return;
    const token =
      accessToken ??
      (typeof window !== "undefined"
        ? window.localStorage.getItem("accessToken")
        : null);
    if (!token) return;

    setUploading(true);
    try {
      const project = await ensureProject(
        token,
        projectSlug,
        `Проект ${projectSlug}`,
      );
      const { key, url } = await uploadProjectFile(token, {
        projectId: project.id,
        type: "image",
        file,
      });
      if (!key) return;
      if (url) setPreviewUrl(url);
      onAvatarKeyChange(key);
    } catch (error) {
      console.error("requisite avatar upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="requisite-item-avatar">
        <MiniAvatar src={displayUrl} label={label} title={label} />
      </div>
    );
  }

  return (
    <div className="requisite-item-avatar">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void uploadFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className={cn(
          "requisite-prop-avatar-trigger",
          uploading && "requisite-prop-avatar-trigger--busy",
        )}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Аватар реквизита"
        title={hasAvatar ? "Сменить аватарку" : "Вставить аватарку"}
      >
        <MiniAvatar src={displayUrl} label={label} title={label} />
      </button>
      {hasAvatar ? (
        <button
          type="button"
          className="requisite-prop-avatar-clear"
          onClick={() => {
            setPreviewUrl(null);
            onAvatarKeyChange(null);
          }}
          aria-label="Удалить аватарку реквизита"
          title="Удалить аватарку"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
