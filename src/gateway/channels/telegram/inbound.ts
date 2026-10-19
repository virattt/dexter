import { getActiveTelegramBot, sendComposingTelegram, sendMessageTelegram } from './outbound.js';
import type { TelegramInboundMessage, TelegramUpdate } from './types.js';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseUpdate(
  update: TelegramUpdate,
  accountId: string,
  _botToken: string,
): TelegramInboundMessage | null {
  const message = update.message;
  // Ignore non-text messages (photos, stickers, joins, ...)
  if (!message?.text || !message.from || message.from.is_bot) {
    return null;
  }
  const text = message.text;
  const { chat } = message;
  if (chat.type === 'channel') {
    return null;
  }

  const isGroup = chat.type === 'group' || chat.type === 'supergroup';
  const botUsername = getActiveTelegramBot(accountId)?.username?.toLowerCase();
  let body = text;

  if (isGroup) {
    if (!botUsername) {
      return null;
    }
    const mentioned = (message.entities ?? []).some(
      (entity) =>
        entity.type === 'mention' &&
        text.slice(entity.offset, entity.offset + entity.length).toLowerCase() === `@${botUsername}`,
    );
    const repliedToBot = message.reply_to_message?.from?.username?.toLowerCase() === botUsername;
    if (!mentioned && !repliedToBot) {
      return null;
    }
    body = body.replace(new RegExp(`@${escapeRegExp(botUsername)}`, 'gi'), '').trim();
  }
  if (!body) {
    return null;
  }

  const chatId = String(chat.id);
  const senderId = String(message.from.id);
  const senderName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ');

  return {
    accountId,
    chatId,
    chatType: isGroup ? 'group' : 'direct',
    from: chatId,
    senderId,
    senderName: senderName || message.from.username,
    body,
    timestamp: message.date * 1000,
    reply: (reply) => sendMessageTelegram({ to: chatId, body: reply, accountId }),
    sendComposing: () => sendComposingTelegram({ to: chatId, accountId }),
  };
}
