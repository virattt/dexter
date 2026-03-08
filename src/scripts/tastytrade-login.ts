#!/usr/bin/env bun
/**
 * tastytrade CLI login: paste a refresh token and save credentials to ~/.dexter/tastytrade-credentials.json.
 *
 * Usage:
 *   bun run src/scripts/tastytrade-login.ts
 *   bun run start -- tastytrade login
 *
 * Prerequisites: TASTYTRADE_CLIENT_ID and TASTYTRADE_CLIENT_SECRET in .env.
 * Get a refresh token: https://my.tastytrade.com/app.html#/manage/api-access/oauth-applications → Create Grant.
 */

import { config } from 'dotenv';
import * as readline from 'node:readline';
import { ensureDexterDir } from '../utils/setup-wizard.js';
import {
  getAuthStatus,
  getCredentialsPath,
  hasConfiguredClient,
  loginWithRefreshToken,
} from '../tools/tastytrade/auth.js';

config({ quiet: true });
ensureDexterDir();

const OAUTH_APPS_URL = 'https://my.tastytrade.com/app.html#/manage/api-access/oauth-applications';

export async function main(): Promise<void> {
  if (!hasConfiguredClient()) {
    console.error('Missing TASTYTRADE_CLIENT_ID or TASTYTRADE_CLIENT_SECRET.');
    console.error('Add them to .env (see env.example and docs/PRD-TASTYTRADE-INTEGRATION.md).');
    process.exit(1);
  }

  console.log('tastytrade login');
  console.log('---');
  console.log(`1. Open: ${OAUTH_APPS_URL}`);
  console.log('2. Create a grant (or use an existing OAuth app with callback).');
  console.log('3. Copy the refresh token and paste it below.');
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const token = await new Promise<string>((resolve) => {
    rl.question('Paste your refresh token: ', (answer) => {
      rl.close();
      resolve(answer ?? '');
    });
  });

  if (!token.trim()) {
    console.error('No token entered. Exiting.');
    process.exit(1);
  }

  const result = await loginWithRefreshToken(token);
  if (!result.success) {
    console.error('Login failed:', result.error);
    process.exit(1);
  }

  const status = getAuthStatus();
  console.log('');
  console.log('Credentials saved to:', getCredentialsPath());
  console.log('Operator state:', status.operatorState);
  console.log(status.message);
  console.log('');
  console.log('You can run Dexter and use /tastytrade-status or theta tools.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
