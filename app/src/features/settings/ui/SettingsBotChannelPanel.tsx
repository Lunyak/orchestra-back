import { Button } from "@shared/core/button/Button";
import type { Dispatch, SetStateAction } from "react";
import type { MessengerChannelSummary } from "../../../sync/api/messenger-bots";
import {
  channelTitle,
  platformLabel,
  type ChannelPatchState,
} from "../model/settings-bot-helpers";

type SettingsBotChannelPanelProps = {
  channel: MessengerChannelSummary;
  channelPatch: ChannelPatchState;
  setChannelPatch: Dispatch<SetStateAction<ChannelPatchState>>;
  channelSaving: boolean;
  channelError: string | null;
  onSave: () => void;
  onDelete: () => void;
};

export function SettingsBotChannelPanel({
  channel,
  channelPatch,
  setChannelPatch,
  channelSaving,
  channelError,
  onSave,
  onDelete,
}: SettingsBotChannelPanelProps) {
  const platformName = platformLabel(channel.platform);
  const usernamePart = channel.externalUsername
    ? ` · ${channel.externalUsername}`
    : "";
  const groupPart = channel.vkGroupId ? ` · group ${channel.vkGroupId}` : "";
  const chatIdLabel = channel.platform === "max" ? "chat_id" : "peer_id";
  const showVkConfirmation = channel.platform === "vk";

  return (
    <section className="settings-card settings-bot-section">
      <div className="settings-bot-detail-head">
        <div className="settings-bot-detail-head__text">
          <h3 className="settings-card__title settings-bot-detail-head__title">
            {channelTitle(channel)}
          </h3>
          <p className="settings-sync-hint">
            {platformName}
            {usernamePart}
            {groupPart}
          </p>
        </div>
        <Button type="button" className="danger" onClick={onDelete}>
          Удалить
        </Button>
      </div>
      <div className="settings-bot-props">
        <label className="settings-bot-prop">
          <span className="settings-bot-prop__key">Название</span>
          <input
            type="text"
            value={channelPatch.title}
            onChange={(e) =>
              setChannelPatch((s) => ({ ...s, title: e.target.value }))
            }
          />
        </label>
        <label className="settings-bot-prop">
          <span className="settings-bot-prop__key">{chatIdLabel}</span>
          <input
            type="text"
            value={channelPatch.chatId}
            onChange={(e) =>
              setChannelPatch((s) => ({ ...s, chatId: e.target.value }))
            }
          />
        </label>
        {showVkConfirmation ? (
          <label className="settings-bot-prop">
            <span className="settings-bot-prop__key">confirmation</span>
            <input
              type="text"
              value={channelPatch.vkConfirmation}
              onChange={(e) =>
                setChannelPatch((s) => ({
                  ...s,
                  vkConfirmation: e.target.value,
                }))
              }
              placeholder="строка Callback API"
            />
          </label>
        ) : null}
      </div>
      <div className="settings-invite-row settings-bot-row settings-bot-row--footer">
        <Button
          type="button"
          className="primary"
          onClick={onSave}
          disabled={channelSaving}
        >
          {channelSaving ? "Сохраняем…" : "Сохранить"}
        </Button>
        {channelError ? (
          <div className="settings-invite-error settings-invite-error--flush">
            {channelError}
          </div>
        ) : null}
      </div>
    </section>
  );
}
