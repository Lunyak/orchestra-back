import { Button } from "@shared/core/button/Button";
import type { StudioDetail } from "../../features/studio";
import {
  studioRoleLabel,
  useRemoveStudioMemberMutation,
  useUpdateStudioMemberMutation,
} from "../../features/studio";
import { PersonSelectPreview } from "../../shared/components/person-select/PersonSelectPreview";
import "./style.css";

type StudioMembersPanelProps = {
  studio: StudioDetail;
};

type InviteRole = "teacher" | "student";

export function StudioMembersPanel({ studio }: StudioMembersPanelProps) {
  const canManage = studio.canManage;
  const [updateMember] = useUpdateStudioMemberMutation();
  const [removeMember] = useRemoveStudioMemberMutation();

  const handleRoleChange = async (memberId: string, role: InviteRole) => {
    await updateMember({
      studioId: studio.id,
      memberId,
      body: { role },
    });
  };

  const handleRemoveMember = async (memberId: string) => {
    await removeMember({ studioId: studio.id, memberId });
  };

  return (
    <div className="studio-panel-section">
      <h2 className="studio-panel-section__title">Участники</h2>

      {studio.members.length === 0 ? (
        <p className="studio-page__hint">Участников пока нет.</p>
      ) : (
        <ul className="studio-member-list">
          {studio.members.map((member) => {
            const isOwner = member.role === "owner";
            const roleSelectValue =
              member.role === "teacher" || member.role === "student"
                ? member.role
                : "student";

            return (
              <li key={member.id} className="studio-member-item">
                <div className="studio-member-item__row">
                  <div className="studio-member-item__person">
                    <PersonSelectPreview
                      person={{
                        email: member.email,
                        profile: {
                          displayName: member.displayName,
                          avatarUrl: member.avatarUrl,
                        },
                      }}
                    />
                    <span className="studio-role-badge">
                      {studioRoleLabel(member.role)}
                    </span>
                  </div>
                  {canManage && !isOwner ? (
                    <div className="studio-member-item__actions">
                      <select
                        className="studio-select"
                        value={roleSelectValue}
                        onChange={(e) =>
                          handleRoleChange(
                            member.id,
                            e.target.value as InviteRole,
                          )
                        }
                      >
                        <option value="teacher">Педагог</option>
                        <option value="student">Студиец</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
