#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './v2/cli.js';

// Load environment variables
config({ quiet: true });

await runCli();
