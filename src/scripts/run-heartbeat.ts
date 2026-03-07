#!/usr/bin/env bun
/**
 * Run a single heartbeat cycle (CLI, no gateway).
 * Usage: bun run heartbeat [--dry-run]
 *   --dry-run: Build and print the query only, do not run the agent.
 */

import { config } from 'dotenv';
import { buildHeartbeatQuery } from '../gateway/heartbeat/prompt.js';
import { runAgentForMessage } from '../gateway/agent-runner.js';
import { loadGatewayConfig } from '../gateway/config.js';
import { validateEnvOrExit } from '../utils/env-validation.js';

config({ quiet: true });
validateEnvOrExit();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function main(): Promise<void> {
  const query = await buildHeartbeatQuery();
  if (query === null) {
    console.log('[heartbeat] HEARTBEAT.md exists but is empty. Nothing to run.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('[heartbeat] Dry run — query below:\n');
    console.log(query);
    process.exit(0);
  }

  const cfg = loadGatewayConfig();
  const heartbeatCfg = cfg.gateway?.heartbeat;
  const model = heartbeatCfg?.model ?? 'gpt-5.4';
  const modelProvider = heartbeatCfg?.modelProvider ?? 'openai';

  console.log('[heartbeat] Running agent...');
  const answer = await runAgentForMessage({
    sessionKey: 'heartbeat-cli',
    query,
    model,
    modelProvider,
    maxIterations: heartbeatCfg?.maxIterations ?? 6,
    isHeartbeat: true,
    channel: 'cli',
  });

  console.log('\n--- Heartbeat result ---\n');
  console.log(answer);
}

main().catch((err) => {
  console.error('[heartbeat] Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
