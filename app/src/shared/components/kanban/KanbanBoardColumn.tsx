import cn from "classnames";
import type { DragEvent } from "react";
import type { ScriptScene } from "../../types/script";
import { KanbanBoardCard } from "./KanbanBoardCard";
import type { KanbanStatus, KanbanStatusConfig } from "./kanban-constants";

type KanbanBoardColumnProps = {
  status: KanbanStatusConfig;
  scenes: ScriptScene[];
  draggedId: number | null;
  sceneRoles: (scene: ScriptScene) => string[];
  displayRoleTitle: (role: string) => string;
  noteTextForScene: (sceneId: number) => string;
  isCommentExpanded: (sceneId: number) => boolean;
  onCardDragStart: (ev: DragEvent, id: number) => void;
  onCardDragEnd: () => void;
  onDropToColumn: (ev: DragEvent, toStatus: KanbanStatus) => void;
  onDropBeforeCard: (
    ev: DragEvent,
    toStatus: KanbanStatus,
    beforeId: number,
  ) => void;
  onOpenScene: (id: number) => void;
  onToggleComment: (id: number) => void;
};

export function KanbanBoardColumn({
  status,
  scenes,
  draggedId,
  sceneRoles,
  displayRoleTitle,
  noteTextForScene,
  isCommentExpanded,
  onCardDragStart,
  onCardDragEnd,
  onDropToColumn,
  onDropBeforeCard,
  onOpenScene,
  onToggleComment,
}: KanbanBoardColumnProps) {
  return (
    <section
      className={cn("kanban-col", status.statusClass)}
      onDragOver={(ev) => ev.preventDefault()}
      onDrop={(ev) => onDropToColumn(ev, status.id)}
      aria-label={status.label}
    >
      <div className="kanban-col-head">
        <div className="kanban-col-title-row">
          <h3 className="kanban-col-title">{status.label}</h3>
          <span className="kanban-col-count">{scenes.length}</span>
        </div>
        <div className="kanban-col-hint">{status.hint}</div>
      </div>

      <div className="kanban-col-body">
        {scenes.map((scene) => (
          <KanbanBoardCard
            key={scene.id}
            scene={scene}
            status={status}
            isDragging={draggedId === scene.id}
            roles={sceneRoles(scene)}
            displayRoleTitle={displayRoleTitle}
            noteText={noteTextForScene(scene.id)}
            isCommentExpanded={isCommentExpanded(scene.id)}
            onDragStart={onCardDragStart}
            onDragEnd={onCardDragEnd}
            onDropBefore={(ev, beforeId) =>
              onDropBeforeCard(ev, status.id, beforeId)
            }
            onOpen={onOpenScene}
            onToggleComment={onToggleComment}
          />
        ))}
      </div>
    </section>
  );
}
