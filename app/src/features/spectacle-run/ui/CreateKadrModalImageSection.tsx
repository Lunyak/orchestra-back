import type { Ref, RefObject } from "react";

type CreateKadrModalImageSectionProps = {
  imageInputRef: RefObject<HTMLInputElement | null>;
  imageBusy: boolean;
  imageError: string | null;
  imagePreviewUrl: string | null;
  imageMarkdown: string;
  onPasteImage: (event: React.ClipboardEvent) => void;
  onImageFile: (file: File | null) => void;
};

export function CreateKadrModalImageSection({
  imageInputRef,
  imageBusy,
  imageError,
  imagePreviewUrl,
  imageMarkdown,
  onPasteImage,
  onImageFile,
}: CreateKadrModalImageSectionProps) {
  const hasImageMarkdown = Boolean(imageMarkdown.trim());
  const pickLabel = imageBusy ? "Загрузка…" : "Выбрать файл";
  const inputRef = imageInputRef as Ref<HTMLInputElement>;

  return (
    <section className="create-kadr-modal__section">
      <h3 className="create-kadr-modal__section-title">Картинка в тексте кадра</h3>
      <div
        className="create-kadr-modal__image-drop"
        tabIndex={0}
        onPaste={(e) => void onPasteImage(e)}
      >
        <p className="create-kadr-modal__hint">
          Вставьте из буфера (Ctrl+V) или выберите файл — попадёт в markdown картины.
        </p>
        <button
          type="button"
          className="create-kadr-modal__btn create-kadr-modal__btn--ghost"
          disabled={imageBusy}
          onClick={() => imageInputRef.current?.click()}
        >
          {pickLabel}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void onImageFile(e.target.files?.[0] ?? null)}
        />
        {hasImageMarkdown ? (
          <p className="create-kadr-modal__image-ready" role="status">
            Картинка добавлена
          </p>
        ) : null}
        {imagePreviewUrl ? (
          <img
            src={imagePreviewUrl}
            alt=""
            className="create-kadr-modal__image-preview"
          />
        ) : null}
        {imageError ? (
          <p className="create-kadr-modal__error" role="alert">
            {imageError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
