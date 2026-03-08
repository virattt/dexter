#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';
import { validateEnvOrExit } from './utils/env-validation.js';
import { ensureDexterDir } from './utils/setup-wizard.js';

// Load environment variables
config({ quiet: true });

ensureDexterDir();

const argv = process.argv.slice(2);
if (argv[0] === 'tastytrade' && argv[1] === 'login') {
  const { main: tastytradeLoginMain } = await import('./scripts/tastytrade-login.js');
  await tastytradeLoginMain();
  process.exit(0);
}

validateEnvOrExit();
await runCli();
