#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';

// Load environment variables
config({ quiet: true });

await runCli();
