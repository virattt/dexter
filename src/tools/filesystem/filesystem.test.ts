import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { grantPermission } from '../../utils/permissions.js';
import { readFileTool } from './read-file.js';
import { writeFileTool } from './write-file.js';
import { editFileTool } from './edit-file.js';

const TEST_DIR = '.dexter/test-filesystem';
const PERMISSIONS_PATH = '.dexter/permissions.json';

function setupTestDir() {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
}

function cleanup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
  if (existsSync(PERMISSIONS_PATH)) {
    rmSync(PERMISSIONS_PATH);
  }
}

/**
 * Grant permissions for test directory so tools can operate.
 */
function grantTestPermissions() {
  const absDir = resolve(TEST_DIR);
  grantPermission('read_file', absDir, true);
  grantPermission('write_file', absDir, true);
  grantPermission('edit_file', absDir, true);
}

// ---------------------------------------------------------------------------
// read_file
// ---------------------------------------------------------------------------

describe('read_file', () => {
  beforeEach(() => {
    cleanup();
    setupTestDir();
    grantTestPermissions();
  });

  afterEach(cleanup);

  test('reads an existing file with line numbers', async () => {
    const filePath = join(TEST_DIR, 'hello.txt');
    writeFileSync(filePath, 'line one\nline two\nline three');

    const result = await readFileTool.invoke({ file_path: filePath });
    expect(result).toContain('line one');
    expect(result).toContain('line two');
    expect(result).toContain('line three');
  });

  test('returns error for missing file', async () => {
    const result = await readFileTool.invoke({ file_path: join(TEST_DIR, 'missing.txt') });
    expect(result).toContain('Error: File not found');
  });

  test('returns error for directory', async () => {
    const result = await readFileTool.invoke({ file_path: TEST_DIR });
    expect(result).toContain('is a directory');
  });

  test('respects offset and limit', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const filePath = join(TEST_DIR, 'lines.txt');
    writeFileSync(filePath, lines);

    const result = await readFileTool.invoke({ file_path: filePath, offset: 2, limit: 3 });
    expect(result).toContain('line 3');
    expect(result).toContain('line 4');
    expect(result).toContain('line 5');
    expect(result).not.toContain('line 1');
    expect(result).not.toContain('line 6');
  });

  test('returns permission denied without permission', async () => {
    // Remove permissions
    rmSync(PERMISSIONS_PATH);

    const filePath = join(TEST_DIR, 'hello.txt');
    writeFileSync(filePath, 'content');

    const result = await readFileTool.invoke({ file_path: filePath });
    expect(result).toContain('Permission denied');
  });
});

// ---------------------------------------------------------------------------
// write_file
// ---------------------------------------------------------------------------

describe('write_file', () => {
  beforeEach(() => {
    cleanup();
    setupTestDir();
    grantTestPermissions();
  });

  afterEach(cleanup);

  test('writes a new file', async () => {
    const filePath = join(TEST_DIR, 'output.txt');
    const result = await writeFileTool.invoke({ file_path: filePath, content: 'hello world' });

    expect(result).toContain('Successfully wrote');
    expect(readFileSync(filePath, 'utf-8')).toBe('hello world');
  });

  test('creates parent directories', async () => {
    const filePath = join(TEST_DIR, 'sub/dir/file.txt');
    await writeFileTool.invoke({ file_path: filePath, content: 'nested' });

    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, 'utf-8')).toBe('nested');
  });

  test('overwrites existing file', async () => {
    const filePath = join(TEST_DIR, 'overwrite.txt');
    writeFileSync(filePath, 'old content');

    await writeFileTool.invoke({ file_path: filePath, content: 'new content' });
    expect(readFileSync(filePath, 'utf-8')).toBe('new content');
  });

  test('returns permission denied without permission', async () => {
    rmSync(PERMISSIONS_PATH);

    const result = await writeFileTool.invoke({
      file_path: join(TEST_DIR, 'file.txt'),
      content: 'test',
    });
    expect(result).toContain('Permission denied');
  });
});

// ---------------------------------------------------------------------------
// edit_file
// ---------------------------------------------------------------------------

describe('edit_file', () => {
  beforeEach(() => {
    cleanup();
    setupTestDir();
    grantTestPermissions();
  });

  afterEach(cleanup);

  test('replaces a unique string', async () => {
    const filePath = join(TEST_DIR, 'edit.txt');
    writeFileSync(filePath, 'hello world');

    const result = await editFileTool.invoke({
      file_path: filePath,
      old_string: 'hello',
      new_string: 'goodbye',
    });

    expect(result).toContain('Successfully replaced 1');
    expect(readFileSync(filePath, 'utf-8')).toBe('goodbye world');
  });

  test('errors when old_string not found', async () => {
    const filePath = join(TEST_DIR, 'edit.txt');
    writeFileSync(filePath, 'hello world');

    const result = await editFileTool.invoke({
      file_path: filePath,
      old_string: 'missing',
      new_string: 'replacement',
    });

    expect(result).toContain('old_string not found');
  });

  test('errors on ambiguous match without replace_all', async () => {
    const filePath = join(TEST_DIR, 'edit.txt');
    writeFileSync(filePath, 'foo bar foo baz foo');

    const result = await editFileTool.invoke({
      file_path: filePath,
      old_string: 'foo',
      new_string: 'qux',
    });

    expect(result).toContain('appears 3 times');
  });

  test('replaces all occurrences with replace_all', async () => {
    const filePath = join(TEST_DIR, 'edit.txt');
    writeFileSync(filePath, 'foo bar foo baz foo');

    const result = await editFileTool.invoke({
      file_path: filePath,
      old_string: 'foo',
      new_string: 'qux',
      replace_all: true,
    });

    expect(result).toContain('Successfully replaced 3');
    expect(readFileSync(filePath, 'utf-8')).toBe('qux bar qux baz qux');
  });

  test('errors when old_string equals new_string', async () => {
    const filePath = join(TEST_DIR, 'edit.txt');
    writeFileSync(filePath, 'hello');

    const result = await editFileTool.invoke({
      file_path: filePath,
      old_string: 'hello',
      new_string: 'hello',
    });

    expect(result).toContain('identical');
  });

  test('errors for missing file', async () => {
    const result = await editFileTool.invoke({
      file_path: join(TEST_DIR, 'missing.txt'),
      old_string: 'a',
      new_string: 'b',
    });

    expect(result).toContain('File not found');
  });

  test('returns permission denied without permission', async () => {
    rmSync(PERMISSIONS_PATH);
    const filePath = join(TEST_DIR, 'edit.txt');
    writeFileSync(filePath, 'hello');

    const result = await editFileTool.invoke({
      file_path: filePath,
      old_string: 'hello',
      new_string: 'bye',
    });

    expect(result).toContain('Permission denied');
  });
});
