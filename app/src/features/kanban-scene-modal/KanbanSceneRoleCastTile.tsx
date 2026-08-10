import { RolePlayingCard } from "../role-card/RolePlayingCard";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import type { ProjectRoleInfo } from "../../sync/api/projects";
import type { KanbanSceneRolesAdminMember } from "./KanbanSceneRolesAdminPanel";
import { actorDisplay, findAssignmentMember } from "./KanbanSceneCastDisplay";
import "./KanbanSceneCastTile.css";

export type KanbanSceneRoleCastTileProps = {
  roleKey: string;
  roleTitle: string;
  roleInfo: ProjectRoleInfo | null;
  actorEmails: string[];
  members: KanbanSceneRolesAdminMember[];
  accessToken?: string | null;
  onOpenRole: (roleId: string) => void;
  onOpenRolesAdmin?: () => void;
};

export function KanbanSceneRoleCastTile({
  roleKey,
  roleTitle,
  roleInfo,
  actorEmails,
  members,
  accessToken,
  onOpenRole,
  onOpenRolesAdmin,
}: KanbanSceneRoleCastTileProps) {
  const cardRole = roleInfo ?? { title: roleTitle, avatarKey: undefined };
  const actors = (actorEmails ?? [])
    .map((email) => String(email ?? "").trim())
    .filter(Boolean);
  const openRole = () => {
    if (roleInfo?.id) {
      onOpenRole(roleInfo.id);
      return;
    }
    onOpenRolesAdmin?.();
  };

  return (
    <article className="kanban-scene-cast-tile" aria-label={`Роль ${roleTitle}`}>
      <RolePlayingCard
        role={cardRole}
        accessToken={accessToken}
        size="md"
        title={roleTitle}
        onClick={openRole}
      />

      <div className="kanban-scene-cast-tile__cast">
        {actors.length === 0 ? (
          <div className="kanban-scene-cast-tile__empty">Не назначено</div>
        ) : (
          <ul className="kanban-scene-cast-tile__actors">
            {actors.map((email) => {
              const member = findAssignmentMember(members, email);
              const { label, avatarUrl, title } = actorDisplay(member, email);
              return (
                <li key={`${roleKey}:${email}`} className="kanban-scene-cast-tile__actor">
                  <MiniAvatar src={avatarUrl} label={label} size={26} title={title} />
                  <span className="kanban-scene-cast-tile__actor-name" title={title}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {roleInfo == null ? (
        <div className="kanban-scene-cast-tile__warn">
          Роль не заведена в проекте — нажмите карточку, чтобы перейти к ролям.
        </div>
      ) : null}
    </article>
  );
}
