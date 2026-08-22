import { api } from "./client";

export type MessengerPlatform = "telegram" | "max" | "vk";

export interface MessengerChannelSummary {
  id: string;
  platform: "max" | "vk";
  title?: string | null;
  status: string;
  externalBotId?: string | null;
  externalUsername?: string | null;
  chatId?: string | null;
  vkGroupId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessengerBridgeMember {
  id: string;
  role: "primary" | "mirror" | string;
  platform: MessengerPlatform;
  telegramBotId?: string | null;
  channelId?: string | null;
  chatId?: string | null;
  channel?: {
    id: string;
    platform: string;
    title?: string | null;
    externalUsername?: string | null;
    chatId?: string | null;
    status: string;
  } | null;
}

export interface MessengerBridgeSummary {
  id: string;
  title?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  members: MessengerBridgeMember[];
}

export async function listMessengerChannels(
  accessToken: string,
): Promise<{ items: MessengerChannelSummary[] }> {
  const { data } = await api.get<{ items: MessengerChannelSummary[] }>(
    "/messenger-bots",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function connectMessengerChannel(
  accessToken: string,
  body: {
    platform: "max" | "vk";
    token: string;
    title?: string;
    chatId?: string;
    vkGroupId?: string;
  },
): Promise<{
  ok: boolean;
  id: string;
  platform: string;
  webhookHint?: string | null;
  vkConfirmation?: string | null;
}> {
  const { data } = await api.post<{
    ok: boolean;
    id: string;
    platform: string;
    webhookHint?: string | null;
    vkConfirmation?: string | null;
  }>("/messenger-bots/connect", body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function updateMessengerChannel(
  accessToken: string,
  channelId: string,
  patch: {
    title?: string | null;
    status?: string;
    chatId?: string | null;
    vkConfirmation?: string | null;
  },
): Promise<{ item: MessengerChannelSummary }> {
  const { data } = await api.patch<{ item: MessengerChannelSummary }>(
    `/messenger-bots/${encodeURIComponent(channelId)}`,
    patch,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function deleteMessengerChannel(
  accessToken: string,
  channelId: string,
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(
    `/messenger-bots/${encodeURIComponent(channelId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function sendMessengerTestMessage(
  accessToken: string,
  channelId: string,
  body: { chatId?: string; text: string },
): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(
    `/messenger-bots/${encodeURIComponent(channelId)}/test-message`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function listMessengerBridges(
  accessToken: string,
): Promise<{ items: MessengerBridgeSummary[] }> {
  const { data } = await api.get<{ items: MessengerBridgeSummary[] }>(
    "/messenger-bots/bridges",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function createMessengerBridge(
  accessToken: string,
  body: {
    title?: string;
    primary: {
      platform: MessengerPlatform;
      telegramBotId?: string;
      channelId?: string;
      chatId?: string;
    };
    mirrors?: Array<{
      platform: MessengerPlatform;
      telegramBotId?: string;
      channelId?: string;
      chatId?: string;
    }>;
  },
): Promise<{ item: MessengerBridgeSummary }> {
  const { data } = await api.post<{ item: MessengerBridgeSummary }>(
    "/messenger-bots/bridges",
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function updateMessengerBridge(
  accessToken: string,
  bridgeId: string,
  body: { title?: string | null; enabled?: boolean },
): Promise<{ item: MessengerBridgeSummary }> {
  const { data } = await api.patch<{ item: MessengerBridgeSummary }>(
    `/messenger-bots/bridges/${encodeURIComponent(bridgeId)}`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function deleteMessengerBridge(
  accessToken: string,
  bridgeId: string,
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(
    `/messenger-bots/bridges/${encodeURIComponent(bridgeId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function publishMessengerText(
  accessToken: string,
  body: {
    text: string;
    channelIds?: string[];
    telegramBotIds?: string[];
  },
): Promise<{
  results: Array<{
    platform: string;
    ref: string;
    ok: boolean;
    error?: string;
  }>;
}> {
  const { data } = await api.post<{
    results: Array<{
      platform: string;
      ref: string;
      ok: boolean;
      error?: string;
    }>;
  }>("/messenger-bots/publish", body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}
