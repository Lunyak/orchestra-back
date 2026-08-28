import { KanbanSceneDetailModal } from "../../../features/kanban-scene-modal/KanbanSceneDetailModal";
import { RehearsalPlanSectionChrome } from "../rehearsal-plan/RehearsalPlanSectionChrome";
import { STATUSES } from "./kanban-constants";
import { KanbanBoardColumn } from "./KanbanBoardColumn";
import { KanbanBoardToolbar } from "./KanbanBoardToolbar";
import {
  useKanbanBoardPage,
  type KanbanBoardPageProps,
} from "./useKanbanBoardPage";
import "./style.css";

export type { KanbanBoardPageProps };

export function KanbanBoardPage(props: KanbanBoardPageProps) {
  const vm = useKanbanBoardPage(props);

  return (
    <div className="kanban-page">
      <RehearsalPlanSectionChrome activeTab="board">
        {vm.rolesError ? (
          <div className="kanban-muted kanban-muted--bottom">{vm.rolesError}</div>
        ) : null}

        <KanbanBoardToolbar
          query={vm.query}
          onQueryChange={vm.setQuery}
          roleFilter={vm.roleFilter}
          onRoleFilterChange={vm.setRoleFilter}
          actorFilter={vm.actorFilter}
          onActorFilterChange={vm.setActorFilter}
          onlyUnassigned={vm.onlyUnassigned}
          onOnlyUnassignedChange={vm.setOnlyUnassigned}
          roleFilterOptions={vm.roleFilterOptions}
          allActors={vm.allActors}
          formatActorList={vm.formatActorList}
          onReset={vm.resetFilters}
        />

        <div className="kanban-board" role="region" aria-label="Доска готовности сцен">
          {STATUSES.map((status) => (
            <KanbanBoardColumn
              key={status.id}
              status={status}
              scenes={vm.columns.get(status.id) ?? []}
              draggedId={vm.draggedId}
              sceneRoles={vm.sceneRoles}
              displayRoleTitle={vm.displayRoleTitle}
              noteTextForScene={vm.noteTextForScene}
              isCommentExpanded={vm.isCommentExpanded}
              onCardDragStart={vm.onCardDragStart}
              onCardDragEnd={vm.onCardDragEnd}
              onDropToColumn={vm.onDropToColumn}
              onDropBeforeCard={vm.onDropBeforeCard}
              onOpenScene={vm.openScene}
              onToggleComment={vm.toggleCommentExpanded}
            />
          ))}
        </div>

        {vm.openedScene ? (
          <KanbanSceneDetailModal
            scene={vm.openedScene}
            onClose={vm.closeScene}
            setSceneStatus={vm.setSceneStatus}
            setSceneDurationMin={vm.setSceneDurationMin}
            rolesLoading={vm.rolesLoading}
            openedRoles={vm.openedRoles}
            getRoleActors={vm.getRoleActors}
            displayRoleTitle={vm.displayRoleTitle}
            resolveRoleInfo={vm.resolveRoleInfo}
            projectName={vm.projectName}
            projectRoles={vm.projectRoles}
            roleAssignmentMembers={vm.roleAssignmentMembers}
          />
        ) : null}
      </RehearsalPlanSectionChrome>
    </div>
  );
}
