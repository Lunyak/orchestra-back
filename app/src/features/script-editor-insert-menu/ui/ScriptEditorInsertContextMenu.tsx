import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ScriptEditorInsertMenuPick, ScriptEditorInsertMenuRow } from "../model/types";
import "./ScriptEditorInsertContextMenu.css";

type Props = {
  open: boolean;
  anchorX: number;
  anchorY: number;
  rows: ScriptEditorInsertMenuRow[];
  onPick: (pick: ScriptEditorInsertMenuPick) => void;
  onClose: () => void;
};

export function ScriptEditorInsertContextMenu({
  open,
  anchorX,
  anchorY,
  rows,
  onPick,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const [openSubmenuRowId, setOpenSubmenuRowId] = useState<string | null>(null);
  const [submenuAnchor, setSubmenuAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) {
      setOpenSubmenuRowId(null);
      setSubmenuAnchor(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openSubmenuRowId) {
          setOpenSubmenuRowId(null);
          setSubmenuAnchor(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, openSubmenuRowId]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    let left = anchorX;
    let top = anchorY;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - pad - rect.width);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - pad - rect.height);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [open, anchorX, anchorY, rows]);

  useLayoutEffect(() => {
    if (!openSubmenuRowId || !submenuAnchor) return;
    const sub = submenuRef.current;
    if (!sub) return;
    const pad = 8;
    const rect = sub.getBoundingClientRect();
    let left = submenuAnchor.right + 4;
    let top = submenuAnchor.top;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, submenuAnchor.left - rect.width - 4);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - pad - rect.height);
    }
    sub.style.left = `${left}px`;
    sub.style.top = `${top}px`;
  }, [openSubmenuRowId, submenuAnchor, rows]);

  const openSubmenuRow = openSubmenuRowId
    ? rows.find((r) => r.type === "submenu" && r.id === openSubmenuRowId)
    : undefined;

  if (!open) return null;

  return (
    <>
      <div
        className="script-editor-insert-menu__backdrop"
        role="presentation"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="script-editor-insert-menu"
        role="menu"
        aria-label="Вставить в сценарий"
      >
        <div className="script-editor-insert-menu__title">Вставить</div>
        {rows.map((row, idx) => {
          if (row.type === "separator") {
            return <div key={`sep-${idx}`} className="script-editor-insert-menu__sep" role="separator" />;
          }
          if (row.type === "submenu") {
            const expanded = openSubmenuRowId === row.id;
            return (
              <button
                key={row.id}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={expanded}
                className="script-editor-insert-menu__item script-editor-insert-menu__item--submenu"
                disabled={row.disabled || row.children.length === 0}
                title={row.title}
                onClick={(e) => {
                  if (row.disabled || row.children.length === 0) return;
                  if (expanded) {
                    setOpenSubmenuRowId(null);
                    setSubmenuAnchor(null);
                  } else {
                    setOpenSubmenuRowId(row.id);
                    setSubmenuAnchor(e.currentTarget.getBoundingClientRect());
                  }
                }}
              >
                <span className="script-editor-insert-menu__item-label">{row.label}</span>
                <span className="script-editor-insert-menu__chevron" aria-hidden>
                  ›
                </span>
              </button>
            );
          }
          return (
            <button
              key={row.id}
              type="button"
              role="menuitem"
              className="script-editor-insert-menu__item"
              disabled={row.disabled || !row.pick}
              title={row.title}
              onClick={() => {
                if (row.disabled || !row.pick) return;
                onPick(row.pick);
                onClose();
              }}
            >
              {row.label}
            </button>
          );
        })}
      </div>

      {openSubmenuRow && openSubmenuRow.type === "submenu" ? (
        <div
          ref={submenuRef}
          className="script-editor-insert-menu script-editor-insert-menu--sub"
          role="menu"
          aria-label={openSubmenuRow.label}
          onClick={(e) => e.stopPropagation()}
        >
          {openSubmenuRow.children.map((ch) => (
            <button
              key={ch.id}
              type="button"
              role="menuitem"
              className="script-editor-insert-menu__item"
              onClick={() => {
                onPick(ch.pick);
                onClose();
              }}
            >
              {ch.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
