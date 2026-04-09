import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { dexterPath } from '../utils/paths.js';
import type { CronStore } from './types.js';

const CRON_STORE_PATH = dexterPath('cron', 'jobs.json');

const EMPTY_STORE: CronStore = { version: 1, jobs: [] };

export function getCronStorePath(): string {
  return CRON_STORE_PATH;
}

export function loadCronStore(): CronStore {
  if (!existsSync(CRON_STORE_PATH)) {
    return { ...EMPTY_STORE, jobs: [] };
  }
  try {
    const raw = readFileSync(CRON_STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as CronStore;
    if (!parsed.jobs || !Array.isArray(parsed.jobs)) {
      return { ...EMPTY_STORE, jobs: [] };
    }
    return parsed;
  } catch {
    return { ...EMPTY_STORE, jobs: [] };
  }
}

export function saveCronStore(store: CronStore): void {
  const dir = dirname(CRON_STORE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const data = JSON.stringify(store, null, 2);
  const tmp = `${CRON_STORE_PATH}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;

  try {
    writeFileSync(tmp, data, 'utf-8');
    renameSync(tmp, CRON_STORE_PATH);
  } catch (err) {
    // Clean up temp file on failure
    try { unlinkSync(tmp); } catch { /* ignore */ }
    throw err;
  }
}
