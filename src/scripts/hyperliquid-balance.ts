#!/usr/bin/env bun
/**
 * Test Hyperliquid account connection: fetch and print balance (read-only).
 * Requires HYPERLIQUID_ACCOUNT_ADDRESS in .env (42-char hex).
 *
 * Usage: bun run hyperliquid:balance
 */

import { config } from 'dotenv';
import { getHLAccountAddress, getLiveAccountState } from '../tools/hyperliquid/hyperliquid-account-api.js';

config({ path: '.env', quiet: true });

async function main(): Promise<void> {
  const address = getHLAccountAddress();
  if (!address) {
    console.error('HYPERLIQUID_ACCOUNT_ADDRESS is not set or invalid (need 42-char hex, e.g. 0x...).');
    console.error('Add it to .env (see env.example).');
    process.exit(1);
  }

  console.log('Fetching Hyperliquid clearinghouse state for', address.slice(0, 10) + '...');
  try {
    const state = await getLiveAccountState();
    if (!state) {
      console.error('Failed to fetch account state.');
      process.exit(1);
    }
    console.log('');
    console.log('Account value (USD):', state.accountValue.toFixed(2));
    console.log('Withdrawable (USD):', state.withdrawable.toFixed(2));
    console.log('Positions:', state.positions.length);
    if (state.positions.length > 0) {
      console.log('');
      state.positions.forEach((p) => {
        console.log(`  ${p.symbol}: size ${p.size}, value $${p.positionValue.toFixed(2)}, weight ${p.weightPct.toFixed(1)}%`);
      });
    }
    console.log('');
    console.log('OK — balance read succeeded.');
  } catch (e) {
    console.error('Error:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
