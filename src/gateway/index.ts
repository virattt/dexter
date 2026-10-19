#!/usr/bin/env tsx
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import util from 'node:util';
import {
  resolveWhatsAppAccount,
  loadGatewayConfig,
  saveGatewayConfig,
  getGatewayConfigPath,
  type GatewayConfig,
} from './config.js';
import { loginWhatsApp } from './channels/whatsapp/login.js';
import axios from 'axios';
import { getTelegramMe } from './channels/telegram/outbound.js';
import { startGateway } from './gateway.js';

// Suppress noisy Baileys Signal protocol session logs
const SUPPRESSED_PREFIXES = [
  'Closing session:',
  'Opening session:',
  'Removing old closed session:',
  'Session already closed',
  'Session already open',
];

const originalLog = console.log;
console.log = (...args: unknown[]) => {
  const formatted = util.format(...args);
  if (SUPPRESSED_PREFIXES.some((prefix) => formatted.startsWith(prefix))) {
    return;
  }
  originalLog.apply(console, args);
};

const E164_RE = /^\+\d{7,15}$/;

async function promptSetupMode(cfg: GatewayConfig, linkedPhone: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log('');
    console.log(`Linked phone: ${linkedPhone}`);
    console.log('');
    console.log('How will you use Dexter with WhatsApp?');
    console.log('  1) Self-chat  — message yourself to talk to Dexter');
    console.log('  2) Bot phone  — this is a dedicated Dexter phone, others message it');

    let mode = '';
    while (mode !== '1' && mode !== '2') {
      mode = (await rl.question('\nChoose (1 or 2): ')).trim();
    }

    const accountId = cfg.gateway.accountId ?? 'default';

    if (mode === '1') {
      cfg.channels.whatsapp.allowFrom = [linkedPhone];
      return;
    }

    // Bot mode: collect allowed sender phone numbers
    console.log('');
    console.log('Enter the phone number(s) allowed to message Dexter (E.164 format, e.g. +15551234567).');
    console.log('Separate multiple numbers with commas, or type * to allow anyone.');

    let phones: string[] = [];
    while (phones.length === 0) {
      const input = (await rl.question('Allowed number(s): ')).trim();
      if (!input) continue;

      if (input === '*') {
        phones = ['*'];
        break;
      }

      phones = input.split(',').map((s) => s.trim()).filter(Boolean);
      const invalid = phones.filter((p) => !E164_RE.test(p));
      if (invalid.length > 0) {
        console.log(`Invalid format: ${invalid.join(', ')}. Use E.164 format (e.g. +15551234567).`);
        phones = [];
      }
    }

    cfg.channels.whatsapp.accounts[accountId] = {
      enabled: true,
      dmPolicy: 'allowlist',
      allowFrom: phones,
      groupPolicy: 'disabled',
      groupAllowFrom: [],
      sendReadReceipts: true,
    };
    cfg.channels.whatsapp.allowFrom = phones;
  } finally {
    rl.close();
  }
}

const TELEGRAM_CHAT_ID_RE = /^-?\d+$/;

async function loginTelegram(opts: { token?: string; accountId?: string }): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    let token = opts.token?.trim() ?? '';
    if (!token) {
      token = (await rl.question('Telegram bot token (from @BotFather): ')).trim();
    }
    if (!token) {
      console.log('No bot token provided.');
      process.exitCode = 1;
      return;
    }

    let accountId = opts.accountId?.trim() ?? '';
    if (!accountId) {
      accountId = (await rl.question('Account ID [default]: ')).trim() || 'default';
    }

    let username: string | undefined;
    try {
      username = (await getTelegramMe(token)).username;
    } catch (error) {
      const reason = axios.isAxiosError(error) && error.response?.status === 401
        ? 'invalid token'
        : error instanceof Error ? error.message : String(error);
      console.log(`Telegram token validation failed: ${reason}`);
      process.exitCode = 1;
      return;
    }

    const cfg = loadGatewayConfig();
    const telegram = cfg.channels.telegram ?? { enabled: true, accounts: {} };
    const existing = telegram.accounts[accountId];
    const account = {
      ...existing,
      enabled: existing?.enabled ?? true,
      allowFrom: existing?.allowFrom ?? [],
      botToken: token,
    };
    telegram.accounts[accountId] = account;
    cfg.channels.telegram = telegram;
    saveGatewayConfig(cfg);
    console.log(`Telegram bot @${username ?? 'unknown'} verified. Saved account "${accountId}" to ${getGatewayConfigPath()}`);

    console.log('');
    console.log('Enter the Telegram chat ID(s) allowed to message the bot (numeric).');
    console.log('Find yours by messaging @userinfobot, or via https://api.telegram.org/bot<token>/getUpdates.');
    console.log('Separate multiple IDs with commas, type * to allow everyone, or press Enter to skip.');
    if (account.allowFrom.length > 0) {
      console.log(`Current allowFrom: ${account.allowFrom.join(', ')} (Enter keeps it)`);
    }

    while (true) {
      const input = (await rl.question('Allowed chat ID(s): ')).trim();
      if (!input) break;
      const ids = input === '*' ? ['*'] : input.split(',').map((s) => s.trim()).filter(Boolean);
      const invalid = ids.filter((id) => id !== '*' && !TELEGRAM_CHAT_ID_RE.test(id));
      if (ids.length === 0 || invalid.length > 0) {
        console.log(`Invalid chat ID: ${invalid.join(', ') || input}. Use numeric IDs, or * for everyone.`);
        continue;
      }
      account.allowFrom = ids;
      saveGatewayConfig(cfg);
      console.log(`Saved allowFrom for "${accountId}".`);
      break;
    }
    if (account.allowFrom.length === 0) {
      console.log(`allowFrom is empty — add chat IDs to channels.telegram.accounts.${accountId}.allowFrom to receive replies.`);
    }
  } finally {
    rl.close();
  }
}

/** Extracts `--account <id>` / `--account=<id>` / `-a <id>`; remaining positionals are [token, accountId]. */
function parseTelegramLoginArgs(args: string[]): { token?: string; accountId?: string } {
  const positional: string[] = [];
  let accountId: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--account' || arg === '-a') {
      accountId = args[++i];
    } else if (arg.startsWith('--account=')) {
      accountId = arg.slice('--account='.length);
    } else {
      positional.push(arg);
    }
  }
  return {
    token: positional[0] ?? process.env.TELEGRAM_BOT_TOKEN,
    accountId: accountId ?? positional[1],
  };
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'run';

  if (command === 'telegram:login') {
    await loginTelegram(parseTelegramLoginArgs(args.slice(1)));
    return;
  }

  if (command === 'login') {
    const cfg = loadGatewayConfig();
    const accountId = cfg.gateway.accountId ?? 'default';
    const account = resolveWhatsAppAccount(cfg, accountId);
    const result = await loginWhatsApp({ authDir: account.authDir });

    const configPath = getGatewayConfigPath();
    const configExists = existsSync(configPath);

    if (result.phone && (!configExists || cfg.channels.whatsapp.allowFrom.length === 0)) {
      await promptSetupMode(cfg, result.phone);
      saveGatewayConfig(cfg);
      console.log(`Saved gateway config to ${configPath}`);
    } else if (result.phone && configExists) {
      const currentAllowFrom = cfg.channels.whatsapp.allowFrom;
      if (!currentAllowFrom.includes(result.phone)) {
        console.log(`Config already exists at ${configPath} — no changes made.`);
        console.log(`Linked phone ${result.phone} is not in allowFrom. Edit the config if needed.`);
      }
    } else if (!configExists) {
      saveGatewayConfig(cfg);
      console.log(`Created default config at ${configPath}`);
      console.log('Add your phone number to channels.whatsapp.allowFrom to receive messages.');
    }
    return;
  }

  const server = await startGateway();
  console.log('Dexter gateway running. Press Ctrl+C to stop.');

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void run();

