import React from "react";
import type { ScriptRequisite } from "../../../types/script";

type RequisiteAssigneeField = "setupAssignees" | "removeAssignees";

type RequisiteAssigneeOption = {
  value: string;
  label: string;
};

function assigneesToInputValue(values: string[] | undefined): string {
  return (values ?? []).join(", ");
}

function inputValueToAssignees(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function RequisitesPanel({
  show,
  isEditing,
  requisites,
  assigneeOptions = [],
  hasCopiedRequisites,
  newRequisite,
  setNewRequisite,
  onCopy,
  onPaste,
  onResetAll,
  onAdd,
  onToggle,
  onRemove,
  onAssigneesChange,
}: {
  show: boolean;
  isEditing: boolean;
  requisites: ScriptRequisite[];
  assigneeOptions?: RequisiteAssigneeOption[];
  hasCopiedRequisites: boolean;
  newRequisite: string;
  setNewRequisite: React.Dispatch<React.SetStateAction<string>>;
  onCopy: () => void;
  onPaste: () => void;
  onResetAll: () => void;
  onAdd: () => void;
  onToggle: (requisiteId: number) => void;
  onRemove: (requisiteId: number) => void;
  onAssigneesChange: (
    requisiteId: number,
    field: RequisiteAssigneeField,
    assignees: string[],
  ) => void;
}) {
  const assigneeListId = React.useId();

  if (!show) return null;

  return (
    <section className="requisites-panel">
      <div className="requisites-header">
        <div className="requisites-header-left">
          <span>Реквизит</span>
          <span className="requisites-count">{requisites.length}</span>
        </div>
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
            <div key={item.id} className="requisite-item">
              <label className="requisite-item-main">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => onToggle(item.id)}
                />
                <span>{item.label}</span>
              </label>
              {isEditing ? (
                <button
                  type="button"
                  className="requisite-remove"
                  onClick={() => onRemove(item.id)}
                >
                  ×
                </button>
              ) : null}
              <div className="requisite-assignees">
                <label className="requisite-assignee-field">
                  <span>Выставить</span>
                  <input
                    type="text"
                    list={assigneeListId}
                    value={assigneesToInputValue(item.setupAssignees)}
                    placeholder="Кто выставляет"
                    onChange={(event) =>
                      onAssigneesChange(
                        item.id,
                        "setupAssignees",
                        inputValueToAssignees(event.target.value),
                      )
                    }
                  />
                </label>
                <label className="requisite-assignee-field">
                  <span>Унести</span>
                  <input
                    type="text"
                    list={assigneeListId}
                    value={assigneesToInputValue(item.removeAssignees)}
                    placeholder="Кто уносит"
                    onChange={(event) =>
                      onAssigneesChange(
                        item.id,
                        "removeAssignees",
                        inputValueToAssignees(event.target.value),
                      )
                    }
                  />
                </label>
              </div>
            </div>
          ))
        )}
      </div>
      {assigneeOptions.length > 0 ? (
        <datalist id={assigneeListId}>
          {assigneeOptions.map((option) => (
            <option key={option.value} value={option.value} label={option.label} />
          ))}
        </datalist>
      ) : null}
    </section>
  );
}

