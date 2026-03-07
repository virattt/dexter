#!/usr/bin/env bun
/**
 * Standalone HTTP API server for Dexter.
 * Run with: bun run api
 * Enables web frontends (e.g. Next.js chatbot) to connect via POST /api/chat.
 */

import { config } from 'dotenv';
import { startHttpServer } from './http-server.js';
import { validateEnvOrExit } from '../utils/env-validation.js';

config({ quiet: true });
validateEnvOrExit();

const server = await startHttpServer();
console.log('Dexter API running. Press Ctrl+C to stop.');

const shutdown = () => {
  server.stop();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
