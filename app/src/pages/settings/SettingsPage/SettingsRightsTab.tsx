import { Buttons } from "@shared/components/buttons/Buttons";
import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../features/auth";
import { useTeam } from "../../../features/team";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { getProfilesBatch, type TeamProfile } from "../../../sync/api/profile";

export function SettingsRightsTab() {
  const { accessToken } = useAuth();
  const {
    projectMembers,
    projectOwner,
    isProjectOwner,
    canManageProjectMembers,
    inviteEmail,
    setInviteEmail,
    inviteError,
    setInviteError,
    invite,
    updateMemberRole,
    removeMember,
    transferOwnership,
  } = useTeam();

  const [transferUserId, setTransferUserId] = useState("");
  const [profileByEmail, setProfileByEmail] = useState<
    Map<string, TeamProfile>
  >(() => new Map());

  const memberEmails = useMemo(() => {
    const out: string[] = [];
    if (projectOwner?.email)
      out.push(String(projectOwner.email).trim().toLowerCase());
    for (const m of projectMembers ?? []) {
      const em = String(m?.user?.email ?? "")
        .trim()
        .toLowerCase();
      if (em) out.push(em);
    }
    return Array.from(new Set(out)).filter(Boolean);
  }, [projectMembers, projectOwner?.email]);

  useEffect(() => {
    if (!accessToken || memberEmails.length === 0) {
      setProfileByEmail(new Map());
      return;
    }
    let cancelled = false;
    getProfilesBatch(accessToken, memberEmails)
      .then((list) => {
        if (cancelled) return;
        const map = new Map<string, TeamProfile>();
        for (const p of list ?? []) {
          const em = String(p?.email ?? "")
            .trim()
            .toLowerCase();
          if (!em) continue;
          map.set(em, p);
        }
        setProfileByEmail(map);
      })
      .catch(() => {
        if (!cancelled) setProfileByEmail(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, memberEmails.join("|")]);

  return (
    <div className="settings-tab-page">
      <section className="settings-card settings-invite">
        {canManageProjectMembers === false ? (
          <p className="settings-invite-forbidden">
            Управлять участниками могут владелец и администраторы пространства.
          </p>
        ) : (
          <>
            <h3 className="settings-card__title settings-privet-title">
              Права участников в проекте
            </h3>
            {projectOwner ? (
              <p className="settings-sync-hint">
                Владелец проекта:{" "}
                {projectOwner.displayName
                  ? `${projectOwner.displayName} (${projectOwner.email})`
                  : projectOwner.email}
              </p>
            ) : null}
            {isProjectOwner === true && projectMembers.length > 0 ? (
              <div className="settings-invite-row">
                <select
                  className="settings-invite-input"
                  value={transferUserId}
                  onChange={(event) => setTransferUserId(event.target.value)}
                  aria-label="Новый владелец"
                >
                  <option value="">Передать владение…</option>
                  {projectMembers.map((member) => (
                    <option key={member.id} value={member.user.id}>
                      {member.user.displayName
                        ? `${member.user.displayName} (${member.user.email})`
                        : member.user.email}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={() => {
                    void transferOwnership(transferUserId);
                  }}
                  disabled={!transferUserId}
                >
                  Передать
                </Button>
              </div>
            ) : null}
            <div className="settings-invite-row">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError(null);
                }}
                placeholder="email@example.com"
                className="settings-invite-input"
              />
              <Button
                type="button"
                className="primary"
                onClick={invite}
                disabled={!inviteEmail.trim()}
              >
                Пригласить
              </Button>
            </div>
            {inviteError && (
              <div className="settings-invite-error">{inviteError}</div>
            )}
            {projectMembers.length > 0 && (
              <div className="settings-members">
                <ul className="settings-members-list">
                  {projectMembers.map((m) => (
                    <li key={m.id} className="settings-member-row">
                      <span className="settings-member-email">
                        {(() => {
                          const email = String(m.user.email ?? "")
                            .trim()
                            .toLowerCase();
                          const prof = email ? profileByEmail.get(email) : null;
                          const label = m.user.displayName
                            ? `${m.user.displayName} (${m.user.email})`
                            : m.user.email;
                          return (
                            <span className="settings-member-email__inner">
                              <MiniAvatar
                                src={
                                  String(prof?.avatarUrl ?? "").trim() || null
                                }
                                label={label}
                                size={20}
                              />
                              <span>{label}</span>
                            </span>
                          );
                        })()}
                      </span>
                      <div className="settings-member-actions">
                        <LabeledCheckbox
                          className="settings-member-role"
                          checked={m.role === "editor"}
                          onChange={(checked) =>
                            updateMemberRole(
                              m.id,
                              checked ? "editor" : "viewer",
                            )
                          }
                        >
                          {m.role === "editor"
                            ? "Редактирование"
                            : "Только просмотр"}
                        </LabeledCheckbox>
                        <Buttons.DeleteButton
                          type="button"
                          className="settings-member-remove"
                          onClick={() => removeMember(m.id)}
                        ></Buttons.DeleteButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
