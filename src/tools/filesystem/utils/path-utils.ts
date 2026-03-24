import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, resolve as resolvePath } from 'node:path';

const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;

function normalizeUnicodeSpaces(str: string): string {
  return str.replace(UNICODE_SPACES, ' ');
}

function fileExists(filePath: string): boolean {
  try {
    accessSync(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeAtPrefix(filePath: string): string {
  return filePath.startsWith('@') ? filePath.slice(1) : filePath;
}

export function expandPath(filePath: string): string {
  const normalized = normalizeUnicodeSpaces(normalizeAtPrefix(filePath));
  if (normalized === '~') {
    return homedir();
  }
  if (normalized.startsWith('~/')) {
    return homedir() + normalized.slice(1);
  }
  return normalized;
}

export function resolveToCwd(filePath: string, cwd: string): string {
  const expanded = expandPath(filePath);
  if (isAbsolute(expanded)) {
    return expanded;
  }
  return resolvePath(cwd, expanded);
}

export function resolveReadPath(filePath: string, cwd: string): string {
  const resolved = resolveToCwd(filePath, cwd);
  if (fileExists(resolved)) {
    return resolved;
  }

  // macOS stores filenames in NFD form; user input may be NFC.
  const nfdVariant = resolved.normalize('NFD');
  if (nfdVariant !== resolved && fileExists(nfdVariant)) {
    return nfdVariant;
  }

  return resolved;
}
