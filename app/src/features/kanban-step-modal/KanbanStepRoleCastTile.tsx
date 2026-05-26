import { RolePlayingCard } from "../role-card/RolePlayingCard";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import type { ProjectRoleInfo } from "../../sync/api/projects";
import type { KanbanStepRolesAdminMember } from "./KanbanStepRolesAdminPanel";
import { actorDisplay, findAssignmentMember } from "./kanbanStepCastDisplay";

export type KanbanStepRoleCastTileProps = {
  roleKey: string;
  roleTitle: string;
  roleInfo: ProjectRoleInfo | null;
  actorEmails: string[];
  members: KanbanStepRolesAdminMember[];
  accessToken?: string | null;
  onOpenRole: (roleId: string) => void;
  onOpenRolesAdmin: () => void;
};

export function KanbanStepRoleCastTile({
  roleKey,
  roleTitle,
  roleInfo,
  actorEmails,
  members,
  accessToken,
  onOpenRole,
  onOpenRolesAdmin,
}: KanbanStepRoleCastTileProps) {
  const cardRole = roleInfo ?? { title: roleTitle, avatarKey: undefined };
  const actors = (actorEmails ?? [])
    .map((email) => String(email ?? "").trim())
    .filter(Boolean);
  const openRole = () => {
    if (roleInfo?.id) {
      onOpenRole(roleInfo.id);
      return;
    }
    onOpenRolesAdmin();
  };

  return (
    <article className="kanban-step-cast-tile" aria-label={`Роль ${roleTitle}`}>
      <RolePlayingCard
        role={cardRole}
        accessToken={accessToken}
        size="md"
        title={roleTitle}
        onClick={openRole}
      />

      <div className="kanban-step-cast-tile__cast">
        {actors.length === 0 ? (
          <div className="kanban-step-cast-tile__empty">Не назначено</div>
        ) : (
          <ul className="kanban-step-cast-tile__actors">
            {actors.map((email) => {
              const member = findAssignmentMember(members, email);
              const { label, avatarUrl, title } = actorDisplay(member, email);
              return (
                <li key={`${roleKey}:${email}`} className="kanban-step-cast-tile__actor">
                  <MiniAvatar src={avatarUrl} label={label} size={26} title={title} />
                  <span className="kanban-step-cast-tile__actor-name" title={title}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {roleInfo == null ? (
        <div className="kanban-step-cast-tile__warn">
          Роль не заведена в проекте — нажмите карточку, чтобы перейти к ролям.
        </div>
      ) : null}
    </article>
  );
}
