import cn from "classnames";
import type { DragEvent } from "react";
import type { ScriptScene } from "../../types/script";
import type { KanbanStatusConfig } from "./kanban-constants";

type KanbanBoardCardProps = {
  scene: ScriptScene;
  status: KanbanStatusConfig;
  isDragging: boolean;
  roles: string[];
  displayRoleTitle: (role: string) => string;
  noteText: string;
  isCommentExpanded: boolean;
  onDragStart: (ev: DragEvent, id: number) => void;
  onDragEnd: () => void;
  onDropBefore: (ev: DragEvent, beforeId: number) => void;
  onOpen: (id: number) => void;
  onToggleComment: (id: number) => void;
};

export function KanbanBoardCard({
  scene,
  status,
  isDragging,
  roles,
  displayRoleTitle,
  noteText,
  isCommentExpanded,
  onDragStart,
  onDragEnd,
  onDropBefore,
  onOpen,
  onToggleComment,
}: KanbanBoardCardProps) {
  const hasDuration =
    typeof scene.durationMin === "number" &&
    Number.isFinite(scene.durationMin) &&
    scene.durationMin > 0;
  const visibleRoles = roles.slice(0, 6);
  const hiddenRolesCount = roles.length > 6 ? roles.length - 6 : 0;
  const commentToggleLabel = isCommentExpanded
    ? "Свернуть комментарий"
    : "Открыть комментарий";

  return (
    <div
      className={cn(
        "kanban-card",
        status.statusClass,
        isDragging && "kanban-card--dragging",
      )}
      draggable
      onDragStart={(ev) => onDragStart(ev, scene.id)}
      onDragEnd={onDragEnd}
      onDragOver={(ev) => ev.preventDefault()}
      onDrop={(ev) => onDropBefore(ev, scene.id)}
      onClick={() => onOpen(scene.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") onOpen(scene.id);
      }}
      aria-label={`Сцена: ${scene.title}`}
    >
      <span className="kanban-card-meta">
        {hasDuration ? (
          <span className="kanban-card-duration">{scene.durationMin} мин</span>
        ) : null}
        <span className="kanban-card-id">#{scene.id}</span>
      </span>
      <div className="kanban-card-title">{scene.title}</div>
      {roles.length > 0 ? (
        <div className="kanban-card-roles" aria-label="Роли в сцене">
          {visibleRoles.map((role) => (
            <span key={role} className="kanban-chip">
              {displayRoleTitle(role)}
            </span>
          ))}
          {hiddenRolesCount > 0 ? (
            <span className="kanban-chip more">+{hiddenRolesCount}</span>
          ) : null}
        </div>
      ) : null}
      {noteText && isCommentExpanded ? (
        <div
          className="kanban-card-note"
          data-expanded="true"
          onClick={(ev) => ev.stopPropagation()}
        >
          <div className="kanban-card-note__full">{noteText}</div>
        </div>
      ) : null}
      {noteText ? (
        <button
          type="button"
          className="kanban-card-note__toggle"
          aria-label={commentToggleLabel}
          aria-expanded={isCommentExpanded}
          onClick={(ev) => {
            ev.stopPropagation();
            onToggleComment(scene.id);
          }}
          onKeyDown={(ev) => ev.stopPropagation()}
        >
          <span aria-hidden="true">▾</span>
        </button>
      ) : null}
    </div>
  );
}
