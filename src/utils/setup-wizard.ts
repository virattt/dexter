/**
 * Ensures ~/.dexter exists and has basic config.
 * Copies HEARTBEAT.example.md → HEARTBEAT.md if HEARTBEAT.md is missing.
 */

import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEXTER_DIR = join(homedir(), '.dexter');
const HEARTBEAT_PATH = join(DEXTER_DIR, 'HEARTBEAT.md');
const HEARTBEAT_EXAMPLE = join(process.cwd(), 'docs', 'HEARTBEAT.example.md');

export function ensureDexterDir(): void {
  if (!existsSync(DEXTER_DIR)) {
    mkdirSync(DEXTER_DIR, { recursive: true });
  }

  if (!existsSync(HEARTBEAT_PATH) && existsSync(HEARTBEAT_EXAMPLE)) {
    copyFileSync(HEARTBEAT_EXAMPLE, HEARTBEAT_PATH);
  }
}
