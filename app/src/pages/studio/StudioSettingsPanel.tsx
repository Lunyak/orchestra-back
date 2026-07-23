import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "../../features/auth";
import type { StudioDetail } from "../../features/studio";
import { useUpdateStudioMutation } from "../../features/studio";
import { uploadProjectFile } from "../../sync/api/files";
import { StudioLogo, toStudioImageStorageRef } from "./StudioLogo";
import "./style.css";

type StudioSettingsPanelProps = {
  studio: StudioDetail;
  onClose: () => void;
};

export function StudioSettingsPanel({
  studio,
  onClose,
}: StudioSettingsPanelProps) {
  const { accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updateStudio, { isLoading: saving }] = useUpdateStudioMutation();

  const [title, setTitle] = useState(studio.title);
  const [description, setDescription] = useState(studio.description ?? "");
  const [imageUrl, setImageUrl] = useState(studio.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !accessToken) return;

    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      setFormError("Выберите файл изображения");
      return;
    }

    setFormError(null);
    setUploading(true);
    try {
      const uploaded = await uploadProjectFile(accessToken, {
        projectId: `studio-${studio.id}`,
        type: "image",
        file,
      });
      setImageUrl(toStudioImageStorageRef(uploaded));
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Не удалось загрузить изображение",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleClearImage = () => {
    setImageUrl("");
  };

  const handleSave = async () => {
    setFormError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Укажите название студии");
      return;
    }

    try {
      await updateStudio({
        id: studio.id,
        body: {
          title: trimmedTitle,
          description: description.trim() || null,
          imageUrl: imageUrl.trim() || null,
        },
      }).unwrap();
      onClose();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Не удалось сохранить изменения",
      );
    }
  };

  const previewSrc = imageUrl.trim() || null;
  const isBusy = saving || uploading;

  return (
    <div className="studio-settings">
      <h2 className="studio-form-section__title">Настройки студии</h2>
      {formError ? <p className="studio-page__error">{formError}</p> : null}

      <div className="studio-settings__image-row">
        <StudioLogo
          imageUrl={previewSrc}
          title={title || studio.title}
          size="lg"
        />
        <div className="studio-settings__image-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="studio-file-input"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            onClick={handlePickImage}
            disabled={!accessToken || isBusy}
          >
            {uploading ? "Загрузка…" : "Загрузить фото"}
          </Button>
          {previewSrc ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClearImage}
              disabled={isBusy}
            >
              Убрать
            </Button>
          ) : null}
        </div>
      </div>

      <FormInlineRow className="studio-form-row">
        <InlineTextField
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
        />
      </FormInlineRow>
      <textarea
        className="studio-textarea"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Описание"
      />

      <div className="studio-actions">
        <Button type="button" onClick={handleSave} disabled={isBusy}>
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={isBusy}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
