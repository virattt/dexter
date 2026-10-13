import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { dexterPath } from './paths.js';

const PERMISSIONS_FILE = dexterPath('permissions.json');

export function loadApprovedTools(): string[] {
  if (!existsSync(PERMISSIONS_FILE)) return [];
  try {
    const data = JSON.parse(readFileSync(PERMISSIONS_FILE, 'utf-8'));
    return Array.isArray(data.approvedTools)
      ? data.approvedTools.filter((t: unknown) => typeof t === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveApprovedTools(tools: Set<string>): void {
  try {
    const dir = dirname(PERMISSIONS_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(PERMISSIONS_FILE, JSON.stringify({ approvedTools: [...tools] }, null, 2));
  } catch {
    // best-effort — don't break the app on write failure
  }
}
