import { monitorWebInbox } from './inbound.js';
import { setActiveWebListener } from './outbound.js';
import { logout } from './auth-store.js';
import type { WhatsAppInboundMessage } from './types.js';
import type { ReconnectPolicy } from './reconnect.js';
import { computeBackoff, DEFAULT_RECONNECT_POLICY } from './reconnect.js';

export async function monitorWhatsAppChannel(params: {
  accountId: string;
  authDir: string;
  verbose: boolean;
  allowFrom: string[];
  dmPolicy: 'pairing' | 'allowlist' | 'open' | 'disabled';
  groupPolicy: 'open' | 'allowlist' | 'disabled';
  groupAllowFrom: string[];
  sendReadReceipts?: boolean;
  heartbeatSeconds?: number;
  reconnect?: ReconnectPolicy;
  abortSignal: AbortSignal;
  onMessage: (msg: WhatsAppInboundMessage) => Promise<void>;
  onStatus?: (status: { connected: boolean; lastError?: string | null }) => void;
}): Promise<void> {
  const MESSAGE_TIMEOUT_MS = 30 * 60 * 1000;
  const WATCHDOG_CHECK_MS = 60 * 1000;
  const heartbeatSeconds =
    typeof params.heartbeatSeconds === 'number' && params.heartbeatSeconds > 0
      ? params.heartbeatSeconds
      : 60;
  const reconnectPolicy = params.reconnect ?? DEFAULT_RECONNECT_POLICY;
  let reconnectAttempts = 0;
  while (!params.abortSignal.aborted) {
    const startedAt = Date.now();
    let handledMessages = 0;
    let lastMessageAt: number | null = null;
    let heartbeat: NodeJS.Timeout | null = null;
    let watchdog: NodeJS.Timeout | null = null;
    try {
      const listener = await monitorWebInbox({
        accountId: params.accountId,
        authDir: params.authDir,
        verbose: params.verbose,
        allowFrom: params.allowFrom,
        dmPolicy: params.dmPolicy,
        groupPolicy: params.groupPolicy,
        groupAllowFrom: params.groupAllowFrom,
        sendReadReceipts: params.sendReadReceipts,
        onMessage: async (msg) => {
          handledMessages += 1;
          lastMessageAt = Date.now();
          await params.onMessage(msg);
        },
      });
      setActiveWebListener(params.accountId, listener.sock);
      params.onStatus?.({ connected: true, lastError: null });
      heartbeat = setInterval(() => {
        const uptimeMs = Date.now() - startedAt;
        if (params.verbose) {
          console.log(
            `[whatsapp heartbeat] account=${params.accountId} messages=${handledMessages} uptimeMs=${uptimeMs}`,
          );
        }
      }, heartbeatSeconds * 1000);
      watchdog = setInterval(() => {
        if (!lastMessageAt) {
          return;
        }
        if (Date.now() - lastMessageAt <= MESSAGE_TIMEOUT_MS) {
          return;
        }
        void listener.close();
      }, WATCHDOG_CHECK_MS);
      const closeReason = await listener.onClose;
      await listener.close();
      setActiveWebListener(params.accountId, null);
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (watchdog) {
        clearInterval(watchdog);
      }

      if (closeReason.isLoggedOut) {
        // Clear stale credentials when WhatsApp reports logged out (401)
        await logout(params.authDir);
        params.onStatus?.({ connected: false, lastError: 'logged out - please re-run gateway:login' });
        break;
      }

      const uptimeMs = Date.now() - startedAt;
      if (uptimeMs > heartbeatSeconds * 1000) {
        reconnectAttempts = 0;
      }
      reconnectAttempts += 1;
      const delayMs = computeBackoff(reconnectPolicy, reconnectAttempts);
      params.onStatus?.({
        connected: false,
        lastError: `disconnected (attempt ${reconnectAttempts})`,
      });
      if (reconnectPolicy.maxAttempts > 0 && reconnectAttempts >= reconnectPolicy.maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (watchdog) {
        clearInterval(watchdog);
      }
      reconnectAttempts += 1;
      const message = error instanceof Error ? error.message : String(error);
      params.onStatus?.({ connected: false, lastError: message });
      const delayMs = computeBackoff(reconnectPolicy, reconnectAttempts);
      if (reconnectPolicy.maxAttempts > 0 && reconnectAttempts >= reconnectPolicy.maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  setActiveWebListener(params.accountId, null);
}

