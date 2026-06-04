import type { ActorTrainerMode } from "../../../features/actor-trainers/model/actorTrainerUiSlice";

const ACTOR_TRAINER_MODE_ITEMS: ReadonlyArray<{
  mode: ActorTrainerMode;
  label: string;
}> = [
  { mode: "dialogue", label: "Диалог" },
  { mode: "write", label: "Напиши фразу" },
  { mode: "voice", label: "АУДИО" },
];

export type AppEditorActorTrainerMenuProps = {
  trainerMode: ActorTrainerMode;
  onSetTrainerMode: (mode: ActorTrainerMode) => void;
};

export function AppEditorActorTrainerMenu({
  trainerMode,
  onSetTrainerMode,
}: AppEditorActorTrainerMenuProps) {
  const activeLabel =
    ACTOR_TRAINER_MODE_ITEMS.find((item) => item.mode === trainerMode)?.label ?? "Диалог";

  return (
    <div className="theater-editor-menubar__menu">
      <span className="theater-editor-menubar__menu-title">{activeLabel}</span>
      <div className="theater-editor-menubar__options" role="menu" aria-label="Режим тренировки">
        {ACTOR_TRAINER_MODE_ITEMS.map(({ mode, label }) => {
          const isActive = trainerMode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="menuitemradio"
              aria-checked={isActive}
              className={[
                "theater-editor-menubar__option",
                isActive ? "theater-editor-menubar__option--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSetTrainerMode(mode)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
