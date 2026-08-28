import type { ProjectRoleInfo } from "../../../sync/api/projects";
import { RolePlayingCard } from "../../role-card/RolePlayingCard";
import type { DialogueLine } from "../model/dialogue";
import type { VoiceExercise } from "../model/voice-trainer-types";
import { TrainerContextCard } from "./TrainerContextCard";
import { renderVoiceLineBody } from "./VoiceLineControlsPanel";

export type VoiceDialogueLearningStageProps = {
  accessToken?: string | null;
  lineBeforeActive: DialogueLine | null;
  projectRoles: ProjectRoleInfo[];
  roleInfo: Pick<ProjectRoleInfo, "title" | "avatarKey"> | null;
  role: string;
  current: VoiceExercise;
  activeLineForBody: DialogueLine;
  listening: boolean;
  showText: boolean;
  revealedLineIds: Set<string>;
  transcript: string;
  interim: string;
  result: null | { ratio: number; ok: boolean };
  passRatioPercent: number;
};

export function VoiceDialogueLearningStage({
  accessToken,
  lineBeforeActive,
  projectRoles,
  roleInfo,
  role,
  current,
  activeLineForBody,
  listening,
  showText,
  revealedLineIds,
  transcript,
  interim,
  result,
  passRatioPercent,
}: VoiceDialogueLearningStageProps) {
  const selfRole = roleInfo ?? {
    title: role || current.role || "Моя роль",
    avatarKey: null,
  };

  return (
    <div className="dialogue-learning-stage">
      <aside className="dialogue-context-stack" aria-label="Реплика перед вами">
        <TrainerContextCard
          accessToken={accessToken}
          line={lineBeforeActive}
          projectRoles={projectRoles}
        />
      </aside>

      <section className="dialogue-self-card">
        <div className="dialogue-self-card__identity">
          <RolePlayingCard
            role={selfRole}
            accessToken={accessToken}
            size="md"
            className="dialogue-self-card__portrait"
          />
        </div>

        <div className="dialogue-self-card__exercise">
          <div
            className="dialogue-my-line voice-self-line"
            data-listening={listening ? "true" : "false"}
          >
            <div className="dialogue-my-line-head">
              <div className="dialogue-my-line-role-row">
                <div className="dialogue-my-line-role">{current.role}</div>
                <span className="dialogue-now-badge">Сейчас</span>
              </div>
            </div>
            {renderVoiceLineBody(activeLineForBody, {
              isActive: true,
              isMine: true,
              showText,
              revealedLineIds,
              listening,
              transcript,
              interim,
              result,
              passRatioPercent,
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
