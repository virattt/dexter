import { describe, expect, test } from 'bun:test';
import { resolveRoute } from './resolve-route.js';

describe('resolveRoute', () => {
  test('falls back to default route', () => {
    const route = resolveRoute({
      cfg: {
        gateway: { accountId: 'default', logLevel: 'info' },
        channels: { whatsapp: { enabled: true, accounts: {}, allowFrom: [] } },
        bindings: [],
      },
      channel: 'whatsapp',
      accountId: 'default',
      peer: { kind: 'direct', id: '+15550001111' },
    });
    expect(route.agentId).toBe('default');
    expect(route.matchedBy).toBe('default');
    expect(route.sessionKey).toContain('whatsapp');
  });

  test('matches peer binding first', () => {
    const route = resolveRoute({
      cfg: {
        gateway: { accountId: 'default', logLevel: 'info' },
        channels: { whatsapp: { enabled: true, accounts: {}, allowFrom: [] } },
        bindings: [
          {
            agentId: 'alpha',
            match: {
              channel: 'whatsapp',
              peerKind: 'direct',
              peerId: '+15551234567',
            },
          },
        ],
      },
      channel: 'whatsapp',
      accountId: 'default',
      peer: { kind: 'direct', id: '+15551234567' },
    });
    expect(route.agentId).toBe('alpha');
    expect(route.matchedBy).toBe('binding.peer');
  });
});

