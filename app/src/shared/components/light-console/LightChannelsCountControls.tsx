import { MAX_LIGHT_CHANNELS, MIN_LIGHT_CHANNELS } from "./light-channels-mutate";

export type LightChannelsCountControlsProps = {
  channelCount: number;
  onAppend: () => void;
  onRemove: () => void;
  className?: string;
};

export function LightChannelsCountControls({
  channelCount,
  onAppend,
  onRemove,
  className,
}: LightChannelsCountControlsProps) {
  const canAppend = channelCount < MAX_LIGHT_CHANNELS;
  const canRemove = channelCount > MIN_LIGHT_CHANNELS;

  return (
    <div
      className={["light-channels-count", className].filter(Boolean).join(" ")}
      title="Число каналов K на пульте (не то же самое, что число фейдеров F)"
    >
      <span className="light-channels-count__label">K: {channelCount}</span>
      <button
        type="button"
        className="light-channels-count__btn"
        disabled={!canAppend}
        onClick={onAppend}
        title={canAppend ? "Добавить канал" : `Максимум ${MAX_LIGHT_CHANNELS} каналов`}
      >
        + K
      </button>
      <button
        type="button"
        className="light-channels-count__btn"
        disabled={!canRemove}
        onClick={onRemove}
        title={canRemove ? "Убрать последний канал" : "Нужен хотя бы один канал"}
      >
        − K
      </button>
    </div>
  );
}
