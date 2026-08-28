import cn from "classnames";
import { Button } from "@shared/core/button/Button";
import type { ClipboardEvent, MutableRefObject } from "react";
import type { DirectorReferenceImage } from "../model/roleWorkbookNote";

type CombinedReferenceImage = {
  source: "actor" | "director";
  sourceLabel: string;
  img: { key: string; url?: string; caption?: string };
  idx: number;
};

export type WorkbookReferenceImagesSectionProps = {
  hidden: boolean;
  canEdit: boolean;
  canEditDirectorRefs: boolean;
  canAddReferenceImages: boolean;
  referenceAuthorLabel: string;
  referenceUploading: boolean;
  directorRefsError: string | null;
  combinedReferenceImages: CombinedReferenceImage[];
  referenceColumns: CombinedReferenceImage[][];
  actorImages: Array<{ key: string; url?: string; caption?: string }>;
  directorImages: DirectorReferenceImage[];
  actorFileInputRef: MutableRefObject<HTMLInputElement | null>;
  directorFileInputRef: MutableRefObject<HTMLInputElement | null>;
  directorRefsSectionRef: MutableRefObject<HTMLDivElement | null>;
  urlCacheRef: MutableRefObject<Map<string, string>>;
  ensureImageUrl: (key: string) => Promise<string | null>;
  uploadActorImages: (files: File[]) => Promise<void>;
  uploadDirectorImages: (files: File[]) => Promise<void>;
  uploadReferenceImages: (files: File[]) => Promise<void>;
  onReferenceRefsPaste: (e: ClipboardEvent<HTMLDivElement>) => void;
  imageFilesFromTransfer: (data: DataTransfer | null | undefined) => File[];
  lightboxIdx: number | null;
  setLightboxIdx: (value: number | null | ((prev: number | null) => number | null)) => void;
  actorLightboxIdx: number | null;
  setActorLightboxIdx: (value: number | null | ((prev: number | null) => number | null)) => void;
  onRemoveActorImage: (key: string) => void;
  onRemoveDirectorImage: (key: string) => void;
  urlTick: number;
};

function ReferenceImageTile(props: {
  item: CombinedReferenceImage;
  url: string;
  canEditThisImage: boolean;
  onOpen: () => void;
  onEnsureUrl: () => void;
  onDelete: () => void;
}) {
  const { item, url, canEditThisImage, onOpen, onEnsureUrl, onDelete } = props;
  const { img } = item;

  return (
    <div className="rolewb-img-tile">
      <div className="rolewb-img-source">{item.sourceLabel}</div>
      {url ? (
        <img
          className="rolewb-img"
          src={url}
          alt={img.caption || "reference"}
          onClick={onOpen}
          onError={onEnsureUrl}
        />
      ) : (
        <div
          className="rolewb-img-placeholder"
          onClick={() => {
            onEnsureUrl();
            onOpen();
          }}
        >
          загрузка…
        </div>
      )}
      {canEditThisImage ? (
        <Button
          className="danger rolewb-img-delete"
          type="button"
          onClick={onDelete}
          aria-label="Удалить референс"
          title="Удалить"
        >
          Удалить
        </Button>
      ) : null}
    </div>
  );
}

export function WorkbookReferenceImagesSection(props: WorkbookReferenceImagesSectionProps) {
  const {
    hidden,
    canEdit,
    canEditDirectorRefs,
    canAddReferenceImages,
    referenceAuthorLabel,
    referenceUploading,
    directorRefsError,
    combinedReferenceImages,
    referenceColumns,
    actorImages,
    directorImages,
    actorFileInputRef,
    directorFileInputRef,
    directorRefsSectionRef,
    urlCacheRef,
    ensureImageUrl,
    uploadActorImages,
    uploadDirectorImages,
    uploadReferenceImages,
    onReferenceRefsPaste,
    imageFilesFromTransfer,
    lightboxIdx,
    setLightboxIdx,
    actorLightboxIdx,
    setActorLightboxIdx,
    onRemoveActorImage,
    onRemoveDirectorImage,
    urlTick,
  } = props;

  void urlTick;

  const useRowGallery = combinedReferenceImages.length <= 4;
  const columnCount = referenceColumns.length;
  const galleryClassName = useRowGallery
    ? cn(
        "rolewb-gallery",
        "rolewb-reference-gallery",
        "rolewb-reference-gallery_row",
        "rolewb-reference-gallery--spaced",
      )
    : cn(
        "rolewb-reference-columns",
        columnCount === 2 && "rolewb-reference-columns--cols-2",
        columnCount === 3 && "rolewb-reference-columns--cols-3",
        columnCount === 4 && "rolewb-reference-columns--cols-4",
      );

  const dropzoneLabel = referenceUploading
    ? "Загрузка…"
    : canAddReferenceImages
      ? "Кликни сюда, вставь картинку (Ctrl+V) или перетащи файлы сюда."
      : "Только просмотр.";

  const renderTile = (item: CombinedReferenceImage) => {
    const { img } = item;
    const url = urlCacheRef.current?.get(img.key) || String(img.url ?? "");
    const canEditThisImage = item.source === "actor" ? canEdit : canEditDirectorRefs;
    return (
      <ReferenceImageTile
        key={`${item.source}-${img.key}`}
        item={item}
        url={url}
        canEditThisImage={canEditThisImage}
        onOpen={() =>
          item.source === "actor" ? setActorLightboxIdx(item.idx) : setLightboxIdx(item.idx)
        }
        onEnsureUrl={() => {
          urlCacheRef.current?.delete(img.key);
          void ensureImageUrl(img.key);
        }}
        onDelete={() => {
          if (item.source === "actor") {
            onRemoveActorImage(img.key);
            return;
          }
          onRemoveDirectorImage(img.key);
        }}
      />
    );
  };

  const actorLightboxImage =
    actorLightboxIdx != null ? actorImages[actorLightboxIdx] : null;
  const directorLightboxImage = lightboxIdx != null ? directorImages[lightboxIdx] : null;

  return (
    <div className="rolewb-actor-reference-panel" hidden={hidden}>
      <div
        ref={directorRefsSectionRef}
        className="rolewb-card rolewb-section"
        id="rolewb-section-referenceImages"
      >
        <div className="rolewb-section-head">
          <span className="rolewb-section-num">10</span>
          <div className="rolewb-card-title">Референсы</div>
        </div>
        <div className="rolewb-hint">
          Общая доска картинок для роли: актёрские наблюдения, фактуры, костюм, пластика и настроение.
          Добавлять может актёр своей тетрадки и режиссёр; у каждой картинки будет виден автор.
        </div>
        {canAddReferenceImages ? (
          <div className="rolewb-hint">
            Новые картинки будут помечены как добавленные от {referenceAuthorLabel}.
          </div>
        ) : null}
        <input
          ref={actorFileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            void uploadActorImages(files);
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={directorFileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            void uploadDirectorImages(files);
            e.currentTarget.value = "";
          }}
        />
        <div
          className="rolewb-dropzone rolewb-dropzone--spaced"
          tabIndex={0}
          onPaste={onReferenceRefsPaste}
          onDragOver={(e) => {
            if (!canAddReferenceImages) return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (!canAddReferenceImages) return;
            e.preventDefault();
            const files = imageFilesFromTransfer(e.dataTransfer);
            void uploadReferenceImages(files);
          }}
          onClick={(e) => {
            try {
              e.currentTarget.focus();
            } catch {
              /* ignore */
            }
            if (!canAddReferenceImages) return;
            if (canEdit) actorFileInputRef.current?.click();
            else directorFileInputRef.current?.click();
          }}
          title="Кликни сюда и нажми Ctrl+V, либо перетащи файлы"
        >
          {dropzoneLabel}
        </div>

        {directorRefsError ? <div className="settings-invite-error">{directorRefsError}</div> : null}
        {combinedReferenceImages.length === 0 ? (
          <div className="rolewb-hint">Пока нет картинок.</div>
        ) : (
          <div className={galleryClassName}>
            {useRowGallery
              ? combinedReferenceImages.map(renderTile)
              : referenceColumns.map((column, columnIdx) => (
                  <div key={`ref-col-${columnIdx}`} className="rolewb-reference-column">
                    {column.map(renderTile)}
                  </div>
                ))}
          </div>
        )}
      </div>

      {actorLightboxImage && actorLightboxIdx != null ? (
        <div
          className="rolewb-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setActorLightboxIdx(null)}
        >
          <div className="rolewb-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="rolewb-row rolewb-row--between">
              <div className="rolewb-meta">
                {actorLightboxImage.caption || `Кадр ${actorLightboxIdx + 1}`}
              </div>
              <Button className="secondary" type="button" onClick={() => setActorLightboxIdx(null)}>
                Закрыть
              </Button>
            </div>
            <img
              className="rolewb-lightbox-img"
              src={
                urlCacheRef.current?.get(actorLightboxImage.key) ||
                String(actorLightboxImage.url ?? "")
              }
              alt={actorLightboxImage.caption || "reference"}
              onError={() => {
                urlCacheRef.current?.delete(actorLightboxImage.key);
                void ensureImageUrl(actorLightboxImage.key);
              }}
            />
            <div className="rolewb-row rolewb-row--between">
              <Button
                className="secondary"
                type="button"
                onClick={() =>
                  setActorLightboxIdx((i) =>
                    i == null ? null : (i - 1 + actorImages.length) % actorImages.length,
                  )
                }
              >
                ←
              </Button>
              <div className="rolewb-meta rolewb-meta--muted">
                {actorLightboxIdx + 1} / {actorImages.length}
              </div>
              <Button
                className="secondary"
                type="button"
                onClick={() =>
                  setActorLightboxIdx((i) =>
                    i == null ? null : (i + 1) % actorImages.length,
                  )
                }
              >
                →
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {directorLightboxImage && lightboxIdx != null ? (
        <div
          className="rolewb-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIdx(null)}
        >
          <div className="rolewb-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="rolewb-row rolewb-row--between">
              <div className="rolewb-meta">
                {directorLightboxImage.caption || `Кадр ${lightboxIdx + 1}`}
              </div>
              <Button className="secondary" type="button" onClick={() => setLightboxIdx(null)}>
                Закрыть
              </Button>
            </div>
            <img
              className="rolewb-lightbox-img"
              src={
                urlCacheRef.current?.get(directorLightboxImage.key) ||
                String(directorLightboxImage.url ?? "")
              }
              alt={directorLightboxImage.caption || "reference"}
              onError={() => {
                urlCacheRef.current?.delete(directorLightboxImage.key);
                void ensureImageUrl(directorLightboxImage.key);
              }}
            />
            <div className="rolewb-row rolewb-row--between">
              <Button
                className="secondary"
                type="button"
                onClick={() =>
                  setLightboxIdx((i) =>
                    i == null ? null : (i - 1 + directorImages.length) % directorImages.length,
                  )
                }
              >
                ←
              </Button>
              <div className="rolewb-meta rolewb-meta--muted">
                {lightboxIdx + 1} / {directorImages.length}
              </div>
              <Button
                className="secondary"
                type="button"
                onClick={() =>
                  setLightboxIdx((i) => (i == null ? null : (i + 1) % directorImages.length))
                }
              >
                →
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
