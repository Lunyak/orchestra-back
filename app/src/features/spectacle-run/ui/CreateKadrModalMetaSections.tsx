import cn from "classnames";

type CreateKadrModalMetaSectionsProps = {
  commentText: string;
  transitionText: string;
  blackoutDurationSec: number | null;
  smokeDurationSec: number | null;
  onCommentChange: (value: string) => void;
  onTransitionChange: (value: string) => void;
  onToggleBlackoutDuration: () => void;
  onToggleSmokeDuration: () => void;
  onBlackoutDurationChange: (raw: string) => void;
  onSmokeDurationChange: (raw: string) => void;
};

export function CreateKadrModalMetaSections({
  commentText,
  transitionText,
  blackoutDurationSec,
  smokeDurationSec,
  onCommentChange,
  onTransitionChange,
  onToggleBlackoutDuration,
  onToggleSmokeDuration,
  onBlackoutDurationChange,
  onSmokeDurationChange,
}: CreateKadrModalMetaSectionsProps) {
  const blackoutLabelActive = blackoutDurationSec != null;
  const smokeLabelActive = smokeDurationSec != null;

  return (
    <>
      <section className="create-kadr-modal__section">
        <h3 className="create-kadr-modal__section-title">Комментарий</h3>
        <p className="create-kadr-modal__hint">Показывается на карточке в прогоне.</p>
        <label className="create-kadr-modal__field">
          <span className="create-kadr-modal__label">Текст комментария</span>
          <textarea
            className="create-kadr-modal__textarea"
            value={commentText}
            placeholder="Например: дождаться аплодисментов, затем блекаут"
            rows={3}
            onChange={(e) => onCommentChange(e.target.value)}
          />
        </label>
      </section>

      <section className="create-kadr-modal__section">
        <h3 className="create-kadr-modal__section-title">Переход</h3>
        <p className="create-kadr-modal__hint">
          Показывается внизу в прогоне при навигации, не на карточке.
        </p>
        <label className="create-kadr-modal__field">
          <span className="create-kadr-modal__label">Текст перехода</span>
          <input
            type="text"
            className="create-kadr-modal__input"
            value={transitionText}
            placeholder="Например: пауза 3 сек, затем следующая картина"
            onChange={(e) => onTransitionChange(e.target.value)}
          />
        </label>
      </section>

      <section className="create-kadr-modal__section">
        <h3 className="create-kadr-modal__section-title">Метки на карточке</h3>
        <p className="create-kadr-modal__hint">
          Отображаются в правом верхнем углу карточки в прогоне.
        </p>
        <div className="create-kadr-modal__label-rows">
          <div className="create-kadr-modal__label-row">
            <label
              className={cn(
                "create-kadr-modal__check",
                blackoutLabelActive && "create-kadr-modal__check--active",
              )}
            >
              <input
                type="checkbox"
                checked={blackoutLabelActive}
                onChange={onToggleBlackoutDuration}
              />
              <span>Блекаут</span>
            </label>
            <label className="create-kadr-modal__duration-field">
              <input
                type="number"
                className="create-kadr-modal__input create-kadr-modal__input--duration"
                min={1}
                step={1}
                disabled={!blackoutLabelActive}
                value={blackoutDurationSec ?? ""}
                onChange={(e) => onBlackoutDurationChange(e.target.value)}
              />
              <span className="create-kadr-modal__duration-unit">сек</span>
            </label>
          </div>
          <div className="create-kadr-modal__label-row">
            <label
              className={cn(
                "create-kadr-modal__check",
                smokeLabelActive && "create-kadr-modal__check--active",
              )}
            >
              <input
                type="checkbox"
                checked={smokeLabelActive}
                onChange={onToggleSmokeDuration}
              />
              <span>Дым-машина</span>
            </label>
            <label className="create-kadr-modal__duration-field">
              <input
                type="number"
                className="create-kadr-modal__input create-kadr-modal__input--duration"
                min={1}
                step={1}
                disabled={!smokeLabelActive}
                value={smokeDurationSec ?? ""}
                onChange={(e) => onSmokeDurationChange(e.target.value)}
              />
              <span className="create-kadr-modal__duration-unit">сек</span>
            </label>
          </div>
        </div>
      </section>
    </>
  );
}
