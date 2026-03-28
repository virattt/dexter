#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';
import { runScheduleCommand } from './cli-schedule.js';

// Load environment variables
config({ quiet: true });

// Detect headless subcommands before launching the TUI
const subCommand = process.argv[2];
if (subCommand === 'schedule') {
  await runScheduleCommand(process.argv.slice(3));
} else {
  await runCli();
}
