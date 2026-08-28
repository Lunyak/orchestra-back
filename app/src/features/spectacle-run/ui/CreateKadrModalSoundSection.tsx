import cn from "classnames";
import {
  CustomSelect,
  type CustomSelectOption,
} from "../../../shared/core/custom-select/CustomSelect";

type CreateKadrModalSoundSectionProps = {
  playTrackId: number | null;
  playlistLength: number;
  playlistOptions: CustomSelectOption[];
  sounds: Array<{ id: number; title: string }>;
  soundIds: number[];
  onPlayTrackChange: (value: string) => void;
  onToggleSound: (soundId: number) => void;
};

export function CreateKadrModalSoundSection({
  playTrackId,
  playlistLength,
  playlistOptions,
  sounds,
  soundIds,
  onPlayTrackChange,
  onToggleSound,
}: CreateKadrModalSoundSectionProps) {
  return (
    <section className="create-kadr-modal__section">
      <h3 className="create-kadr-modal__section-title">Звук</h3>
      <label className="create-kadr-modal__field">
        <span className="create-kadr-modal__label">Музыка из плейлиста</span>
        <CustomSelect
          value={playTrackId != null ? String(playTrackId) : ""}
          options={playlistOptions}
          onChange={onPlayTrackChange}
          searchable={playlistLength > 6}
          className="create-kadr-modal__select"
          aria-label="Музыка из плейлиста"
        />
      </label>
      {sounds.length > 0 ? (
        <div className="create-kadr-modal__checks">
          <span className="create-kadr-modal__label">Звуковые эффекты</span>
          <div className="create-kadr-modal__check-grid">
            {sounds.map((sound) => {
              const checked = soundIds.includes(sound.id);
              return (
                <label
                  key={sound.id}
                  className={cn(
                    "create-kadr-modal__check",
                    checked && "create-kadr-modal__check--active",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleSound(sound.id)}
                  />
                  <span>{sound.title?.trim() || `SFX ${sound.id}`}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
