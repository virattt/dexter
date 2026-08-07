import { mkdir, stat } from 'node:fs/promises';

type NodeErrorWithCode = Error & { code?: string };

/**
 * Work around Bun-on-Windows mkdir recursive EEXIST behavior by accepting
 * EEXIST only when the target already exists as a directory.
 */
export async function ensureDirectory(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
    return;
  } catch (error) {
    const err = error as NodeErrorWithCode;
    if (err.code !== 'EEXIST') {
      throw error;
    }
    const existing = await stat(path).catch(() => null);
    if (existing?.isDirectory()) {
      return;
    }
    throw error;
  }
}
