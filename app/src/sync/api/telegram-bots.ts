import { api } from "./client";

export interface TelegramBotIntegrationSummary {
  id: string;
  title?: string | null;
  botUsername?: string | null;
  botTelegramUserId?: string | null;
  ownerTelegramId?: string | null;
  adminTelegramId?: string | null;
  status: string;
  groupChatId?: string | null;
  attendanceThreadId?: string | null;
  announcementsThreadId?: string | null;
  defaultProjectSlug?: string | null;
  quizGroupChatId?: string | null;
  quizThreadId?: string | null;
  callNotifyMode?: "on_publish" | "same_day" | "advance";
  callNotifyAdvanceDays?: number;
  callNotifyHour?: number;
  availabilityRemindEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BotVariableItem {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  updatedAt: string;
}

export async function listTelegramBots(
  accessToken: string,
): Promise<{ items: TelegramBotIntegrationSummary[] }> {
  const { data } = await api.get<{ items: TelegramBotIntegrationSummary[] }>(
    "/telegram-bots",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function connectTelegramBot(
  accessToken: string,
  body: { token: string; title?: string },
): Promise<{ ok: boolean; id: string }> {
  const { data } = await api.post<{ ok: boolean; id: string }>(
    "/telegram-bots/connect",
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function updateTelegramBot(
  accessToken: string,
  botId: string,
  patch: Partial<
    Pick<
      TelegramBotIntegrationSummary,
      | "title"
      | "ownerTelegramId"
      | "adminTelegramId"
      | "status"
      | "groupChatId"
      | "attendanceThreadId"
      | "announcementsThreadId"
      | "defaultProjectSlug"
      | "quizGroupChatId"
      | "quizThreadId"
      | "callNotifyMode"
      | "callNotifyAdvanceDays"
      | "callNotifyHour"
      | "availabilityRemindEnabled"
    >
  >,
): Promise<{ ok: boolean }> {
  const { data } = await api.patch<{ ok: boolean }>(
    `/telegram-bots/${encodeURIComponent(botId)}`,
    patch,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function deleteTelegramBot(
  accessToken: string,
  botId: string,
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(
    `/telegram-bots/${encodeURIComponent(botId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function listBotVariables(
  accessToken: string,
  botId: string,
): Promise<{ items: BotVariableItem[] }> {
  const { data } = await api.get<{ items: BotVariableItem[] }>(
    `/telegram-bots/${encodeURIComponent(botId)}/variables`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function upsertBotVariable(
  accessToken: string,
  botId: string,
  key: string,
  body: { value: string; isSecret?: boolean },
): Promise<{ item: BotVariableItem }> {
  const { data } = await api.put<{ item: BotVariableItem }>(
    `/telegram-bots/${encodeURIComponent(botId)}/variables/${encodeURIComponent(
      key,
    )}`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function deleteBotVariable(
  accessToken: string,
  botId: string,
  key: string,
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(
    `/telegram-bots/${encodeURIComponent(botId)}/variables/${encodeURIComponent(
      key,
    )}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function sendTelegramBotTestMessage(
  accessToken: string,
  botId: string,
  body: { chatId: string; text: string },
): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(
    `/telegram-bots/${encodeURIComponent(botId)}/test-message`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function remindMonthAvailability(
  accessToken: string,
  botId: string,
): Promise<{
  ok: boolean;
  sentCount: number;
  skippedCount: number;
  totalWithoutAvailability: number;
}> {
  const { data } = await api.post(
    `/telegram-bots/${encodeURIComponent(botId)}/remind-month-availability`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}
