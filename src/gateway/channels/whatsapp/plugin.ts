import type { GatewayConfig, WhatsAppAccountConfig } from '../../config.js';
import { listWhatsAppAccountIds, resolveWhatsAppAccount } from '../../config.js';
import type { ChannelPlugin } from '../types.js';
import { monitorWhatsAppChannel, type WhatsAppInboundMessage } from './index.js';
import { resolveReconnectPolicy } from './reconnect.js';

export function createWhatsAppPlugin(params: {
  loadConfig: () => GatewayConfig;
  onMessage: (msg: WhatsAppInboundMessage) => Promise<void>;
}): ChannelPlugin<GatewayConfig, WhatsAppAccountConfig> {
  return {
    id: 'whatsapp',
    config: {
      listAccountIds: (cfg) => listWhatsAppAccountIds(cfg),
      resolveAccount: (cfg, accountId) => resolveWhatsAppAccount(cfg, accountId),
      isEnabled: (account, cfg) => account.enabled && cfg.channels.whatsapp.enabled !== false,
      isConfigured: async (account) => Boolean(account.authDir),
    },
    gateway: {
      startAccount: async (ctx) => {
        const cfg = params.loadConfig();
        await monitorWhatsAppChannel({
          accountId: ctx.accountId,
          authDir: ctx.account.authDir,
          verbose: true,
          allowFrom: ctx.account.allowFrom,
          dmPolicy: ctx.account.dmPolicy,
          groupPolicy: ctx.account.groupPolicy,
          groupAllowFrom: ctx.account.groupAllowFrom,
          sendReadReceipts: ctx.account.sendReadReceipts,
          heartbeatSeconds: cfg.gateway.heartbeatSeconds,
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

