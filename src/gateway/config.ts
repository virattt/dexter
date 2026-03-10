import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { normalizeE164 } from './utils.js';
import { dexterPath } from '../utils/paths.js';

const DEFAULT_GATEWAY_PATH = dexterPath('gateway.json');
const DmPolicySchema = z.enum(['pairing', 'allowlist', 'open', 'disabled']);
const GroupPolicySchema = z.enum(['open', 'allowlist', 'disabled']);
const ReconnectSchema = z.object({
  initialMs: z.number().optional(),
  maxMs: z.number().optional(),
  factor: z.number().optional(),
  jitter: z.number().optional(),
  maxAttempts: z.number().optional(),
});

const WhatsAppAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  authDir: z.string().optional(),
  allowFrom: z.array(z.string()).optional().default([]),
  dmPolicy: DmPolicySchema.optional(),
  groupPolicy: GroupPolicySchema.optional(),
  groupAllowFrom: z.array(z.string()).optional().default([]),
  sendReadReceipts: z.boolean().optional().default(true),
});

const HeartbeatConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(false),
    intervalMinutes: z.number().min(5).optional().default(10),
    // default to NYSE market hours: 9:30 AM - 4:00 PM ET, Mon-Fri
    activeHours: z
      .object({
        start: z.string().optional().default('09:30'),
        end: z.string().optional().default('16:00'),
        timezone: z.string().optional().default('America/New_York'),
        daysOfWeek: z.array(z.number().min(0).max(6)).optional().default([1, 2, 3, 4, 5]),
      })
      .optional(),
    model: z.string().optional(),
    modelProvider: z.string().optional(),
    maxIterations: z.number().optional().default(6),
  })
  .optional();

const GatewayConfigSchema = z.object({
  gateway: z
    .object({
      accountId: z.string().optional(),
      logLevel: z.enum(['silent', 'error', 'info', 'debug']).optional(),
      heartbeatSeconds: z.number().optional(),
      reconnect: ReconnectSchema.optional(),
      heartbeat: HeartbeatConfigSchema,
    })
    .optional(),
  channels: z
    .object({
      whatsapp: z
        .object({
          enabled: z.boolean().optional(),
          accounts: z.record(z.string(), WhatsAppAccountSchema).optional(),
          allowFrom: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  bindings: z
    .array(
      z.object({
        agentId: z.string(),
        match: z.object({
          channel: z.string(),
          accountId: z.string().optional(),
          peerId: z.string().optional(),
          peerKind: z.enum(['direct', 'group']).optional(),
        }),
      }),
    )
    .optional()
    .default([]),
});

export type GatewayConfig = {
  gateway: {
    accountId: string;
    logLevel: 'silent' | 'error' | 'info' | 'debug';
    heartbeatSeconds?: number;
    reconnect?: {
      initialMs?: number;
      maxMs?: number;
      factor?: number;
      jitter?: number;
      maxAttempts?: number;
    };
    heartbeat?: {
      enabled: boolean;
      intervalMinutes: number;
      activeHours?: { start: string; end: string; timezone?: string; daysOfWeek?: number[] };
      model?: string;
      modelProvider?: string;
      maxIterations: number;
    };
  };
  channels: {
    whatsapp: {
      enabled: boolean;
      accounts: Record<string, z.infer<typeof WhatsAppAccountSchema>>;
      allowFrom: string[];
    };
  };
  bindings: Array<{
    agentId: string;
    match: {
      channel: string;
      accountId?: string;
      peerId?: string;
      peerKind?: 'direct' | 'group';
    };
  }>;
};
export type WhatsAppAccountConfig = {
  accountId: string;
  name?: string;
  enabled: boolean;
  authDir: string;
  allowFrom: string[];
  dmPolicy: 'pairing' | 'allowlist' | 'open' | 'disabled';
  groupPolicy: 'open' | 'allowlist' | 'disabled';
  groupAllowFrom: string[];
  sendReadReceipts: boolean;
};

export function getGatewayConfigPath(overridePath?: string): string {
  return overridePath ?? process.env.DEXTER_GATEWAY_CONFIG ?? DEFAULT_GATEWAY_PATH;
}

export function loadGatewayConfig(overridePath?: string): GatewayConfig {
  const path = getGatewayConfigPath(overridePath);
  if (!existsSync(path)) {
    return {
      gateway: { accountId: 'default', logLevel: 'info' },
      channels: { whatsapp: { enabled: true, accounts: {}, allowFrom: [] } },
      bindings: [],
    };
  }
  const raw = readFileSync(path, 'utf8');
  const parsed = GatewayConfigSchema.parse(JSON.parse(raw));
  return {
    ...parsed,
    gateway: {
      accountId: parsed.gateway?.accountId ?? 'default',
      logLevel: parsed.gateway?.logLevel ?? 'info',
      heartbeatSeconds: parsed.gateway?.heartbeatSeconds,
      reconnect: parsed.gateway?.reconnect,
      heartbeat: parsed.gateway?.heartbeat
        ? {
            enabled: parsed.gateway.heartbeat.enabled ?? false,
            intervalMinutes: parsed.gateway.heartbeat.intervalMinutes ?? 30,
            activeHours: parsed.gateway.heartbeat.activeHours,
            model: parsed.gateway.heartbeat.model,
            modelProvider: parsed.gateway.heartbeat.modelProvider,
            maxIterations: parsed.gateway.heartbeat.maxIterations ?? 6,
          }
        : undefined,
    },
    channels: {
      whatsapp: {
        enabled: parsed.channels?.whatsapp?.enabled ?? true,
        accounts: parsed.channels?.whatsapp?.accounts ?? {},
        allowFrom: parsed.channels?.whatsapp?.allowFrom ?? [],
      },
    },
    bindings: parsed.bindings ?? [],
  };
}

export function saveGatewayConfig(config: GatewayConfig, overridePath?: string): void {
  const path = getGatewayConfigPath(overridePath);
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf8');
}

export function listWhatsAppAccountIds(cfg: GatewayConfig): string[] {
  const accounts = cfg.channels.whatsapp.accounts ?? {};
  const ids = Object.keys(accounts);
  return ids.length > 0 ? ids : [cfg.gateway.accountId];
}

export function resolveWhatsAppAccount(
  cfg: GatewayConfig,
  accountId: string,
): WhatsAppAccountConfig {
  const account = cfg.channels.whatsapp.accounts?.[accountId] ?? {};
  const authDir = account.authDir ?? dexterPath('credentials', 'whatsapp', accountId);
  const rawAllowFrom = account.allowFrom ?? cfg.channels.whatsapp.allowFrom ?? [];
  const allowFrom = Array.from(
    new Set(
      rawAllowFrom
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => (entry === '*' ? '*' : normalizeE164(entry))),
    ),
  );
  return {
    accountId,
    enabled: account.enabled ?? true,
    name: account.name,
    authDir,
    allowFrom,
    dmPolicy: account.dmPolicy ?? 'pairing',
    groupPolicy: account.groupPolicy ?? 'disabled',
    groupAllowFrom: account.groupAllowFrom ?? [],
    sendReadReceipts: account.sendReadReceipts ?? true,
  };
}

