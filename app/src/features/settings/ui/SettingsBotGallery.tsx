import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import {
  channelTitle,
  platformLabel,
  telegramTitle,
  type GalleryItem,
  type PanelMode,
} from "../model/settings-bot-helpers";

type SettingsBotGalleryProps = {
  loading: boolean;
  listError: string | null;
  galleryItems: GalleryItem[];
  panelMode: PanelMode;
  selectedTelegramId: string;
  selectedChannelId: string;
  showConnectPanel: boolean;
  onReload: () => void;
  onOpenTelegram: (id: string) => void;
  onOpenChannel: (id: string) => void;
  onOpenConnect: () => void;
};

export function SettingsBotGallery({
  loading,
  listError,
  galleryItems,
  panelMode,
  selectedTelegramId,
  selectedChannelId,
  showConnectPanel,
  onReload,
  onOpenTelegram,
  onOpenChannel,
  onOpenConnect,
}: SettingsBotGalleryProps) {
  const showLoader = loading && galleryItems.length === 0;

  return (
    <section className="settings-card settings-bot-section">
      <div className="settings-bot-gallery-head">
        <h3 className="settings-card__title settings-bot-gallery-head__title">
          Боты
        </h3>
        <Button type="button" onClick={onReload} disabled={loading}>
          {loading ? "Обновляем…" : "Обновить"}
        </Button>
      </div>

      {listError ? (
        <div className="settings-invite-error">{listError}</div>
      ) : null}

      {showLoader ? (
        <PageLoader variant="view" label="Загрузка ботов…" />
      ) : (
        <div className="settings-bot-gallery">
          {galleryItems.map((item) => {
            if (item.kind === "telegram") {
              const isActive =
                panelMode === "telegram" && selectedTelegramId === item.bot.id;
              return (
                <button
                  key={`tg-${item.bot.id}`}
                  type="button"
                  className={cn(
                    "settings-bot-card",
                    isActive && "settings-bot-card--active",
                  )}
                  onClick={() => onOpenTelegram(item.bot.id)}
                >
                  <span className="settings-bot-card__platform">Telegram</span>
                  <span className="settings-bot-card__title">
                    {telegramTitle(item.bot)}
                  </span>
                  <span className="settings-bot-card__meta">
                    {item.bot.botUsername
                      ? `@${item.bot.botUsername}`
                      : item.bot.status}
                  </span>
                </button>
              );
            }

            const isActive =
              panelMode === "channel" &&
              selectedChannelId === item.channel.id;
            return (
              <button
                key={`ch-${item.channel.id}`}
                type="button"
                className={cn(
                  "settings-bot-card",
                  isActive && "settings-bot-card--active",
                )}
                onClick={() => onOpenChannel(item.channel.id)}
              >
                <span className="settings-bot-card__platform">
                  {platformLabel(item.channel.platform)}
                </span>
                <span className="settings-bot-card__title">
                  {channelTitle(item.channel)}
                </span>
                <span className="settings-bot-card__meta">
                  {item.channel.chatId
                    ? `chat ${item.channel.chatId}`
                    : item.channel.status}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className={cn(
              "settings-bot-card",
              "settings-bot-card--connect",
              showConnectPanel && "settings-bot-card--active",
            )}
            onClick={onOpenConnect}
          >
            <span className="settings-bot-card__title">+ Подключить</span>
            <span className="settings-bot-card__meta">Telegram · Max · VK</span>
          </button>
        </div>
      )}
    </section>
  );
}
