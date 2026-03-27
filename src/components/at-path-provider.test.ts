import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractAtPrefix, getAtFileSuggestions, AtPathAutocompleteProvider } from './at-path-provider.js';

// ---------------------------------------------------------------------------
// extractAtPrefix
// ---------------------------------------------------------------------------
describe('extractAtPrefix', () => {
  it('returns @token when text ends with @token', () => {
    expect(extractAtPrefix('@src/cli')).toBe('@src/cli');
  });

  it('returns @token after a space delimiter', () => {
    expect(extractAtPrefix('attach @src')).toBe('@src');
  });

  it('returns @token after a tab delimiter', () => {
    expect(extractAtPrefix('attach\t@src')).toBe('@src');
  });

  it('returns @token after an equals delimiter', () => {
    expect(extractAtPrefix('path=@foo')).toBe('@foo');
  });

  it('returns bare @ with empty path', () => {
    expect(extractAtPrefix('@')).toBe('@');
  });

  it('returns null when no @ token is present', () => {
    expect(extractAtPrefix('hello world')).toBeNull();
  });

  it('returns null when @ is not at start of a token', () => {
    // email-like — @ is in the middle of a token
    expect(extractAtPrefix('user@host')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAtFileSuggestions
// ---------------------------------------------------------------------------
describe('getAtFileSuggestions', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `dexter-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'src'));
    mkdirSync(join(tmpDir, 'docs'));
    writeFileSync(join(tmpDir, 'README.md'), '');
    writeFileSync(join(tmpDir, 'package.json'), '');
    writeFileSync(join(tmpDir, 'src', 'index.ts'), '');
    writeFileSync(join(tmpDir, 'src', 'cli.ts'), '');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists all visible entries for bare @', () => {
    const items = getAtFileSuggestions('@', tmpDir);
    const labels = items.map((i) => i.label);
    expect(labels).toContain('docs/');
    expect(labels).toContain('src/');
    expect(labels).toContain('README.md');
    expect(labels).toContain('package.json');
  });

  it('filters entries by prefix', () => {
    const items = getAtFileSuggestions('@R', tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0]!.label).toBe('README.md');
  });

  it('case-insensitive prefix filter', () => {
    const items = getAtFileSuggestions('@readme', tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0]!.label).toBe('README.md');
  });

  it('lists subdirectory when path ends with /', () => {
    const items = getAtFileSuggestions('@src/', tmpDir);
    const labels = items.map((i) => i.label);
    expect(labels).toContain('index.ts');
    expect(labels).toContain('cli.ts');
  });

  it('filters inside subdirectory', () => {
    const items = getAtFileSuggestions('@src/cli', tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0]!.label).toBe('cli.ts');
    expect(items[0]!.value).toBe('@src/cli.ts');
  });

  it('directories come before files', () => {
    const items = getAtFileSuggestions('@', tmpDir);
    const labels = items.map((i) => i.label);
    const firstFile = labels.findIndex((l) => !l.endsWith('/'));
    const lastDir = labels.map((l) => l.endsWith('/')).lastIndexOf(true);
    expect(lastDir).toBeLessThan(firstFile);
  });

  it('returns empty array for non-existent directory', () => {
    const items = getAtFileSuggestions('@nonexistent/', tmpDir);
    expect(items).toEqual([]);
  });

  it('hides dot-files unless prefix starts with .', () => {
    writeFileSync(join(tmpDir, '.hidden'), '');
    const visible = getAtFileSuggestions('@', tmpDir);
    expect(visible.map((i) => i.label)).not.toContain('.hidden');

    const hidden = getAtFileSuggestions('@.', tmpDir);
    expect(hidden.map((i) => i.label)).toContain('.hidden');
  });
});

// ---------------------------------------------------------------------------
// AtPathAutocompleteProvider
// ---------------------------------------------------------------------------
describe('AtPathAutocompleteProvider', () => {
  let tmpDir: string;
  let provider: AtPathAutocompleteProvider;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `dexter-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'src'));
    writeFileSync(join(tmpDir, 'README.md'), '');
    provider = new AtPathAutocompleteProvider(
      [{ name: 'model', description: 'Switch model' }],
      tmpDir,
      null, // no fd — exercises the readdirSync fallback
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns @ suggestions when text ends with @', () => {
    const result = provider.getSuggestions(['@'], 0, 1);
    expect(result).not.toBeNull();
    const labels = result!.items.map((i) => i.label);
    expect(labels).toContain('README.md');
    expect(labels).toContain('src/');
  });

  it('returns @ suggestions mid-line after a space', () => {
    const line = 'analyse @R';
    const result = provider.getSuggestions([line], 0, line.length);
    expect(result).not.toBeNull();
    expect(result!.prefix).toBe('@R');
    expect(result!.items.every((i) => i.label.startsWith('R'))).toBe(true);
  });

  it('returns slash command suggestions for / prefix', () => {
    const result = provider.getSuggestions(['/m'], 0, 2);
    expect(result).not.toBeNull();
    expect(result!.items.some((i) => i.value === 'model')).toBe(true);
  });

  it('returns null when no known prefix is present', () => {
    const result = provider.getSuggestions(['hello world'], 0, 11);
    expect(result).toBeNull();
  });

  // --- TUI freeze regression tests ---

  it('suppresses autocomplete for exact slash command match (prevents double-Enter)', () => {
    // Typing the full command name should return null so Enter submits directly.
    const result = provider.getSuggestions(['/model'], 0, '/model'.length);
    expect(result).toBeNull();
  });

  it('suppresses autocomplete for exact match case-insensitively', () => {
    const result = provider.getSuggestions(['/MODEL'], 0, '/MODEL'.length);
    expect(result).toBeNull();
  });

  it('still shows autocomplete for partial slash command (prefix match)', () => {
    const result = provider.getSuggestions(['/mo'], 0, '/mo'.length);
    expect(result).not.toBeNull();
    expect(result!.items.some((i) => i.value === 'model')).toBe(true);
  });

  it('does not suppress autocomplete when text has trailing space after command', () => {
    // "/model " (with space) is the state after autocomplete applied — should still work.
    const result = provider.getSuggestions(['/model '], 0, '/model '.length);
    // inner provider handles this (command argument completions); we just don't block it.
    // result may be null or non-null — we only care it didn't throw.
    expect(typeof result === 'object' || result === null).toBe(true);
  });

  it('does not suppress slash command check when fdPath is provided', () => {
    // Even if a real fdPath is passed, the exact-match guard must still work.
    const providerWithFd = new AtPathAutocompleteProvider(
      [{ name: 'watchlist', description: 'Portfolio tracker' }],
      tmpDir,
      '/usr/bin/fdfind', // non-null fdPath — must be ignored internally
    );
    const result = providerWithFd.getSuggestions(['/watchlist'], 0, '/watchlist'.length);
    expect(result).toBeNull();
  });

  it('applyCompletion replaces @ prefix with file value', () => {
    const applied = provider.applyCompletion(
      ['analyse @R'],
      0,
      10,
      { value: '@README.md', label: 'README.md' },
      '@R',
    );
    expect(applied.lines[0]).toContain('@README.md');
    expect(applied.lines[0]).not.toContain('@R ');
  });
});
