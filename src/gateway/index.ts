#!/usr/bin/env tsx
import { existsSync } from 'node:fs';
import util from 'node:util';
import {
  resolveWhatsAppAccount,
  loadGatewayConfig,
  saveGatewayConfig,
  getGatewayConfigPath,
} from './config.js';
import { loginWhatsApp } from './channels/whatsapp/login.js';
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

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'run';

  if (command === 'login') {
    const cfg = loadGatewayConfig();
    const accountId = cfg.gateway.accountId ?? 'default';
    const account = resolveWhatsAppAccount(cfg, accountId);
    const result = await loginWhatsApp({ authDir: account.authDir });

    // Auto-create gateway.json with the user's phone in allowFrom
    const configPath = getGatewayConfigPath();
    const configExists = existsSync(configPath);
    if (result.phone) {
      const currentAllowFrom = cfg.channels.whatsapp.allowFrom;
      const alreadyAllowed = currentAllowFrom.includes(result.phone);
      if (!configExists || (!alreadyAllowed && currentAllowFrom.length === 0)) {
        cfg.channels.whatsapp.allowFrom = [result.phone];
        saveGatewayConfig(cfg);
        console.log(`Added ${result.phone} to allowFrom in ${configPath}`);
      }
    } else if (!configExists) {
      // Create default config even without phone
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

