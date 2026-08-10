import { useCallback, useRef, useState } from "react";
import type { ProjectRoleInfo } from "../../sync/api/projects";
import { uploadProjectFile } from "../../sync/api/files";
import { RolePlayingCard } from "./RolePlayingCard";
import "./RoleAvatarEditor.css";

export type RoleAvatarEditorProps = {
  accessToken: string;
  projectId: string;
  role: Pick<ProjectRoleInfo, "id" | "title" | "avatarKey">;
  canEdit: boolean;
  busy?: boolean;
  variant?: "default" | "plain";
  onSaveAvatarKey: (avatarKey: string | null) => Promise<void>;
};

export function RoleAvatarEditor({
  accessToken,
  projectId,
  role,
  canEdit,
  busy = false,
  variant = "default",
  onSaveAvatarKey,
}: RoleAvatarEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File | null) => {
      if (!file || !canEdit) return;
      setUploading(true);
      setError(null);
      try {
        const { key, url } = await uploadProjectFile(accessToken, {
          projectId,
          type: "image",
          file,
        });
        if (!key) return;
        await onSaveAvatarKey(key);
        if (url) setPreviewUrl(url);
      } catch {
        setError("Не удалось сохранить аватарку роли");
      } finally {
        setUploading(false);
      }
    },
    [accessToken, canEdit, onSaveAvatarKey, projectId],
  );

  const onPaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (!canEdit) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((it) => String(it.type ?? "").startsWith("image/"));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      await uploadFile(file);
    },
    [canEdit, uploadFile],
  );

  const hasAvatar = Boolean(previewUrl || role.avatarKey);
  const isBusy = busy || uploading;

  const clearAvatar = useCallback(async () => {
    if (!canEdit) return;
    setError(null);
    try {
      await onSaveAvatarKey(null);
      setPreviewUrl(null);
    } catch {
      setError("Не удалось удалить аватарку роли");
    }
  }, [canEdit, onSaveAvatarKey]);

  return (
    <div className="role-avatar-editor" onPaste={onPaste}>
      {canEdit ? (
        <div className="role-avatar-editor__card-container">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void uploadFile(e.target.files?.[0] ?? null)}
          />
          <div className="role-avatar-editor__card-frame">
            <RolePlayingCard role={role} accessToken={accessToken} imageUrl={previewUrl} size="lg" variant={variant} />
            {!hasAvatar ? (
              <button
                className="role-avatar-editor__upload-overlay"
                type="button"
                disabled={isBusy}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? "Загрузка…" : "Загрузить аватарку"}
              </button>
            ) : null}
            {hasAvatar ? (
              <button
                className="role-avatar-editor__remove"
                type="button"
                disabled={isBusy}
                onClick={() => {
                void clearAvatar();
                }}
                aria-label="Удалить аватарку роли"
                title="Удалить аватарку"
              >
                ×
              </button>
            ) : null}
          </div>
          {error ? <div className="role-avatar-editor__error">{error}</div> : null}
        </div>
      ) : (
        <RolePlayingCard role={role} accessToken={accessToken} imageUrl={previewUrl} size="lg" variant={variant} />
      )}
    </div>
  );
}
