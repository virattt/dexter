import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { loadApprovedTools, saveApprovedTools } from './tool-permissions.js';

const PERMISSIONS_DIR = '.dexter';
const PERMISSIONS_FILE = '.dexter/permissions.json';

beforeEach(() => {
  if (existsSync(PERMISSIONS_FILE)) {
    rmSync(PERMISSIONS_FILE);
  }
});

afterEach(() => {
  if (existsSync(PERMISSIONS_FILE)) {
    rmSync(PERMISSIONS_FILE);
  }
});

describe('loadApprovedTools', () => {
  test('returns empty array when no file exists', () => {
    expect(loadApprovedTools()).toEqual([]);
  });

  test('returns saved tool names', () => {
    if (!existsSync(PERMISSIONS_DIR)) mkdirSync(PERMISSIONS_DIR, { recursive: true });
    writeFileSync(PERMISSIONS_FILE, JSON.stringify({ approvedTools: ['write_file', 'edit_file'] }));
    expect(loadApprovedTools()).toEqual(['write_file', 'edit_file']);
  });

  test('returns empty array for corrupted JSON', () => {
    if (!existsSync(PERMISSIONS_DIR)) mkdirSync(PERMISSIONS_DIR, { recursive: true });
    writeFileSync(PERMISSIONS_FILE, '{ broken json!!!');
    expect(loadApprovedTools()).toEqual([]);
  });

  test('returns empty array when approvedTools is not an array', () => {
    if (!existsSync(PERMISSIONS_DIR)) mkdirSync(PERMISSIONS_DIR, { recursive: true });
    writeFileSync(PERMISSIONS_FILE, JSON.stringify({ approvedTools: 'not-an-array' }));
    expect(loadApprovedTools()).toEqual([]);
  });

  test('filters out non-string entries', () => {
    if (!existsSync(PERMISSIONS_DIR)) mkdirSync(PERMISSIONS_DIR, { recursive: true });
    writeFileSync(PERMISSIONS_FILE, JSON.stringify({ approvedTools: ['write_file', 42, null, 'edit_file'] }));
    expect(loadApprovedTools()).toEqual(['write_file', 'edit_file']);
  });
});

describe('saveApprovedTools', () => {
  test('persists tools that can be loaded back', () => {
    const tools = new Set(['write_file', 'edit_file']);
    saveApprovedTools(tools);
    expect(loadApprovedTools()).toEqual(['write_file', 'edit_file']);
  });

  test('overwrites previous permissions', () => {
    saveApprovedTools(new Set(['write_file']));
    saveApprovedTools(new Set(['write_file', 'edit_file']));
    expect(loadApprovedTools()).toEqual(['write_file', 'edit_file']);
  });
});
