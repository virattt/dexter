import axios from 'axios';
import { parseUpdate } from './inbound.js';
import { getTelegramMe, setActiveTelegramBot, telegramUrl } from './outbound.js';
import type { TelegramApiResponse, TelegramInboundMessage, TelegramUpdate } from './types.js';
import type { ReconnectPolicy } from '../whatsapp/reconnect.js';
import { computeBackoff, DEFAULT_RECONNECT_POLICY } from '../whatsapp/reconnect.js';

const POLL_TIMEOUT_SECONDS = 30;

type DmPolicy = 'pairing' | 'allowlist' | 'open' | 'disabled';
type GroupPolicy = 'open' | 'allowlist' | 'disabled';

function isAllowed(
  msg: TelegramInboundMessage,
  policy: { allowFrom: string[]; dmPolicy: DmPolicy; groupPolicy: GroupPolicy },
): boolean {
  const wildcard = policy.allowFrom.includes('*');
  if (msg.chatType === 'group') {
    if (policy.groupPolicy === 'open') return true;
    if (policy.groupPolicy === 'disabled') return false;
    return (
      wildcard || policy.allowFrom.includes(msg.chatId) || policy.allowFrom.includes(msg.senderId)
    );
  }
  if (policy.dmPolicy === 'disabled') return false;
  if (policy.dmPolicy === 'open') return true;
  // 'pairing' has no Telegram flow yet, so it behaves like an allowlist
  return wildcard || policy.allowFrom.includes(msg.chatId);
}

export async function monitorTelegramChannel(params: {
  accountId: string;
  botToken: string;
  allowFrom: string[];
  dmPolicy: DmPolicy;
  groupPolicy: GroupPolicy;
  reconnect?: ReconnectPolicy;
  abortSignal: AbortSignal;
  onMessage: (msg: TelegramInboundMessage) => Promise<void>;
  onStatus?: (status: { connected: boolean; lastError?: string | null }) => void;
}): Promise<void> {
  const reconnectPolicy = params.reconnect ?? DEFAULT_RECONNECT_POLICY;
  let reconnectAttempts = 0;
  let offset = 0;

  while (!params.abortSignal.aborted) {
    try {
      const me = await getTelegramMe(params.botToken);
      setActiveTelegramBot(params.accountId, { token: params.botToken, username: me.username });
      params.onStatus?.({ connected: true, lastError: null });

      while (!params.abortSignal.aborted) {
        const { data } = await axios.get<TelegramApiResponse<TelegramUpdate[]>>(
          telegramUrl(params.botToken, 'getUpdates'),
          {
            params: { offset, timeout: POLL_TIMEOUT_SECONDS },
            // Client timeout must outlast the server-side long poll
            timeout: (POLL_TIMEOUT_SECONDS + 10) * 1000,
            signal: params.abortSignal,
          },
        );
        if (!data.ok) {
          throw new Error(data.description ?? 'Telegram getUpdates failed');
        }
        reconnectAttempts = 0;
        for (const update of data.result) {
          offset = update.update_id + 1;
          const msg = parseUpdate(update, params.accountId, params.botToken);
          if (!msg || !isAllowed(msg, params)) {
            continue;
          }
          // Don't block polling on a long agent run; handler errors must not kill the loop
          void params.onMessage(msg).catch(() => undefined);
        }
      }
    } catch (error) {
      if (params.abortSignal.aborted) {
        break;
      }
      reconnectAttempts += 1;
      const message = error instanceof Error ? error.message : String(error);
      params.onStatus?.({ connected: false, lastError: message });
      if (reconnectPolicy.maxAttempts > 0 && reconnectAttempts >= reconnectPolicy.maxAttempts) {
        break;
      }
      const delayMs = computeBackoff(reconnectPolicy, reconnectAttempts);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  setActiveTelegramBot(params.accountId, null);
  params.onStatus?.({ connected: false });
}
