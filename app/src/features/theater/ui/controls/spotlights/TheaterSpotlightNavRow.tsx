import cn from "classnames";
import type { TheaterSpotlight } from "../../../../../shared/types/script";
import {
  formatLightChannelSlot,
  spotlightMatchesChannelSlot,
} from "../../../model/theater-light-channel-link";
import { LightChannelSelect } from "../../LightChannelSelect";
import {
  formatCompactFaderLabel,
  readSpotlightFaderId,
} from "../../../model/theater-light-fader-bindings";
import { TheaterBtn } from "../../theater-controls-ui";
import { SpotlightListNameInput } from "./SpotlightListNameInput";
import type { SpotlightsSectionProps } from "./types";

export type TheaterSpotlightNavRowProps = Pick<SpotlightsSectionProps, "vm" | "spot"> & {
  item: TheaterSpotlight;
  placeholder: string;
  deleteTitle: string;
};

export function TheaterSpotlightNavRow({
  vm,
  spot,
  item,
  placeholder,
  deleteTitle,
}: TheaterSpotlightNavRowProps) {
  const { lightChannels, lightFaders, selectedLightSlot } = spot;
  const isSlotActive =
    selectedLightSlot > 0 && spotlightMatchesChannelSlot(item, selectedLightSlot);
  const isSelected =
    item.id === vm.activeSpotlightId || vm.multiSelectedSpotlightIds.includes(item.id);

  return (
    <div
      className={cn(
        "theater-sidebar-home__item",
        "theater-spotlight-nav-row",
        isSelected && "theater-spotlight-nav-row--active",
        isSlotActive && "theater-spotlight-nav-row--slot-active",
      )}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, input, select, label")) return;
        vm.selectTheaterSpotlight(item.id, event.shiftKey);
      }}
    >
      <svg
        className="theater-sidebar-home__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3v4M9 7h6l5 13H4L9 7Z" />
      </svg>
      <SpotlightListNameInput
        item={item}
        active={isSelected}
        disabled={!vm.currentScene}
        placeholder={placeholder}
        onSelect={(shiftKey) => vm.selectTheaterSpotlight(item.id, shiftKey)}
        onLabelCommit={(label) => vm.updateSpotlight(item.id, { label })}
      />
      <label
        className="theater-spotlight-channel theater-spotlight-channel--compact"
        title="K — канал"
      >
        <LightChannelSelect
          lightChannels={lightChannels}
          value={formatLightChannelSlot(item.channel ?? item.id)}
          allowEmpty={false}
          onChange={(channel) => {
            const nextChannel = Math.max(1, Number(channel) || 1);
            vm.updateSpotlight(item.id, { channel: nextChannel });
            const faderId = readSpotlightFaderId(item);
            if (faderId != null) {
              spot.bindSpotlightToFader(faderId, item.id, nextChannel);
            }
          }}
          disabled={!vm.currentScene}
          className="theater-channel-input theater-channel-input--channel"
        />
      </label>
      <label
        className="theater-spotlight-channel theater-spotlight-channel--compact"
        title="F — фейдер"
      >
        <select
          className="native-select theater-channel-input theater-channel-input--fader"
          value={
            readSpotlightFaderId(item) != null ? String(readSpotlightFaderId(item)) : ""
          }
          disabled={!vm.currentScene}
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (!raw) {
              vm.updateSpotlight(item.id, { faderId: undefined });
              spot.unbindSpotlightFromFader(item.id);
              return;
            }
            const faderId = Math.max(1, Number(raw) || 1);
            const channel = item.channel ?? item.id;
            vm.updateSpotlight(item.id, { faderId });
            spot.bindSpotlightToFader(faderId, item.id, channel);
          }}
        >
          <option value="">—</option>
          {Array.from({ length: Math.max(lightFaders.length, 8) }, (_, index) => {
            const faderId = index + 1;
            return (
              <option key={faderId} value={faderId}>
                {formatCompactFaderLabel(faderId)}
              </option>
            );
          })}
        </select>
      </label>
      <TheaterBtn
        className="theater-btn--visibility"
        active={item.enabled !== false}
        onClick={() =>
          vm.updateSpotlight(item.id, {
            enabled: !(item.enabled ?? true),
          })
        }
        disabled={!vm.currentScene}
        title={item.enabled === false ? "Включить" : "Выключить"}
      >
        <span className="theater-spotlight-power-dot" />
      </TheaterBtn>
      <TheaterBtn
        className="theater-btn--danger"
        disabled={!vm.currentScene}
        title={deleteTitle}
        onClick={() => vm.removeSpotlight(item.id)}
      >
        ×
      </TheaterBtn>
    </div>
  );
}
