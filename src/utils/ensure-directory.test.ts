import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureDirectory } from './ensure-directory.js';

describe('ensureDirectory', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'dexter-ensure-dir-'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  test('succeeds when the directory already exists', async () => {
    const dir = join(rootDir, 'memory');
    mkdirSync(dir, { recursive: true });

    await expect(ensureDirectory(dir)).resolves.toBeUndefined();
  });

  test('creates missing nested directories', async () => {
    const dir = join(rootDir, '.dexter', 'memory', 'nested');

    await expect(ensureDirectory(dir)).resolves.toBeUndefined();
  });

  test('throws when path exists as a file', async () => {
    const filePath = join(rootDir, 'not-a-dir');
    writeFileSync(filePath, 'x');

    await expect(ensureDirectory(filePath)).rejects.toThrow();
  });
});
