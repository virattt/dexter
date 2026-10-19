import type { GatewayConfig, TelegramAccountConfig } from '../../config.js';
import { listTelegramAccountIds, resolveTelegramAccount } from '../../config.js';
import type { ChannelPlugin } from '../types.js';
import { monitorTelegramChannel } from './runtime.js';
import type { TelegramInboundMessage } from './types.js';
import { resolveReconnectPolicy } from '../whatsapp/reconnect.js';

export function createTelegramPlugin(params: {
  loadConfig: () => GatewayConfig;
  onMessage: (msg: TelegramInboundMessage) => Promise<void>;
}): ChannelPlugin<GatewayConfig, TelegramAccountConfig> {
  return {
    id: 'telegram',
    config: {
      listAccountIds: (cfg) => listTelegramAccountIds(cfg),
      resolveAccount: (cfg, accountId) => resolveTelegramAccount(cfg, accountId),
      isEnabled: (account, cfg) => account.enabled && cfg.channels.telegram?.enabled !== false,
      isConfigured: (account) => Boolean(account.botToken),
    },
    gateway: {
      startAccount: async (ctx) => {
        const cfg = params.loadConfig();
        await monitorTelegramChannel({
          accountId: ctx.accountId,
          botToken: ctx.account.botToken,
          allowFrom: ctx.account.allowFrom,
          dmPolicy: ctx.account.dmPolicy,
          groupPolicy: ctx.account.groupPolicy,
          reconnect: resolveReconnectPolicy(cfg),
          abortSignal: ctx.abortSignal,
          onMessage: params.onMessage,
          onStatus: (status) => {
            ctx.setStatus({
              connected: status.connected,
              lastError: status.lastError ?? null,
            });
          },
        });
      },
    },
    status: {
      defaultRuntime: {
        accountId: 'default',
        running: false,
        connected: false,
        lastError: null,
      },
    },
  };
}
