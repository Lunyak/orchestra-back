import axios from 'axios';

const MAX_API = 'https://platform-api2.max.ru';

export type MaxMe = {
  user_id?: number;
  name?: string;
  username?: string;
  first_name?: string;
};

export async function maxGetMe(token: string): Promise<MaxMe> {
  const { data } = await axios.get(`${MAX_API}/me`, {
    headers: { Authorization: token },
    timeout: 12_000,
  });
  return data as MaxMe;
}

export async function maxSendMessage(params: {
  token: string;
  chatId: string;
  text: string;
}): Promise<{ messageId: string }> {
  const chatId = String(params.chatId ?? '').trim();
  const { data } = await axios.post(
    `${MAX_API}/messages`,
    { text: params.text },
    {
      headers: {
        Authorization: params.token,
        'Content-Type': 'application/json',
      },
      params: { chat_id: chatId },
      timeout: 15_000,
    },
  );
  const messageId =
    String(data?.message?.body?.mid ?? data?.message?.id ?? data?.message_id ?? '') ||
    `max-${Date.now()}`;
  return { messageId };
}

export async function maxSubscribeWebhook(params: {
  token: string;
  url: string;
  secret: string;
}): Promise<void> {
  await axios.post(
    `${MAX_API}/subscriptions`,
    {
      url: params.url,
      update_types: ['message_created', 'bot_started'],
      secret: params.secret,
    },
    {
      headers: {
        Authorization: params.token,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    },
  );
}

export function parseMaxInboundMessage(body: any): {
  messageId: string;
  chatId: string;
  text: string;
  fromBot: boolean;
  authorName: string;
} | null {
  const updateType = String(body?.update_type ?? body?.updateType ?? '');
  if (updateType && updateType !== 'message_created') return null;

  const message = body?.message ?? body;
  const text = String(message?.body?.text ?? message?.text ?? '').trim();
  if (!text) return null;

  const messageId = String(
    message?.body?.mid ?? message?.mid ?? message?.id ?? '',
  );
  const chatId = String(
    message?.recipient?.chat_id ??
      message?.chat_id ??
      body?.chat_id ??
      '',
  );
  if (!messageId || !chatId) return null;

  const sender = message?.sender ?? body?.user ?? {};
  const isBot = Boolean(sender?.is_bot ?? sender?.isBot);
  const authorName =
    String(sender?.name ?? sender?.username ?? sender?.first_name ?? '').trim() ||
    'Max';

  return {
    messageId,
    chatId,
    text,
    fromBot: isBot,
    authorName,
  };
}
