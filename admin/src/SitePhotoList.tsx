import { useState } from "react";
import "./site-photo-list.css";

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

function SitePhotoItem({
  path,
  onRemove,
}: {
  path: string;
  onRemove: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const label = photoLabel(path);
  const src = siteMediaUrl(path);

  return (
    <li className="site-photo-list__item">
      <div className="site-photo-list__thumb">
        {broken || !src ? (
          <span className="site-photo-list__missing">нет превью</span>
        ) : (
          <img src={src} alt={label} onError={() => setBroken(true)} />
        )}
        <button
          type="button"
          className="site-photo-list__remove"
          onClick={onRemove}
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
}: {
  photos: string[];
  onRemove: (index: number) => void;
}) {
  if (photos.length === 0) {
    return <p className="site-photo-list__empty">Нет фото</p>;
  }

  return (
    <ul className="site-photo-list">
      {photos.map((path, index) => (
        <SitePhotoItem key={`${path}-${index}`} path={path} onRemove={() => onRemove(index)} />
      ))}
    </ul>
  );
}
