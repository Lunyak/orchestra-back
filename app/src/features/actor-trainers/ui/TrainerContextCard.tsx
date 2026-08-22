import type { ProjectRoleInfo } from "../../../sync/api/projects";
import { RolePlayingCard } from "../../role-card/RolePlayingCard";
import { findProjectRoleForScriptKey } from "../model/voice-trainer-partner";
import type { DialogueLine } from "../model/dialogue";

export type TrainerContextCardProps = {
  accessToken?: string | null;
  line: DialogueLine | null;
  projectRoles: ProjectRoleInfo[];
  label?: string;
};

export function TrainerContextCard({
  accessToken,
  line,
  projectRoles,
  label = "Реплика перед вами",
}: TrainerContextCardProps) {
  const roleTitle = String(line?.role ?? "Партнёр");
  const roleInfo = findProjectRoleForScriptKey(roleTitle, projectRoles) ?? {
    title: roleTitle,
    avatarKey: null,
  };

  return (
    <section className="dialogue-context-card">
      <div className="dialogue-context-card__body">
        <div className="dialogue-context-card__label">{label}</div>
        <div className="dialogue-context-card__role">{roleTitle}</div>
        <div className="dialogue-context-card__text">
          {line?.text ?? "В сценарии нет реплики перед вами"}
        </div>
      </div>
      <RolePlayingCard
        role={roleInfo}
        accessToken={accessToken}
        size="md"
        className="dialogue-context-card__portrait"
      />
    </section>
  );
}
