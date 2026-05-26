import {
  buildLightChannelSelectOptions,
  formatLightChannelSlot,
  parseLightChannelSlot,
} from "../model/theater-light-channel-link";

export type LightChannelSelectProps = {
  lightChannels: string[];
  value: string;
  onChange: (channel: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
};

export function LightChannelSelect({
  lightChannels,
  value,
  onChange,
  disabled,
  allowEmpty = true,
  emptyLabel = "—",
  className,
}: LightChannelSelectProps) {
  const slot = parseLightChannelSlot(value);
  const options = buildLightChannelSelectOptions(lightChannels, slot ?? undefined);
  const normalized = slot != null ? formatLightChannelSlot(slot) : "";

  return (
    <select
      className={className}
      value={normalized}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {options.map((item) => (
        <option key={item.slot} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
