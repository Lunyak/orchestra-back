import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import { MiniAvatar } from "@shared/core/mini-avatar/MiniAvatar";
import type { TeamProfile } from "../../../sync/api/profile";
import type {
  PremiseMemberItem,
  PremiseMemberRole,
} from "../../../sync/api/premises";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import {
  normalizeMemberEmail,
  resolvePremiseMemberLabel,
} from "../model/premise-detail-helpers";
import { roleOptions } from "../model/premise-detail-options";

export type PremiseDetailMembersTabProps = {
  premiseId: string;
  members: PremiseMemberItem[];
  memberProfileByEmail: Map<string, TeamProfile>;
  memberEmail: string;
  memberRole: PremiseMemberRole;
  memberCanBook: boolean;
  memberError: string | null;
  addingMember: boolean;
  onMemberEmailChange: (value: string) => void;
  onMemberRoleChange: (value: PremiseMemberRole) => void;
  onMemberCanBookChange: (value: boolean) => void;
  onAddMember: () => void;
  onUpdateMember: (args: {
    premiseId: string;
    memberId: string;
    body: { role?: PremiseMemberRole; canBook?: boolean };
  }) => void;
  onRemoveMember: (args: { premiseId: string; memberId: string }) => void;
};

export function PremiseDetailMembersTab({
  premiseId,
  members,
  memberProfileByEmail,
  memberEmail,
  memberRole,
  memberCanBook,
  memberError,
  addingMember,
  onMemberEmailChange,
  onMemberRoleChange,
  onMemberCanBookChange,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
}: PremiseDetailMembersTabProps) {
  return (
    <RehearsalsCard fluid className="premises-members-card">
      <div className="rehearsals-card-title">Участники помещения</div>
      <p className="rehearsals-muted">
        Добавляйте арендаторов и назначайте права на бронирование.
      </p>
      <FormInlineRow className="premises-form-row premises-members-form">
        <InlineTextField
          value={memberEmail}
          onChange={(e) => onMemberEmailChange(e.target.value)}
          placeholder="email@example.com"
          inputMode="email"
          autoComplete="email"
          aria-label="Email участника"
        />
        <CustomSelect
          value={memberRole}
          options={roleOptions}
          onChange={(value) => onMemberRoleChange(value as PremiseMemberRole)}
          aria-label="Роль"
        />
        <LabeledCheckbox
          className="premises-members-can-book"
          checked={memberCanBook}
          onChange={onMemberCanBookChange}
        >
          Может бронировать
        </LabeledCheckbox>
        <Button
          type="button"
          disabled={addingMember || !memberEmail.trim()}
          onClick={() => void onAddMember()}
        >
          {addingMember ? "…" : "Добавить"}
        </Button>
      </FormInlineRow>
      {memberError ? (
        <div className="rehearsals-error">{memberError}</div>
      ) : null}

      <ul className="premises-members-list">
        {members.map((member) => {
          const normalizedEmail = normalizeMemberEmail(member.email);
          const profile = memberProfileByEmail.get(normalizedEmail);
          const { name, secondary } = resolvePremiseMemberLabel(
            member.email,
            profile,
          );
          const avatarUrl = String(profile?.avatarUrl ?? "").trim() || null;
          const removeLabel = secondary
            ? `${name} (${member.email})`
            : member.email;

          return (
            <li key={member.id} className="premises-member-item">
              <div className="premises-member-item__person">
                <MiniAvatar src={avatarUrl} label={name} size={32} />
                <div className="premises-member-item__meta">
                  <span className="premises-member-item__name">{name}</span>
                  {secondary ? (
                    <span className="premises-member-item__email">
                      {secondary}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="premises-member-item__actions">
                <CustomSelect
                  value={member.role}
                  options={roleOptions}
                  onChange={(value) =>
                    void onUpdateMember({
                      premiseId,
                      memberId: member.id,
                      body: { role: value as PremiseMemberRole },
                    })
                  }
                  aria-label={`Роль ${member.email}`}
                />
                <LabeledCheckbox
                  className="premises-members-can-book"
                  checked={member.canBook}
                  onChange={(checked) =>
                    void onUpdateMember({
                      premiseId,
                      memberId: member.id,
                      body: { canBook: checked },
                    })
                  }
                >
                  Может бронировать
                </LabeledCheckbox>
                <Button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (!confirm(`Удалить ${removeLabel}?`)) return;
                    void onRemoveMember({
                      premiseId,
                      memberId: member.id,
                    });
                  }}
                >
                  Удалить
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </RehearsalsCard>
  );
}
