import type { TelegramBotIntegrationSummary } from "../../../sync/api/telegram-bots";
import type {
  MessengerChannelSummary,
  MessengerPlatform,
} from "../../../sync/api/messenger-bots";

export type ConnectPlatform = "telegram" | "max" | "vk";

export type GalleryItem =
  | { kind: "telegram"; bot: TelegramBotIntegrationSummary }
  | { kind: "channel"; channel: MessengerChannelSummary };

export type PanelMode = "none" | "connect" | "telegram" | "channel";

export type BotPatchState = {
  title: string;
  ownerTelegramId: string;
  adminTelegramId: string;
  groupChatId: string;
  attendanceThreadId: string;
  announcementsThreadId: string;
  defaultProjectSlug: string;
  quizGroupChatId: string;
  quizThreadId: string;
};

export type ChannelPatchState = {
  title: string;
  chatId: string;
  vkConfirmation: string;
};

export type BridgeOption = {
  key: string;
  label: string;
  platform: MessengerPlatform;
};

export type BridgeMemberRef = {
  platform: MessengerPlatform;
  telegramBotId?: string;
  channelId?: string;
};

export type TelegramBotPropField = keyof BotPatchState;

export const TELEGRAM_BOT_PROP_FIELDS: ReadonlyArray<{
  field: TelegramBotPropField;
  label: string;
  placeholder: string;
}> = [
  { field: "title", label: "Название", placeholder: "title" },
  { field: "ownerTelegramId", label: "Владелец", placeholder: "telegram id" },
  { field: "adminTelegramId", label: "Админ", placeholder: "telegram id" },
  { field: "groupChatId", label: "Группа", placeholder: "-100…" },
  {
    field: "attendanceThreadId",
    label: "Посещаемость",
    placeholder: "thread id",
  },
  {
    field: "announcementsThreadId",
    label: "Анонсы",
    placeholder: "thread id",
  },
  { field: "defaultProjectSlug", label: "Проект", placeholder: "slug" },
  { field: "quizGroupChatId", label: "Quiz-группа", placeholder: "-100…" },
  { field: "quizThreadId", label: "Quiz-тред", placeholder: "thread id" },
];

export const CONNECT_PLATFORMS: ConnectPlatform[] = ["telegram", "max", "vk"];

export function looksLikeTelegramBotToken(token: string): boolean {
  const t = String(token ?? "").trim();
  return Boolean(t.match(/^(\d{5,}):([A-Za-z0-9_-]{20,})$/));
}

export function platformLabel(platform: string): string {
  if (platform === "telegram") return "Telegram";
  if (platform === "max") return "Max";
  if (platform === "vk") return "VK";
  return platform;
}

export function telegramTitle(bot: TelegramBotIntegrationSummary): string {
  const title = String(bot.title ?? "").trim();
  if (title) return title;
  if (bot.botUsername) return `@${bot.botUsername}`;
  return "Telegram";
}

export function channelTitle(ch: MessengerChannelSummary): string {
  const title = String(ch.title ?? "").trim();
  if (title) return title;
  if (ch.externalUsername) return String(ch.externalUsername);
  return platformLabel(ch.platform);
}

export function memberKey(platform: MessengerPlatform, id: string): string {
  return `${platform}:${id}`;
}

export function parseMemberKey(key: string): BridgeMemberRef | null {
  const [platform, id] = key.split(":");
  if (!id) return null;
  if (platform === "telegram") {
    return { platform: "telegram", telegramBotId: id };
  }
  if (platform === "max" || platform === "vk") {
    return { platform, channelId: id };
  }
  return null;
}

export function extractApiError(e: unknown, fallback: string): string {
  const err = e as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return err?.response?.data?.message || err?.message || fallback;
}

export function connectTokenPlaceholder(platform: ConnectPlatform): string {
  if (platform === "telegram") return "Токен BotFather";
  if (platform === "max") return "Токен Max (Authorization)";
  return "Токен сообщества VK";
}

export function connectPlatformHint(platform: ConnectPlatform): string {
  if (platform === "telegram") {
    return "Токен из @BotFather. Хранится зашифрованным.";
  }
  if (platform === "max") {
    return "Токен из кабинета MAX для партнёров после модерации бота.";
  }
  return "Ключ доступа сообщества VK с правом messages. Укажите ID группы.";
}

export function botPatchFromTelegram(
  bot: TelegramBotIntegrationSummary,
): BotPatchState {
  return {
    title: bot.title ?? "",
    ownerTelegramId: bot.ownerTelegramId ?? "",
    adminTelegramId: bot.adminTelegramId ?? "",
    groupChatId: bot.groupChatId ?? "",
    attendanceThreadId: bot.attendanceThreadId ?? "",
    announcementsThreadId: bot.announcementsThreadId ?? "",
    defaultProjectSlug: bot.defaultProjectSlug ?? "",
    quizGroupChatId: bot.quizGroupChatId ?? "",
    quizThreadId: bot.quizThreadId ?? "",
  };
}

export function channelPatchFromChannel(
  ch: MessengerChannelSummary,
): ChannelPatchState {
  return {
    title: ch.title ?? "",
    chatId: ch.chatId ?? "",
    vkConfirmation: "",
  };
}
