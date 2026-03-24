import { existsSync, statSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

export function resolveCredsPath(authDir: string): string {
  return join(authDir, 'creds.json');
}

export function resolveCredsBackupPath(authDir: string): string {
  return join(authDir, 'creds.json.bak');
}

export function hasCredsSync(authDir: string): boolean {
  try {
    const stats = statSync(resolveCredsPath(authDir));
    return stats.isFile() && stats.size > 1;
  } catch {
    return false;
  }
}

function readCredsJsonRaw(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const stats = statSync(filePath);
    if (!stats.isFile() || stats.size <= 1) {
      return null;
    }
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * If creds.json is missing or corrupted, restore from backup if available.
 */
export function maybeRestoreCredsFromBackup(authDir: string): void {
  try {
    const credsPath = resolveCredsPath(authDir);
    const backupPath = resolveCredsBackupPath(authDir);
    const raw = readCredsJsonRaw(credsPath);
    if (raw) {
      // Validate that creds.json is parseable
      JSON.parse(raw);
      return;
    }

    const backupRaw = readCredsJsonRaw(backupPath);
    if (!backupRaw) {
      return;
    }

    // Ensure backup is parseable before restoring
    JSON.parse(backupRaw);
    copyFileSync(backupPath, credsPath);
    console.log('Restored WhatsApp creds.json from backup');
  } catch {
    // ignore
  }
}

/**
 * Back up creds.json before saving new credentials.
 */
export function backupCredsBeforeSave(authDir: string): void {
  try {
    const credsPath = resolveCredsPath(authDir);
    const backupPath = resolveCredsBackupPath(authDir);
    const raw = readCredsJsonRaw(credsPath);
    if (raw) {
      // Validate before backing up
      JSON.parse(raw);
      copyFileSync(credsPath, backupPath);
    }
  } catch {
    // ignore backup failures
  }
}

/**
 * Check if valid WhatsApp credentials exist.
 */
export async function authExists(authDir: string): Promise<boolean> {
  maybeRestoreCredsFromBackup(authDir);
  const credsPath = resolveCredsPath(authDir);
  try {
    const stats = statSync(credsPath);
    if (!stats.isFile() || stats.size <= 1) {
      return false;
    }
    const raw = readFileSync(credsPath, 'utf-8');
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the linked phone number from stored credentials.
 * Returns E.164 format (e.g., "+1234567890") and raw JID.
 */
export function readSelfId(authDir: string): { e164: string | null; jid: string | null } {
  try {
    const credsPath = resolveCredsPath(authDir);
    if (!existsSync(credsPath)) {
      return { e164: null, jid: null };
    }
    const raw = readFileSync(credsPath, 'utf-8');
    const parsed = JSON.parse(raw) as { me?: { id?: string } } | undefined;
    const jid = parsed?.me?.id ?? null;
    // JID format: "1234567890:123@s.whatsapp.net" -> "+1234567890"
    const e164 = jid ? jidToE164(jid) : null;
    return { e164, jid };
  } catch {
    return { e164: null, jid: null };
  }
}

function jidToE164(jid: string): string | null {
  const match = jid.match(/^(\d+):/);
  return match ? `+${match[1]}` : null;
}

/**
 * Clear WhatsApp credentials (logout).
 */
export async function logout(authDir: string): Promise<boolean> {
  const exists = await authExists(authDir);
  if (!exists) {
    console.log('No WhatsApp session found; nothing to delete.');
    return false;
  }
  await rm(authDir, { recursive: true, force: true });
  console.log('Cleared WhatsApp credentials.');
  return true;
}
