import type { ProjectRoleInfo } from "../../../sync/api/projects";
import { RolePlayingCard } from "../../role-card/RolePlayingCard";
import type { DialogueLine } from "../model/dialogue";
import type { DialogueSceneExercise } from "../model/dialogue-scene-types";
import { TrainerContextCard } from "./TrainerContextCard";
import { RoleLinePuzzle } from "./RoleLinePuzzle";

export type DialogueSceneLearningStageProps = {
  accessToken?: string | null;
  lineBeforeActive: DialogueLine | null;
  projectRoles: ProjectRoleInfo[];
  roleInfo: ProjectRoleInfo | null;
  role: string;
  activeExercise: DialogueSceneExercise;
  wordPoolHost: HTMLElement | null;
  onDone: () => void;
  onResetDone: () => void;
};

export function DialogueSceneLearningStage({
  accessToken,
  lineBeforeActive,
  projectRoles,
  roleInfo,
  role,
  activeExercise,
  wordPoolHost,
  onDone,
  onResetDone,
}: DialogueSceneLearningStageProps) {
  const selfRole = roleInfo ?? {
    title: role || activeExercise.role || "Моя роль",
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
          <RoleLinePuzzle
            ex={activeExercise}
            done={false}
            active
            wordPoolHost={wordPoolHost}
            onDone={onDone}
            onResetDone={onResetDone}
          />
        </div>
      </section>
    </div>
  );
}
