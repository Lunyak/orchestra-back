import type { TeamProfile } from "../../../sync/api/profile";
import { RolePlayingCard } from "../../role-card/RolePlayingCard";
import { actorLabel, type InboundRoleMention } from "../model/roleWorkbookNote";

export type WorkbookInboundMentionsSectionProps = {
  mentions: InboundRoleMention[];
  profilesByEmail: Record<string, TeamProfile | null | undefined>;
  accessToken: string;
  targetRoleTitle: string;
};

export function WorkbookInboundMentionsSection({
  mentions,
  profilesByEmail,
  accessToken,
  targetRoleTitle,
}: WorkbookInboundMentionsSectionProps) {
  return (
    <div className="rolewb-card rolewb-section rolewb-inbound" id="rolewb-section-inbound">
      <div className="rolewb-section-head">
        <span className="rolewb-section-num">★</span>
        <div className="rolewb-card-title">Что обо мне думают другие персонажи</div>
      </div>
      <div className="rolewb-hint">
        Здесь собрано, что другие актёры написали о <b>{targetRoleTitle}</b> в своих тетрадках — в блоке «отношения», когда
        выбрали вашего персонажа. Только просмотр.
      </div>

      {mentions.length === 0 ? (
        <div className="rolewb-hint">Пока никто не описал отношения к этому персонажу в своих ролях.</div>
      ) : (
        <div className="rolewb-inbound-list">
          {mentions.map((m, idx) => {
            const actor = actorLabel(profilesByEmail[m.actorEmail] ?? null, m.actorEmail);
            const when = m.updatedAtIso
              ? new Date(m.updatedAtIso).toLocaleString("ru-RU")
              : null;
            return (
              <div key={`inbound-${m.sourceRoleId}-${m.actorEmail}-${idx}`} className="rolewb-inbound-item">
                <RolePlayingCard
                  role={{ title: m.sourceRoleTitle, avatarKey: m.sourceRoleAvatarKey ?? null }}
                  accessToken={accessToken}
                  size="sm"
                />
                <div className="rolewb-inbound-body">
                  <div className="rolewb-inbound-meta">
                    <span>
                      Персонаж: <b>{m.sourceRoleTitle}</b>
                    </span>
                    <span>
                      Актёр: <b>{actor}</b>
                    </span>
                    {when ? <span style={{ opacity: 0.75 }}>Обновлено: {when}</span> : null}
                  </div>
                  <div className="rolewb-inbound-quote">{m.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
