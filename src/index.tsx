#!/usr/bin/env bun
import { config } from 'dotenv';
import { runCli } from './cli.js';
import { validateEnvOrExit } from './utils/env-validation.js';
import { ensureDexterDir } from './utils/setup-wizard.js';

// Load environment variables
config({ quiet: true });

ensureDexterDir();
validateEnvOrExit();
await runCli();
