import React, { useEffect, useState } from "react";
import { useProject } from "../../../../features/project";
import type { ScriptRequisite } from "../../../types/script";

export function RequisitesPanel({
  show,
  isEditing,
  requisites,
  hasCopiedRequisites,
  newRequisite,
  setNewRequisite,
  onCopy,
  onPaste,
  onResetAll,
  onAdd,
  onToggle,
  onRemove,
}: {
  show: boolean;
  isEditing: boolean;
  requisites: ScriptRequisite[];
  hasCopiedRequisites: boolean;
  newRequisite: string;
  setNewRequisite: React.Dispatch<React.SetStateAction<string>>;
  onCopy: () => void;
  onPaste: () => void;
  onResetAll: () => void;
  onAdd: () => void;
  onToggle: (requisiteId: number) => void;
  onRemove: (requisiteId: number) => void;
}) {
  if (!show) return null;

  const { projectName } = useProject();
  const collapseKey = `requisitesPanel:collapsed:${projectName || "unknown"}`;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return (typeof window !== "undefined" ? localStorage.getItem(collapseKey) : null) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(collapseKey, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapseKey, collapsed]);

  return (
    <aside className="requisites-panel" data-collapsed={collapsed ? "true" : "false"}>
      <div className="requisites-header">
        <div className="requisites-header-left">
          <span>Реквизит</span>
          <span className="requisites-count">{requisites.length}</span>
        </div>
        <button
          type="button"
          className="requisites-toggle"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Развернуть панель реквизита" : "Свернуть панель реквизита"}
          aria-label={collapsed ? "Развернуть панель реквизита" : "Свернуть панель реквизита"}
        >
          {collapsed ? "⟩" : "⟨"}
        </button>
        <div className="requisites-actions">
          <button
            type="button"
            className="requisites-action-btn"
            onClick={onCopy}
            disabled={requisites.length === 0}
            title="Скопировать реквизит"
          >
            С
          </button>

          <button
            type="button"
            className="requisites-action-btn"
            onClick={onPaste}
            disabled={!hasCopiedRequisites}
            title="Вставить реквизит"
          >
            P
          </button>
          <button
            type="button"
            className="requisites-action-btn"
            onClick={onResetAll}
            disabled={requisites.length === 0}
            title="Сбросить отметки на всех шагах"
          >
            D
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="requisites-add">
          <input
            type="text"
            value={newRequisite}
            onChange={(event) => setNewRequisite(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAdd();
              }
            }}
            placeholder="Добавить реквизит"
          />
          <button type="button" onClick={onAdd}>
            +
          </button>
        </div>
      ) : null}

      <div className="requisites-list">
        {requisites.length === 0 ? (
          <div className="requisites-empty">Нет реквизита</div>
        ) : (
          requisites.map((item) => (
            <label key={item.id} className="requisite-item">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => onToggle(item.id)}
              />
              <span>{item.label}</span>
              {isEditing ? (
                <button
                  type="button"
                  className="requisite-remove"
                  onClick={() => onRemove(item.id)}
                >
                  ×
                </button>
              ) : null}
            </label>
          ))
        )}
      </div>
    </aside>
  );
}

