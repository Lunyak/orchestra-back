import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useState } from "react";
import type { StudioDetail } from "../../features/studio";
import {
  studioRoleLabel,
  useAddStudioMemberMutation,
  useCreateStudioInviteMutation,
  useListStudioInvitesQuery,
  useRevokeStudioInviteMutation,
} from "../../features/studio";
import "./style.css";

dayjs.locale("ru");

type StudioInvitePanelProps = {
  studio: StudioDetail;
};

type InviteRole = "teacher" | "student";

export function StudioInvitePanel({ studio }: StudioInvitePanelProps) {
  const { data: invites = [] } = useListStudioInvitesQuery(studio.id);

  const [addMember, { isLoading: addingMember }] = useAddStudioMemberMutation();
  const [createInvite, { isLoading: creatingInvite }] =
    useCreateStudioInviteMutation();
  const [revokeInvite] = useRevokeStudioInviteMutation();

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<InviteRole>("student");
  const [inviteRole, setInviteRole] = useState<InviteRole>("student");
  const [inviteEmail, setInviteEmail] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddMember = async () => {
    setFormError(null);
    const email = memberEmail.trim().toLowerCase();
    if (!email) {
      setFormError("Укажите email");
      return;
    }

    try {
      await addMember({
        studioId: studio.id,
        body: { email, role: memberRole },
      }).unwrap();
      setMemberEmail("");
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Не удалось добавить участника",
      );
    }
  };

  const handleCreateInvite = async () => {
    setFormError(null);
    try {
      const result = await createInvite({
        studioId: studio.id,
        body: {
          role: inviteRole,
          email: inviteEmail.trim() || undefined,
        },
      }).unwrap();
      const inviteUrl = `${window.location.origin}${result.invitePath}`;
      setLastInviteUrl(inviteUrl);
      setInviteEmail("");
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Не удалось создать приглашение",
      );
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!lastInviteUrl) return;
    try {
      await navigator.clipboard.writeText(lastInviteUrl);
      setCopyStatus("Скопировано");
    } catch {
      setCopyStatus("Не удалось скопировать");
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    await revokeInvite({ studioId: studio.id, inviteId });
  };

  return (
    <div className="studio-panel-section">
      <h2 className="studio-panel-section__title">Приглашение</h2>
      {formError ? <p className="studio-page__error">{formError}</p> : null}

      <div className="studio-form-section studio-form-section--flush">
        <h3 className="studio-form-section__title">Добавить по email</h3>
        <FormInlineRow className="studio-form-row">
          <InlineTextField
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            placeholder="Email"
          />
        </FormInlineRow>
        <FormInlineRow className="studio-form-row">
          <label>
            Роль{" "}
            <select
              className="studio-select"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as InviteRole)}
            >
              <option value="teacher">Педагог</option>
              <option value="student">Студиец</option>
            </select>
          </label>
        </FormInlineRow>
        <div className="studio-actions">
          <Button
            type="button"
            onClick={handleAddMember}
            disabled={addingMember}
          >
            {addingMember ? "Добавление…" : "Добавить"}
          </Button>
        </div>
      </div>

      <div className="studio-form-section">
        <h3 className="studio-form-section__title">Приглашение по ссылке</h3>
        <FormInlineRow className="studio-form-row">
          <label>
            Роль{" "}
            <select
              className="studio-select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as InviteRole)}
            >
              <option value="teacher">Педагог</option>
              <option value="student">Студиец</option>
            </select>
          </label>
        </FormInlineRow>
        <FormInlineRow className="studio-form-row">
          <InlineTextField
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email (необязательно)"
          />
        </FormInlineRow>
        <div className="studio-actions">
          <Button
            type="button"
            onClick={handleCreateInvite}
            disabled={creatingInvite}
          >
            {creatingInvite ? "Создание…" : "Создать ссылку"}
          </Button>
        </div>
        {lastInviteUrl ? (
          <div className="studio-invite-url">
            <span>{lastInviteUrl}</span>
            <Button type="button" variant="ghost" onClick={handleCopyInviteUrl}>
              Копировать
            </Button>
            {copyStatus ? <span>{copyStatus}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="studio-form-section">
        <h3 className="studio-form-section__title">Активные приглашения</h3>
        {invites.length === 0 ? (
          <p className="studio-page__hint">Активных приглашений нет.</p>
        ) : (
          <ul className="studio-invite-list">
            {invites.map((invite) => (
              <li key={invite.id} className="studio-invite-item">
                <div className="studio-invite-item__row">
                  <div>
                    <div>{studioRoleLabel(invite.role)}</div>
                    <div className="studio-invite-item__meta">
                      {invite.email ?? "Любой email"}
                      {invite.expiresAt
                        ? ` · до ${dayjs(invite.expiresAt).format("D MMM YYYY")}`
                        : ""}
                    </div>
                  </div>
                  <div className="studio-invite-item__actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleRevokeInvite(invite.id)}
                    >
                      Отозвать
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
