import { Buttons } from "../../buttons/Buttons";
import type { MarkdownLightboxState } from "./markdown-preview-types";

type ScriptMarkdownLightboxProps = {
  lightbox: MarkdownLightboxState | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function ScriptMarkdownLightbox({
  lightbox,
  onClose,
  onPrev,
  onNext,
}: ScriptMarkdownLightboxProps) {
  if (!lightbox) return null;

  const currentSlide = lightbox.slides[lightbox.index]!;
  const hasMultipleSlides = lightbox.slides.length > 1;
  const counterLabel = `${lightbox.index + 1} / ${lightbox.slides.length}`;

  return (
    <div
      className="markdown-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
      onClick={onClose}
    >
      <div
        className="markdown-lightbox__content"
        onClick={(e) => e.stopPropagation()}
      >
        <Buttons.CloseButton
          variant="markdownLightbox"
          onClick={onClose}
          aria-label="Закрыть"
          title="Закрыть"
        />
        <img
          key={currentSlide.src}
          className="markdown-lightbox__img"
          src={currentSlide.src}
          alt={currentSlide.alt || ""}
        />
        {hasMultipleSlides ? (
          <>
            <button
              type="button"
              className="markdown-lightbox__nav markdown-lightbox__nav--prev"
              aria-label="Предыдущее изображение"
              title="Предыдущее (←)"
              onClick={onPrev}
            >
              ‹
            </button>
            <button
              type="button"
              className="markdown-lightbox__nav markdown-lightbox__nav--next"
              aria-label="Следующее изображение"
              title="Следующее (→)"
              onClick={onNext}
            >
              ›
            </button>
            <div className="markdown-lightbox__counter" aria-live="polite">
              {counterLabel}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
