import axios from 'axios';
import crypto from 'node:crypto';

const VK_API = 'https://api.vk.com/method';
const VK_VERSION = '5.199';

async function vkCall<T>(
  method: string,
  token: string,
  params: Record<string, string | number | undefined>,
): Promise<T> {
  const { data } = await axios.post(
    `${VK_API}/${method}`,
    null,
    {
      params: {
        ...params,
        access_token: token,
        v: VK_VERSION,
      },
      timeout: 15_000,
    },
  );
  if (data?.error) {
    const msg =
      data.error.error_msg ||
      data.error.error_code ||
      'VK API error';
    throw new Error(String(msg));
  }
  return data?.response as T;
}

export type VkGroupInfo = {
  id: number;
  name?: string;
  screen_name?: string;
};

export async function vkGetGroup(
  token: string,
  groupId: string,
): Promise<VkGroupInfo> {
  const gid = String(groupId ?? '').trim().replace(/^club/, '');
  const list = await vkCall<VkGroupInfo[]>('groups.getById', token, {
    group_id: gid,
  });
  const g = Array.isArray(list) ? list[0] : (list as any)?.groups?.[0];
  if (!g?.id) throw new Error('VK group not found');
  return g;
}

export async function vkGetCallbackConfirmationCode(
  token: string,
  groupId: string,
): Promise<string> {
  const gid = String(groupId ?? '').trim().replace(/^club/, '');
  const code = await vkCall<string>('groups.getCallbackConfirmationCode', token, {
    group_id: gid,
  });
  return String(code ?? '');
}

export async function vkSendMessage(params: {
  token: string;
  peerId: string;
  text: string;
}): Promise<{ messageId: string }> {
  const randomId = crypto.randomInt(1, 2_147_483_647);
  const messageId = await vkCall<number>('messages.send', params.token, {
    peer_id: params.peerId,
    message: params.text,
    random_id: randomId,
  });
  return { messageId: String(messageId ?? randomId) };
}

export function parseVkInboundMessage(body: any): {
  messageId: string;
  chatId: string;
  text: string;
  fromBot: boolean;
  authorName: string;
} | null {
  if (String(body?.type ?? '') !== 'message_new') return null;
  const msg = body?.object?.message ?? body?.object ?? {};
  const text = String(msg?.text ?? '').trim();
  if (!text) return null;

  const messageId = String(msg?.id ?? msg?.conversation_message_id ?? '');
  const chatId = String(msg?.peer_id ?? '');
  if (!messageId || !chatId) return null;

  const out = Number(msg?.out ?? 0) === 1;
  const fromId = Number(msg?.from_id ?? 0);
  const fromBot = out || fromId < 0;

  return {
    messageId,
    chatId,
    text,
    fromBot,
    authorName: fromId ? `vk:${fromId}` : 'VK',
  };
}
