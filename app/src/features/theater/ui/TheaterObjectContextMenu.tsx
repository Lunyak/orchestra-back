import cn from "classnames";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TheaterRangeField } from "./theater-controls-ui";

export type TheaterObjectContextMenuRange = {
  min: number;
  max: number;
  step: number;
  value: number;
  formatValue?: (value: number) => string;
};

export type TheaterObjectContextMenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  colorValue?: string;
  range?: TheaterObjectContextMenuRange;
  children?: TheaterObjectContextMenuItem[];
};

type TheaterObjectContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  title?: string;
  items: TheaterObjectContextMenuItem[];
  onPick: (id: string) => void;
  onColorChange?: (id: string, color: string) => void;
  onColorCommit?: () => void;
  onRangeChange?: (id: string, value: number) => void;
  onRangeStart?: () => void;
  onRangeCommit?: () => void;
  onClose: () => void;
};

function getItemAtPath(
  items: TheaterObjectContextMenuItem[],
  path: string[],
): TheaterObjectContextMenuItem | undefined {
  let current = items;
  let found: TheaterObjectContextMenuItem | undefined;
  for (const id of path) {
    found = current.find((item) => item.id === id);
    if (!found) return undefined;
    current = found.children ?? [];
  }
  return found;
}

function placeMenuPanel(el: HTMLDivElement, anchor: DOMRect) {
  const pad = 8;
  const rect = el.getBoundingClientRect();
  let left = anchor.right + 4;
  let top = anchor.top;
  if (left + rect.width > window.innerWidth - pad) {
    left = Math.max(pad, anchor.left - rect.width - 4);
  }
  if (top + rect.height > window.innerHeight - pad) {
    top = Math.max(pad, window.innerHeight - pad - rect.height);
  }
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function ColorMenuRow({
  item,
  onColorChange,
  onColorCommit,
}: {
  item: TheaterObjectContextMenuItem;
  onColorChange?: (id: string, color: string) => void;
  onColorCommit?: () => void;
}) {
  return (
    <label
      className={cn(
        "theater-object-context-menu__item",
        "theater-object-context-menu__item--color",
      )}
    >
      <span>{item.label}</span>
      <input
        type="color"
        className="theater-color-input"
        value={item.colorValue}
        aria-label={item.label}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onColorChange?.(item.id, event.target.value)}
        onBlur={onColorCommit}
      />
    </label>
  );
}

function RangeMenuRow({
  item,
  onRangeChange,
  onRangeStart,
  onRangeCommit,
}: {
  item: TheaterObjectContextMenuItem;
  onRangeChange?: (id: string, value: number) => void;
  onRangeStart?: () => void;
  onRangeCommit?: () => void;
}) {
  if (!item.range) return null;
  return (
    <div
      className="theater-object-context-menu__range"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <TheaterRangeField
        label={item.label}
        min={item.range.min}
        max={item.range.max}
        step={item.range.step}
        value={item.range.value}
        disabled={item.disabled}
        formatValue={item.range.formatValue}
        onChange={(value) => onRangeChange?.(item.id, value)}
        onInteractStart={onRangeStart}
        onInteractEnd={onRangeCommit}
      />
    </div>
  );
}

function renderMenuItem(
  item: TheaterObjectContextMenuItem,
  expanded: boolean,
  onOpenSubmenu: (item: TheaterObjectContextMenuItem, anchor: DOMRect) => void,
  onPick: (id: string) => void,
  onClose: () => void,
  onColorChange?: (id: string, color: string) => void,
  onColorCommit?: () => void,
  onRangeChange?: (id: string, value: number) => void,
  onRangeStart?: () => void,
  onRangeCommit?: () => void,
) {
  if (item.range) {
    return (
      <RangeMenuRow
        key={item.id}
        item={item}
        onRangeChange={onRangeChange}
        onRangeStart={onRangeStart}
        onRangeCommit={onRangeCommit}
      />
    );
  }
  if (item.colorValue != null) {
    return (
      <ColorMenuRow
        key={item.id}
        item={item}
        onColorChange={onColorChange}
        onColorCommit={onColorCommit}
      />
    );
  }
  return (
    <MenuCommand
      key={item.id}
      item={item}
      expanded={expanded}
      onOpenSubmenu={onOpenSubmenu}
      onPick={onPick}
      onClose={onClose}
    />
  );
}

function menuHasRangeFields(items: TheaterObjectContextMenuItem[]) {
  return items.some((item) => item.range != null);
}

function MenuCommand({
  item,
  expanded,
  onOpenSubmenu,
  onPick,
  onClose,
}: {
  item: TheaterObjectContextMenuItem;
  expanded?: boolean;
  onOpenSubmenu?: (item: TheaterObjectContextMenuItem, anchor: DOMRect) => void;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const hasChildren = Boolean(item.children?.length);
  return (
    <button
      type="button"
      role="menuitem"
      aria-haspopup={hasChildren ? "menu" : undefined}
      aria-expanded={hasChildren ? expanded : undefined}
      className={cn(
        "theater-object-context-menu__item",
        hasChildren && "theater-object-context-menu__item--submenu",
        expanded && "theater-object-context-menu__item--open",
        item.active && "theater-object-context-menu__item--active",
        item.danger && "theater-object-context-menu__item--danger",
        item.disabled && "theater-object-context-menu__item--disabled",
      )}
      disabled={item.disabled}
      onClick={(event) => {
        if (item.disabled) return;
        if (hasChildren) {
          onOpenSubmenu?.(item, event.currentTarget.getBoundingClientRect());
          return;
        }
        onPick(item.id);
        onClose();
      }}
    >
      <span>{item.label}</span>
      {hasChildren ? (
        <span className="theater-object-context-menu__chevron" aria-hidden>
          ›
        </span>
      ) : null}
    </button>
  );
}

export function TheaterObjectContextMenu({
  open,
  x,
  y,
  title,
  items,
  onPick,
  onColorChange,
  onColorCommit,
  onRangeChange,
  onRangeStart,
  onRangeCommit,
  onClose,
}: TheaterObjectContextMenuProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [submenuPath, setSubmenuPath] = useState<string[]>([]);
  const [submenuAnchors, setSubmenuAnchors] = useState<DOMRect[]>([]);

  useEffect(() => {
    if (!open) {
      setSubmenuPath([]);
      setSubmenuAnchors([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (submenuPath.length) {
        setSubmenuPath((path) => path.slice(0, -1));
        setSubmenuAnchors((anchors) => anchors.slice(0, -1));
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submenuPath.length]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const left = Math.min(x, Math.max(pad, window.innerWidth - pad - rect.width));
    const top = Math.min(y, Math.max(pad, window.innerHeight - pad - rect.height));
    el.style.left = `${Math.max(pad, left)}px`;
    el.style.top = `${Math.max(pad, top)}px`;
  }, [open, x, y, items, title]);

  useLayoutEffect(() => {
    submenuPath.forEach((_, index) => {
      const el = layerRefs.current[index];
      const anchor = submenuAnchors[index];
      if (!el || !anchor) return;
      placeMenuPanel(el, anchor);
    });
  }, [submenuPath, submenuAnchors, items]);

  const openSubmenuAt = (
    depth: number,
    item: TheaterObjectContextMenuItem,
    anchor: DOMRect,
  ) => {
    const nextPath = [...submenuPath.slice(0, depth), item.id];
    const isSame = submenuPath[depth] === item.id && submenuPath.length === depth + 1;
    if (isSame) {
      setSubmenuPath(submenuPath.slice(0, depth));
      setSubmenuAnchors(submenuAnchors.slice(0, depth));
      return;
    }
    setSubmenuPath(nextPath);
    setSubmenuAnchors([...submenuAnchors.slice(0, depth), anchor]);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="theater-object-context-menu__backdrop"
        role="presentation"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={cn(
          "theater-object-context-menu",
          menuHasRangeFields(items) && "theater-object-context-menu--panel",
        )}
        role="menu"
        aria-label={title ?? "Действия"}
      >
        {title ? (
          <div className="theater-object-context-menu__title">{title}</div>
        ) : null}
        {items.map((item) =>
          renderMenuItem(
            item,
            submenuPath[0] === item.id,
            (next, anchor) => openSubmenuAt(0, next, anchor),
            onPick,
            onClose,
            onColorChange,
            onColorCommit,
            onRangeChange,
            onRangeStart,
            onRangeCommit,
          ),
        )}
      </div>
      {submenuPath.map((id, index) => {
        const node = getItemAtPath(items, submenuPath.slice(0, index + 1));
        if (!node?.children) return null;
        return (
          <div
            key={id}
            ref={(el) => {
              layerRefs.current[index] = el;
            }}
            className={cn(
              "theater-object-context-menu",
              "theater-object-context-menu--sub",
              menuHasRangeFields(node.children) &&
                "theater-object-context-menu--panel",
            )}
            role="menu"
            aria-label={node.label}
          >
            {node.children.map((child) =>
              renderMenuItem(
                child,
                submenuPath[index + 1] === child.id,
                (next, anchor) => openSubmenuAt(index + 1, next, anchor),
                onPick,
                onClose,
                onColorChange,
                onColorCommit,
                onRangeChange,
                onRangeStart,
                onRangeCommit,
              ),
            )}
          </div>
        );
      })}
    </>
  );
}
