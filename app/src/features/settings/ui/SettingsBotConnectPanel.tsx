import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import {
  CONNECT_PLATFORMS,
  connectPlatformHint,
  platformLabel,
  type ConnectPlatform,
} from "../model/settings-bot-helpers";

type SettingsBotConnectPanelProps = {
  connectPlatform: ConnectPlatform;
  setConnectPlatform: (platform: ConnectPlatform) => void;
  connectTitle: string;
  setConnectTitle: (value: string) => void;
  connectToken: string;
  setConnectToken: (value: string) => void;
  connectChatId: string;
  setConnectChatId: (value: string) => void;
  connectVkGroupId: string;
  setConnectVkGroupId: (value: string) => void;
  connectLoading: boolean;
  connectError: string | null;
  connectHint: string | null;
  tokenPlaceholder: string;
  canConnect: boolean;
  onConnect: () => void;
};

export function SettingsBotConnectPanel({
  connectPlatform,
  setConnectPlatform,
  connectTitle,
  setConnectTitle,
  connectToken,
  setConnectToken,
  connectChatId,
  setConnectChatId,
  connectVkGroupId,
  setConnectVkGroupId,
  connectLoading,
  connectError,
  connectHint,
  tokenPlaceholder,
  canConnect,
  onConnect,
}: SettingsBotConnectPanelProps) {
  const showVkGroupId = connectPlatform === "vk";
  const showChatId = connectPlatform !== "telegram";
  const chatIdPlaceholder =
    connectPlatform === "max" ? "chat_id" : "peer_id чата";
  const platformHint = connectPlatformHint(connectPlatform);

  return (
    <section className="settings-card settings-bot-section">
      <h3 className="settings-card__title">Подключить бота</h3>
      <div className="settings-bot-platform-tabs">
        {CONNECT_PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            className={cn(
              "settings-bot-platform-tab",
              connectPlatform === p && "settings-bot-platform-tab--active",
            )}
            onClick={() => setConnectPlatform(p)}
          >
            {platformLabel(p)}
          </button>
        ))}
      </div>
      <div className="settings-invite-row settings-bot-row">
        <input
          type="text"
          className="settings-invite-input"
          value={connectTitle}
          onChange={(e) => setConnectTitle(e.target.value)}
          placeholder="Название"
        />
        <input
          type="password"
          className="settings-invite-input settings-bot-token"
          value={connectToken}
          onChange={(e) => setConnectToken(e.target.value)}
          placeholder={tokenPlaceholder}
        />
        {showVkGroupId ? (
          <input
            type="text"
            className="settings-invite-input"
            value={connectVkGroupId}
            onChange={(e) => setConnectVkGroupId(e.target.value)}
            placeholder="ID сообщества"
          />
        ) : null}
        {showChatId ? (
          <input
            type="text"
            className="settings-invite-input"
            value={connectChatId}
            onChange={(e) => setConnectChatId(e.target.value)}
            placeholder={chatIdPlaceholder}
          />
        ) : null}
        <Button
          type="button"
          className="primary"
          onClick={onConnect}
          disabled={connectLoading || !canConnect}
        >
          {connectLoading ? "Подключаем…" : "Подключить"}
        </Button>
      </div>
      <p className="settings-sync-hint">{platformHint}</p>
      {connectHint ? (
        <p className="settings-sync-hint">{connectHint}</p>
      ) : null}
      {connectError ? (
        <div className="settings-invite-error">{connectError}</div>
      ) : null}
    </section>
  );
}
