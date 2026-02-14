import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sendComposing, sendMessageWhatsApp, setActiveWebListener } from './outbound.js';
import type { WaSocket } from './session.js';

function writeGatewayConfig(configPath: string, allowFrom: string[]): void {
  const config = {
    gateway: {
      accountId: 'default',
      logLevel: 'info',
    },
    channels: {
      whatsapp: {
        enabled: true,
        accounts: {
          default: {
            allowFrom,
            dmPolicy: 'allowlist',
            groupPolicy: 'disabled',
          },
        },
      },
    },
    bindings: [],
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

describe('whatsapp outbound strict allowlist', () => {
  afterEach(() => {
    delete process.env.DEXTER_GATEWAY_CONFIG;
    setActiveWebListener('default', null);
  });

  test('blocks sendMessage to non-allowlisted recipient', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-outbound-'));
    const configPath = join(dir, 'gateway.json');
    let sendCount = 0;
    writeGatewayConfig(configPath, ['+15551234567']);
    process.env.DEXTER_GATEWAY_CONFIG = configPath;
    const sock = {
      sendMessage: async () => {
        sendCount += 1;
        return { key: { id: 'msg-1' } };
      },
      sendPresenceUpdate: async () => {},
    } as unknown as WaSocket;
    setActiveWebListener('default', sock);

    try {
      await expect(
        sendMessageWhatsApp({
          to: '15550000000@s.whatsapp.net',
          body: 'hello',
          accountId: 'default',
        }),
      ).rejects.toThrow('not in allowFrom');
      expect(sendCount).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('blocks sendComposing to non-allowlisted recipient', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dexter-outbound-'));
    const configPath = join(dir, 'gateway.json');
    let presenceCount = 0;
    writeGatewayConfig(configPath, ['+15551234567']);
    process.env.DEXTER_GATEWAY_CONFIG = configPath;
    const sock = {
      sendMessage: async () => ({ key: { id: 'msg-1' } }),
      sendPresenceUpdate: async () => {
        presenceCount += 1;
      },
    } as unknown as WaSocket;
    setActiveWebListener('default', sock);

    try {
      await expect(
        sendComposing({
          to: '15550000000@s.whatsapp.net',
          accountId: 'default',
        }),
      ).rejects.toThrow('not in allowFrom');
      expect(presenceCount).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
