import { useState, type DragEvent } from "react";
import "./site-photo-list.css";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function siteMediaUrl(pathOrUrl: string): string {
  const value = pathOrUrl.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const withoutSlash = value.replace(/^\/+/, "");
  const encoded = withoutSlash.split("/").map(encodeURIComponent).join("/");
  return `/minio/orchestra-media/site/${encoded}`;
}

function photoLabel(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

function moveItem(list: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function SitePhotoItem({
  path,
  dragging,
  dropTarget,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  path: string;
  dragging: boolean;
  dropTarget: boolean;
  onRemove: () => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const label = photoLabel(path);
  const src = siteMediaUrl(path);

  return (
    <li
      className={cn(
        "site-photo-list__item",
        dragging && "is-dragging",
        dropTarget && "is-drop-target"
      )}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="site-photo-list__thumb">
        {broken || !src ? (
          <span className="site-photo-list__missing">нет превью</span>
        ) : (
          <img src={src} alt={label} draggable={false} onError={() => setBroken(true)} />
        )}
        <button
          type="button"
          className="site-photo-list__remove"
          onClick={onRemove}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={`Удалить ${label}`}
          title="Удалить"
        >
          ×
        </button>
      </div>
      <span className="site-photo-list__name" title={path}>
        {label}
      </span>
    </li>
  );
}

export function SitePhotoList({
  photos,
  onRemove,
  onReorder,
}: {
  photos: string[];
  onRemove: (index: number) => void;
  onReorder: (photos: string[]) => void;
}) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return <p className="site-photo-list__empty">Нет фото</p>;
  }

  return (
    <>
      <p className="site-photo-list__hint">Перетащи превью, чтобы изменить порядок</p>
      <ul className="site-photo-list">
        {photos.map((path, index) => (
          <SitePhotoItem
            key={`${path}-${index}`}
            path={path}
            dragging={draggingIndex === index}
            dropTarget={dropIndex === index && draggingIndex !== index}
            onRemove={() => onRemove(index)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(index));
              setDraggingIndex(index);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (dropIndex !== index) setDropIndex(index);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const from = Number(event.dataTransfer.getData("text/plain"));
              onReorder(moveItem(photos, from, index));
              setDraggingIndex(null);
              setDropIndex(null);
            }}
            onDragEnd={() => {
              setDraggingIndex(null);
              setDropIndex(null);
            }}
          />
        ))}
      </ul>
    </>
  );
}
