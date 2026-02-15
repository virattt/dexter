import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { checkPermission, grantPermission, requestPermission } from './permissions.js';

const PERMISSIONS_PATH = '.dexter/permissions.json';

describe('permissions', () => {
  beforeEach(() => {
    if (existsSync(PERMISSIONS_PATH)) {
      rmSync(PERMISSIONS_PATH);
    }
  });

  afterEach(() => {
    if (existsSync(PERMISSIONS_PATH)) {
      rmSync(PERMISSIONS_PATH);
    }
  });

  describe('checkPermission', () => {
    test('returns false when no permissions are granted', () => {
      expect(checkPermission('read_file', '/tmp/test.txt')).toBe(false);
    });

    test('returns true for exact path match', () => {
      grantPermission('read_file', '/tmp/test.txt', false);
      expect(checkPermission('read_file', '/tmp/test.txt')).toBe(true);
    });

    test('returns false for different tool on same path', () => {
      grantPermission('read_file', '/tmp/test.txt', false);
      expect(checkPermission('write_file', '/tmp/test.txt')).toBe(false);
    });

    test('returns true for file under recursive directory grant', () => {
      grantPermission('read_file', '/tmp/project', true);
      expect(checkPermission('read_file', '/tmp/project/src/index.ts')).toBe(true);
    });

    test('returns false for file outside recursive directory grant', () => {
      grantPermission('read_file', '/tmp/project', true);
      expect(checkPermission('read_file', '/tmp/other/file.txt')).toBe(false);
    });

    test('non-recursive grant does not match subdirectory files', () => {
      grantPermission('read_file', '/tmp/project', false);
      expect(checkPermission('read_file', '/tmp/project/file.txt')).toBe(false);
    });
  });

  describe('grantPermission', () => {
    test('persists permission to disk', () => {
      grantPermission('write_file', '/tmp/output.txt', false);
      expect(existsSync(PERMISSIONS_PATH)).toBe(true);

      const raw = readFileSync(PERMISSIONS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.rules).toHaveLength(1);
      expect(parsed.rules[0].tool).toBe('write_file');
      expect(parsed.rules[0].path).toBe(resolve('/tmp/output.txt'));
    });

    test('does not create duplicate rules', () => {
      grantPermission('read_file', '/tmp/test.txt', false);
      grantPermission('read_file', '/tmp/test.txt', false);

      const raw = readFileSync(PERMISSIONS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.rules).toHaveLength(1);
    });

    test('allows different tools for same path', () => {
      grantPermission('read_file', '/tmp/test.txt', false);
      grantPermission('write_file', '/tmp/test.txt', false);

      const raw = readFileSync(PERMISSIONS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.rules).toHaveLength(2);
    });
  });

  describe('requestPermission', () => {
    test('returns allowed: true when permission exists', () => {
      grantPermission('read_file', '/tmp/test.txt', false);
      const result = requestPermission('read_file', '/tmp/test.txt');
      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    test('returns allowed: false with helpful message when no permission', () => {
      const result = requestPermission('read_file', '/tmp/test.txt');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Permission denied');
      expect(result.message).toContain('read_file');
      expect(result.message).toContain('.dexter/permissions.json');
    });
  });
});
