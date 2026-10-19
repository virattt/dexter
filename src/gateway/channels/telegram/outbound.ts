import axios from 'axios';
import type { TelegramApiResponse, TelegramUser } from './types.js';

const TELEGRAM_API = 'https://api.telegram.org';
// Telegram rejects messages longer than 4096 characters.
const MAX_MESSAGE_LENGTH = 4096;

export type TelegramBotClient = {
  token: string;
  /** Bot's own username (without @), used for mention detection */
  username?: string;
};

const bots = new Map<string, TelegramBotClient>();

export function telegramUrl(token: string, method: string): string {
  return `${TELEGRAM_API}/bot${token}/${method}`;
}

export async function getTelegramMe(token: string): Promise<TelegramUser> {
  const { data } = await axios.get<TelegramApiResponse<TelegramUser>>(telegramUrl(token, 'getMe'));
  if (!data.ok) {
    throw new Error(data.description ?? 'Telegram getMe failed');
  }
  return data.result;
}

export function setActiveTelegramBot(accountId: string, client: TelegramBotClient | null): void {
  if (!client) {
    bots.delete(accountId);
    return;
  }
  bots.set(accountId, client);
}

export function getActiveTelegramBot(accountId: string): TelegramBotClient | undefined {
  return bots.get(accountId);
}

function getActive(accountId?: string): TelegramBotClient {
  const found = accountId ? bots.get(accountId) : undefined;
  const client = found ?? bots.values().next().value;
  if (!client) {
    throw new Error('No active Telegram bot. Run dexter gateway run.');
  }
  return client;
}

function splitMessage(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > MAX_MESSAGE_LENGTH) {
    // Prefer breaking at a newline so chunks stay readable
    let cut = rest.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
    if (cut <= 0) cut = MAX_MESSAGE_LENGTH;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function sendChunk(client: TelegramBotClient, chatId: string, text: string): Promise<void> {
  const url = telegramUrl(client.token, 'sendMessage');
  try {
    await axios.post(url, { chat_id: chatId, text, parse_mode: 'Markdown' });
  } catch (error) {
    // Legacy Markdown rejects unbalanced entities with 400; retry as plain text
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      await axios.post(url, { chat_id: chatId, text });
      return;
    }
    throw error;
  }
}

export async function sendMessageTelegram(params: {
  to: string;
  body: string;
  accountId?: string;
}): Promise<void> {
  const client = getActive(params.accountId);
  for (const chunk of splitMessage(params.body)) {
    await sendChunk(client, params.to, chunk);
  }
}

export async function sendComposingTelegram(params: {
  to: string;
  accountId?: string;
}): Promise<void> {
  const client = getActive(params.accountId);
  await axios.post(telegramUrl(client.token, 'sendChatAction'), {
    chat_id: params.to,
    action: 'typing',
  });
}
