#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';
import { runPortfolioCommand } from './portfolio/index.js';

// Load environment variables
config({ quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'portfolio') {
    const result = await runPortfolioCommand(args.slice(1));
    process.stdout.write(`${JSON.stringify(result.payload, null, 2)}\n`);
    process.exit(result.exitCode);
  }

  await runCli();
}

await main();
