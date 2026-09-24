import { useRef, useState, type DragEvent, type MouseEvent } from "react";
import { siteMediaUrl } from "./SitePhotoList";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type SiteEventsListItem = {
  slug: string;
  name: string;
  soon?: boolean;
  cardImage?: string;
  listImage?: string;
};

function ListThumb({ path }: { path: string }) {
  const [broken, setBroken] = useState(false);
  if (!path || broken) {
    return <span className="site-events-list__thumb site-events-list__thumb--empty" aria-hidden />;
  }
  return (
    <img
      className="site-events-list__thumb"
      src={siteMediaUrl(path)}
      alt=""
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}

function canMove(length: number, from: number, to: number) {
  return from !== to && from >= 0 && to >= 0 && from < length && to < length;
}

export function SiteFileButton({
  label,
  accept,
  multiple,
  disabled,
  onPick,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onPick: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="site-events__upload">
      <input
        ref={inputRef}
        className="site-events__file"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onPick(files);
        }}
      />
      <button type="button" className="small" disabled={disabled} onClick={() => inputRef.current?.click()}>
        {label}
      </button>
    </div>
  );
}

export function SiteEventsList({
  events,
  selectedSlug,
  onSelect,
  onReorder,
  onRemove,
}: {
  events: SiteEventsListItem[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (slug: string) => void;
}) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const onDeleteClick = (event: MouseEvent<HTMLButtonElement>, slug: string) => {
    event.stopPropagation();
    onRemove(slug);
  };

  return (
    <section className="site-events__panel site-events__panel--list" aria-label="Список спектаклей">
      <h2 className="site-events__panel-title">Список</h2>
      <p className="site-events__hint">
        Перетащи строку, чтобы изменить порядок на афише. Удаление и новый порядок появятся на сайте после
        «Опубликовать».
      </p>
      {events.length === 0 ? (
        <p className="site-events__empty">Список пуст. Нажми «Создать».</p>
      ) : (
        <ul className="site-events-list">
          {events.map((event, index) => {
            const selected = event.slug === selectedSlug;
            const itemClassName = cn(
              "site-events-list__item",
              selected && "is-selected",
              draggingIndex === index && "is-dragging",
              dropIndex === index && draggingIndex !== index && "is-drop-target"
            );
            return (
              <li
                key={event.slug}
                className={itemClassName}
                draggable
                onDragStart={(dragEvent: DragEvent<HTMLLIElement>) => {
                  const target = dragEvent.target as HTMLElement;
                  if (target.closest(".site-events-list__delete")) {
                    dragEvent.preventDefault();
                    return;
                  }
                  dragEvent.dataTransfer.effectAllowed = "move";
                  dragEvent.dataTransfer.setData("text/plain", String(index));
                  setDraggingIndex(index);
                }}
                onDragOver={(dragEvent: DragEvent<HTMLLIElement>) => {
                  dragEvent.preventDefault();
                  dragEvent.dataTransfer.dropEffect = "move";
                  if (dropIndex !== index) setDropIndex(index);
                }}
                onDrop={(dragEvent: DragEvent<HTMLLIElement>) => {
                  dragEvent.preventDefault();
                  const from = Number(dragEvent.dataTransfer.getData("text/plain"));
                  if (canMove(events.length, from, index)) onReorder(from, index);
                  setDraggingIndex(null);
                  setDropIndex(null);
                }}
                onDragEnd={() => {
                  setDraggingIndex(null);
                  setDropIndex(null);
                }}
              >
                <span className="site-events-list__grip" aria-hidden>
                  ⋮⋮
                </span>
                <button type="button" className="site-events-list__select" onClick={() => onSelect(event.slug)}>
                  <span className="site-events-list__index">{index + 1}</span>
                  <ListThumb
                    key={event.listImage?.trim() || event.cardImage?.trim() || event.slug}
                    path={event.listImage?.trim() || event.cardImage?.trim() || ""}
                  />
                  <span className="site-events-list__text">
                    <span className="site-events-list__name">{event.name}</span>
                    <span className="site-events-list__slug">{event.slug}</span>
                  </span>
                  {event.soon ? <span className="site-events-list__soon">скоро</span> : null}
                </button>
                <button
                  type="button"
                  className="site-events-list__delete"
                  onClick={(clickEvent) => onDeleteClick(clickEvent, event.slug)}
                  onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
                  onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                  aria-label={`Удалить ${event.name}`}
                >
                  Удалить
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
