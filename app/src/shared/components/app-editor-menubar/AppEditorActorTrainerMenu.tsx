import cn from "classnames";
import type { ActorTrainerMode } from "../../../features/actor-trainers/model/actorTrainerUiSlice";
import "../../../features/spectacle/ui/spectacle-direction-switch.css";

const ACTOR_TRAINER_MODE_ITEMS: ReadonlyArray<{
  mode: ActorTrainerMode;
  label: string;
}> = [
  { mode: "dialogue", label: "Диалог" },
  { mode: "write", label: "Напиши фразу" },
  { mode: "voice", label: "Аудио" },
];

export type AppEditorActorTrainerMenuProps = {
  trainerMode: ActorTrainerMode;
  onSetTrainerMode: (mode: ActorTrainerMode) => void;
};

export function AppEditorActorTrainerMenu({
  trainerMode,
  onSetTrainerMode,
}: AppEditorActorTrainerMenuProps) {
  return (
    <nav className="spectacle-direction-switch" aria-label="Режим тренировки">
      <ul className="spectacle-direction-switch__modes">
        {ACTOR_TRAINER_MODE_ITEMS.map(({ mode, label }) => {
          const isActive = trainerMode === mode;
          return (
            <li key={mode}>
              <button
                type="button"
                className={cn(
                  "spectacle-direction-switch__item",
                  isActive && "spectacle-direction-switch__item--active",
                )}
                aria-pressed={isActive}
                onClick={() => onSetTrainerMode(mode)}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
